
/**
 * Media Compression Utilities for Client-Side Processing
 * 
 * Moves resource-intensive compression from server to client.
 */

interface CompressionOptions {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    quality: number; // 0 to 1
    fileType?: string;
    onProgress?: (percent: number) => void;
}

const DEFAULT_IMAGE_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.2, // Target ~200KB
    maxWidthOrHeight: 1280, // Resize large images
    quality: 0.8,
    fileType: 'image/webp'
};

const DEFAULT_VIDEO_OPTIONS: CompressionOptions = {
    maxSizeMB: 8, // Target ~8MB
    maxWidthOrHeight: 720,
    quality: 1, // Passthrough mostly
};

/**
 * Compress an image file using browser Canvas API
 */
export async function compressImage(
    file: File,
    options: Partial<CompressionOptions> = {}
): Promise<File> {
    const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };

    // If already small enough, return original
    if (file.size / 1024 / 1024 < opts.maxSizeMB) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > opts.maxWidthOrHeight || height > opts.maxWidthOrHeight) {
                    if (width > height) {
                        height = Math.round((height * opts.maxWidthOrHeight) / width);
                        width = opts.maxWidthOrHeight;
                    } else {
                        width = Math.round((width * opts.maxWidthOrHeight) / height);
                        height = opts.maxWidthOrHeight;
                    }
                }

                // Draw to canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Compress
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }

                        // Create new file
                        // Use original name but change extension if converting to webp
                        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                        const newFile = new File([blob], fileName, {
                            type: opts.fileType,
                            lastModified: Date.now(),
                        });

                        // If compressed file is somehow larger, return original
                        if (newFile.size > file.size) {
                            resolve(file);
                        } else {
                            resolve(newFile);
                        }
                    },
                    opts.fileType,
                    opts.quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

/**
 * Check and potentially "compress" video (limited in browser without WASM).
 * 
 * Real browser video compression requires heavy libraries like ffmpeg.wasm.
 * This function mainly validates and could implementation naive chunking/transcoding if libraries were available.
 * For now, it enforces strict limits to ensure "client-side filtering" before upload.
 */
/**
 * Video Compression using FFmpeg.wasm
 * 
 * NOTE: This requires Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers
 * to be set on the server serving the app for SharedArrayBuffer to work.
 * Without these headers, this will fail and return the original file.
 */
export async function compressVideo(
    file: File,
    options: Partial<CompressionOptions> = {}
): Promise<File> {
    const opts = { ...DEFAULT_VIDEO_OPTIONS, ...options };

    // Strict Mode: Compress anything larger than 2MB
    if (file.size < 2 * 1024 * 1024) {
        return file;
    }

    try {
        console.log('Starting video compression...');
        // Start with 1% to show activity/downloading
        if (options.onProgress) options.onProgress(1);

        // Dynamically import to split bundle
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();

        // Log to console for debugging
        ffmpeg.on('log', ({ message }) => console.log('FFmpeg:', message));

        // Hook up progress
        // We map encoding progress (0-1) to the 10%-100% range of the total bar
        // leaving the first 10% for the engine download/load phase
        ffmpeg.on('progress', ({ progress }) => {
            const percent = 10 + Math.round(progress * 90);
            if (options.onProgress) options.onProgress(Math.max(10, Math.min(100, percent)));
        });

        // Load ffmpeg.wasm from a CDN
        // This download (~25MB) can take time on first run
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        // Engine loaded
        if (options.onProgress) options.onProgress(10);

        const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
        const outputName = 'output.mp4';

        // Write file to memory
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Run compression command
        // Scale to 720p height (maintain aspect), CRF 28 (good compression), preset ultrafast (fastest encoding)
        await ffmpeg.exec([
            '-i', inputName,
            '-vf', `scale=-2:${opts.maxWidthOrHeight}`,
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart', // optimization for web playback
            outputName
        ]);

        // Read output
        const data = await ffmpeg.readFile(outputName);

        // Create new file
        const newFile = new File([data as BlobPart], file.name.replace(/\.[^/.]+$/, "") + ".mp4", {
            type: 'video/mp4',
            lastModified: Date.now()
        });

        console.log(`Video compressed: ${file.size} -> ${newFile.size}`);

        // Cleanup to free memory
        try {
            // terminate not strictly needed if we let GC handle it, but good practice
            ffmpeg.terminate();
        } catch (e) { /* ignore */ }

        if (newFile.size < file.size) {
            return newFile;
        }
        return file;

    } catch (error) {
        console.error('Video compression failed (likely due to missing COOP/COEP headers or browser support). Fallback to original.', error);
        // Important: Return original file so upload succeeds!
        return file;
    }
}
