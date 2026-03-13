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
    const signalQueueRef = useRef<any[]>([]);
    const isProcessingOfferRef = useRef(false);

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

                // Support both web format (file-start) and mobile format (meta)
                if (message.type === 'file-start' || message.type === 'meta') {
                    const metadata = message.metadata || {
                        name: message.name,
                        size: message.size,
                        type: message.mimeType || message.type_,  // mobile uses 'mimeType'
                    };
                    console.log('Receiving file:', metadata);

                    incomingFileRef.current = metadata;
                    receivedBufferRef.current = [];
                    receivedSizeRef.current = 0;

                    setCurrentFile({ ...metadata, isIncoming: true });
                    setStatus('transferring');
                    setProgress(0);

                    toast({
                        title: 'Incoming File Transfer',
                        description: `Receiving ${metadata.name}...`
                    });
                }
                // Support both web format (file-end) and mobile format (done)
                else if (message.type === 'file-end' || message.type === 'done') {
                    console.log('File transfer complete');

                    const meta = incomingFileRef.current;
                    const blob = new Blob(receivedBufferRef.current, { type: meta?.type });
                    const url = URL.createObjectURL(blob);

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
            ],
            bundlePolicy: 'balanced',
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[P2P] Generated ICE: ${event.candidate.candidate.substring(0, 40)}... type: ${event.candidate.type || 'unknown'}`);
                sendSignal({
                    type: 'file.ice',
                    candidate: event.candidate.toJSON()
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[P2P] ICE Connection State:', pc.iceConnectionState);
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
    // Supports both web format (webrtc.*) and mobile format (file.*)
    const handleSignal = useCallback(async (signal: any) => {
        const pc = pcRef.current;

        // If we don't have a PC yet or are currently busy setting up the offer, queue it
        if (!pc || isProcessingOfferRef.current || (signal.type === 'webrtc.ice' && !pc.remoteDescription)) {
            console.log(`[P2P] Queuing signal ${signal.type} (Ready: ${!!pc}, Desc: ${!!pc?.remoteDescription})`);
            signalQueueRef.current.push(signal);

            // If we don't even have a PC, create it (handles incoming signals when idle)
            if (!pc && (signal.type === 'webrtc.offer' || signal.type === 'file.offer')) {
                createPeerConnection();
                // handleSignal will be re-called via the queue flush later
            }
            return;
        }

        try {
            if (signal.type === 'webrtc.offer' || signal.type === 'file.offer') {
                if (pc.signalingState !== 'stable') {
                    console.log('[P2P] Already processing description, ignoring duplicate offer');
                    return;
                }
                isProcessingOfferRef.current = true;
                console.log('[P2P] Processing offer...');
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                    type: 'file.answer',
                    sdp: answer
                } as any);
                isProcessingOfferRef.current = false;

                // Flush queue now that remote description is set
                const queue = [...signalQueueRef.current];
                signalQueueRef.current = [];
                console.log(`[P2P] Flushing ${queue.length} signals after offer`);
                for (const queuedSig of queue) {
                    await handleSignal(queuedSig);
                }
            }
            else if (signal.type === 'webrtc.answer' || signal.type === 'file.answer') {
                if (pc.signalingState === 'stable') {
                    console.log('[P2P] Already stable, ignoring duplicate answer');
                    return;
                }
                console.log('[P2P] Processing answer...');
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));

                // Flush queue now that remote description is set
                const queue = [...signalQueueRef.current];
                signalQueueRef.current = [];
                console.log(`[P2P] Flushing ${queue.length} signals after answer`);
                for (const queuedSig of queue) {
                    await handleSignal(queuedSig);
                }
            }
            else if (signal.type === 'webrtc.ice' || signal.type === 'file.ice') {
                if (signal.candidate) {
                    console.log('[P2P] Adding ICE candidate');
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            }
        } catch (err) {
            console.error('Error handling P2P signal:', err);
            isProcessingOfferRef.current = false;
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
        const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        sendSignal({
            type: 'file.offer',
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
