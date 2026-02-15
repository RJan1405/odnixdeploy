import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface P2PSignal {
    type: 'webrtc.offer' | 'webrtc.answer' | 'webrtc.ice';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

interface FileMetadata {
    name: string;
    size: number;
    type: string;
}

const CHUNK_SIZE = 16384; // 16KB

export function useP2PFileTransfer(
    sendSignal: (signal: P2PSignal, targetUserId?: number) => void,
    chatId: string,
    currentUserId: string,
    onComplete?: (file: FileMetadata, type: 'sent' | 'received') => void
) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState<(FileMetadata & { isIncoming: boolean }) | null>(null);

    // Refs for internal logic (unaffected by render cycles)
    const incomingFileRef = useRef<FileMetadata | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const receivedBufferRef = useRef<ArrayBuffer[]>([]);
    const receivedSizeRef = useRef(0);

    const { toast } = useToast();

    // Store callback in ref
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Reset state
    const reset = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }
        receivedBufferRef.current = [];
        receivedSizeRef.current = 0;

        incomingFileRef.current = null;
        setCurrentFile(null);
        setProgress(0);
        setStatus('idle');
    }, []);

    const handleDataChannelMessage = useCallback((event: MessageEvent) => {
        const data = event.data;

        if (typeof data === 'string') {
            try {
                const message = JSON.parse(data);
                if (message.type === 'file-start') {
                    console.log('Receiving file:', message.metadata);

                    // Update Refs
                    incomingFileRef.current = message.metadata;
                    receivedBufferRef.current = [];
                    receivedSizeRef.current = 0;

                    // Update UI State
                    setCurrentFile({ ...message.metadata, isIncoming: true });
                    setStatus('transferring');
                    setProgress(0);

                    toast({
                        title: 'Incoming File Transfer',
                        description: `Receiving ${message.metadata.name}...`
                    });
                } else if (message.type === 'file-end') {
                    console.log('File transfer complete');

                    // Use Ref for robust access to metadata
                    const meta = incomingFileRef.current;
                    const blob = new Blob(receivedBufferRef.current, { type: meta?.type });
                    const url = URL.createObjectURL(blob);

                    // Trigger download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = meta?.name || 'downloaded_file';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    setStatus('completed');
                    toast({
                        title: 'File Received',
                        description: `${meta?.name} has been downloaded.`
                    });

                    if (meta && onCompleteRef.current) {
                        onCompleteRef.current(meta, 'received');
                    }

                    // Reset after short delay
                    setTimeout(reset, 2000);
                }
            } catch (e) {
                console.error('Error parsing signaling message on data channel:', e);
            }
        } else if (data instanceof ArrayBuffer) {
            // Binary chunk
            receivedBufferRef.current.push(data);
            receivedSizeRef.current += data.byteLength;

            if (incomingFileRef.current) {
                const percent = Math.round((receivedSizeRef.current / incomingFileRef.current.size) * 100);
                setProgress(percent);
            }
        }
    }, [reset, toast]);

    const setupDataChannel = useCallback((channel: RTCDataChannel) => {
        dataChannelRef.current = channel;
        channel.onopen = () => {
            console.log('Data Channel Open');
            setStatus('connected');
        };
        channel.onmessage = handleDataChannelMessage;
    }, [handleDataChannelMessage]);

    // Initialize PeerConnection
    const createPeerConnection = useCallback(() => {
        if (pcRef.current) return pcRef.current;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'webrtc.ice',
                    candidate: event.candidate.toJSON()
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('P2P Connection State:', pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setStatus('failed');
                toast({
                    title: 'P2P Connection Lost',
                    description: 'The peer connection broke.',
                    variant: 'destructive'
                });
                setTimeout(reset, 2000);
            }
        };

        pc.ondatachannel = (event) => {
            console.log('Received Data Channel');
            setupDataChannel(event.channel);
        };

        pcRef.current = pc;
        return pc;
    }, [sendSignal, toast, setupDataChannel, reset]);

    // Handle incoming signals from WebSocket
    const handleSignal = useCallback(async (signal: P2PSignal) => {
        if (!pcRef.current) {
            createPeerConnection();
        }
        const pc = pcRef.current!;

        try {
            if (signal.type === 'webrtc.offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                    type: 'webrtc.answer',
                    sdp: answer
                });
            } else if (signal.type === 'webrtc.answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
            } else if (signal.type === 'webrtc.ice') {
                if (signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            }
        } catch (err) {
            console.error('Error handling P2P signal:', err);
        }
    }, [createPeerConnection, sendSignal]);

    // Start sending a file
    const sendFile = useCallback(async (file: File) => {
        reset();
        setStatus('connecting');

        // Update UI State immediately
        setCurrentFile({
            name: file.name,
            size: file.size,
            type: file.type,
            isIncoming: false
        });

        const pc = createPeerConnection();

        const channel = pc.createDataChannel('file-transfer');
        setupDataChannel(channel);

        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
            type: 'webrtc.offer',
            sdp: offer
        });

        // Wait for channel to open
        channel.onopen = async () => {
            console.log('Channel Open, starting transfer');
            setStatus('transferring');

            // Send Metadata
            channel.send(JSON.stringify({
                type: 'file-start',
                metadata: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            }));

            // Send Chunks
            const reader = new FileReader();
            let offset = 0;

            const readSlice = (o: number) => {
                const slice = file.slice(o, o + CHUNK_SIZE);
                reader.readAsArrayBuffer(slice);
            };

            reader.onload = (e) => {
                if (e.target?.readyState !== FileReader.DONE) return;

                const buffer = e.target.result as ArrayBuffer;

                // Check if channel is still open
                if (channel.readyState !== 'open') {
                    console.error('Data channel closed unexpectedly');
                    setStatus('failed');
                    return;
                }

                channel.send(buffer);
                offset += buffer.byteLength;

                const percent = Math.round((offset / file.size) * 100);
                setProgress(percent);

                if (offset < file.size) {
                    if (channel.bufferedAmount > 8 * 1024 * 1024) { // 8MB high-water mark
                        const checkBuffer = () => {
                            if (channel.bufferedAmount < 1 * 1024 * 1024) { // 1MB low-water mark
                                readSlice(offset);
                            } else {
                                setTimeout(checkBuffer, 20);
                            }
                        };
                        checkBuffer();
                    } else {
                        // Fast path
                        readSlice(offset);
                    }
                } else {
                    // Done
                    channel.send(JSON.stringify({ type: 'file-end' }));
                    setStatus('completed');
                    toast({
                        title: 'Transfer Complete',
                        description: `Sent ${file.name} successfully.`
                    });

                    if (onCompleteRef.current) {
                        onCompleteRef.current({
                            name: file.name,
                            size: file.size,
                            type: file.type
                        }, 'sent');
                    }

                    setTimeout(reset, 2000);
                }
            };

            readSlice(0);
        };

    }, [createPeerConnection, sendSignal, setupDataChannel, reset, toast]);

    return {
        status,
        progress,
        currentFile,
        sendFile,
        handleSignal,
        reset
    };
}
