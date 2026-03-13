
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Minimize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/Avatar';
import { api } from '@/services/api';
import { API_CONFIG } from '@/config/api.config';

interface Signal {
    type: string;
    sdp?: any;
    candidate?: any;
    sender_id?: string;
    sender?: string;
    audioOnly?: boolean;
}

export default function CallPage() {
    const { chatId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [otherUser, setOtherUser] = useState<any>(null);

    const isAudioOnly = searchParams.get('audio') === 'true';
    const isInitiator = searchParams.get('initiator') === 'true';

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [micEnabled, setMicEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(!isAudioOnly);
    const [mediaReady, setMediaReady] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const hasProcessedOfferRef = useRef<boolean>(false);
    const remoteUserIdRef = useRef<number | string | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const processedSignalIdsRef = useRef<Set<string>>(new Set());

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    useEffect(() => {
        if (!user || !chatId) return;

        // Fetch user details
        const fetchDetails = async () => {
            try {
                const response = await api.getChatDetails(chatId);
                console.log("Chat details for call:", response);
                if (response && response.user) {
                    setOtherUser(response.user);
                }
            } catch (e) {
                console.error("Error fetching other user details:", e);
            }
        };
        fetchDetails();

        const startCall = async () => {
            let stream: MediaStream | undefined;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: !isAudioOnly
                });
                setLocalStream(stream);
                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

            } catch (err: any) {
                console.error("Error accessing media devices:", err);
                const msg = err.name === 'NotAllowedError'
                    ? "Camera/Microphone denied. View-only mode."
                    : "Media error. View-only mode.";
                setErrorMessage(msg);
                setConnectionStatus('failed');
            }

            // Always connect to WS to allow signaling (View-Only if media failed)
            connectWebSocket(stream);
            setMediaReady(true);
        };

        startCall();

        return () => {
            console.log("Cleaning up call...");
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [chatId, user]);

    // Sync local tracks and video preview
    useEffect(() => {
        if (localStream) {
            // Update UI
            if (localVideoRef.current) {
                console.log("Setting local video srcObject");
                localVideoRef.current.srcObject = localStream;
            }

            // Update PeerConnection
            if (peerConnectionRef.current) {
                console.log("Syncing local tracks to PeerConnection");
                const pc = peerConnectionRef.current;
                localStream.getTracks().forEach(track => {
                    const alreadyAdded = pc.getSenders().some(s => s.track === track);
                    if (!alreadyAdded) {
                        pc.addTrack(track, localStream);
                    }
                });
            }
        }
    }, [localStream]);

    // Sync remote video
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            console.log("Setting remote video srcObject", remoteStream.id);
            remoteVideoRef.current.srcObject = remoteStream;

            // Force play just in case
            remoteVideoRef.current.play().catch(e => console.warn("Auto-play blocked or failed", e));
        }
    }, [remoteStream]);

    const connectWebSocket = (stream?: MediaStream) => {
        if (!chatId) return;
        const wsUrl = `${API_CONFIG.wsURL}/ws/call/${chatId}/`;

        console.log('Connecting to Call WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = async () => {
            console.log('Call WebSocket Connected');
            createPeerConnection(stream);

            if (isInitiator) {
                console.log("I am the initiator, creating offer...");
                await createOffer();
            } else {
                console.log("I am NOT the initiator, waiting for offer...");
                // Tell the caller we are ready to receive the offer
                sendSignal({ type: 'webrtc.ready' });
            }
            // Always poll initially
            checkPendingSignals();
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WS Received:", data);
                await handleSignalMessage(data);
            } catch (e) {
                console.error("Error parsing WS message", e);
            }
        };

        ws.onerror = (e) => console.error("WS Error", e);
        ws.onclose = () => console.log("WS Closed");
    };

    const createPeerConnection = (stream?: MediaStream) => {
        if (peerConnectionRef.current) return;

        console.log("Creating new RTCPeerConnection");
        const pc = new RTCPeerConnection(iceServers);
        peerConnectionRef.current = pc;

        const activeStream = stream || localStreamRef.current;
        if (activeStream) {
            console.log("Adding tracks to PeerConnection from local stream");
            activeStream.getTracks().forEach(track => {
                // Prevent duplicate tracks
                const alreadyAdded = pc.getSenders().some(s => s.track === track);
                if (!alreadyAdded) {
                    pc.addTrack(track, activeStream);
                }
            });
        } else {
            console.warn("No local stream available when creating PeerConnection");
        }

        pc.onicecandidate = (event) => {
            console.log("ICE Candidate generated:", event.candidate);
            if (event.candidate) {
                sendSignal({
                    type: 'webrtc.ice',
                    candidate: event.candidate
                });
            } else {
                console.log("End of ICE candidates");
            }
        };

        pc.ontrack = (event) => {
            console.log("Received remote track:", event.track.kind, event.streams[0]?.id);

            if (event.streams && event.streams[0]) {
                // Use the first stream provided
                setRemoteStream(event.streams[0]);
            } else {
                // Fallback: add track to existing stream or create new one
                console.log("No stream in ontrack, creating/updating one from track");
                setRemoteStream(prev => {
                    if (prev) {
                        // Create a new stream object to ensure React detects the change
                        const next = new MediaStream(prev.getTracks());
                        next.addTrack(event.track);
                        return next;
                    }
                    return new MediaStream([event.track]);
                });
            }
            setConnectionStatus('connected');
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE connection state:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                // Potential reconnection logic could go here
                console.warn("ICE connection lost");
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("Peer connection state:", pc.connectionState);
            if (pc.connectionState === 'connected') {
                setConnectionStatus('connected');
            } else if (pc.connectionState === 'disconnected') {
                setConnectionStatus('disconnected');
            } else if (pc.connectionState === 'failed') {
                setConnectionStatus('failed');
                setErrorMessage("Connection failed. Please try again.");
            }
        };
    };

    const createOffer = async () => {
        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log("Offer created and set as local description");
            sendSignal({
                type: 'webrtc.offer',
                sdp: offer,
                audioOnly: isAudioOnly
            });
        } catch (err) {
            console.error("Error creating offer:", err);
        }
    };

    const resendOffer = async () => {
        const pc = peerConnectionRef.current;
        if (!pc && localStreamRef.current) {
            createPeerConnection(localStreamRef.current);
        }

        const currentPc = peerConnectionRef.current;
        if (currentPc?.localDescription) {
            console.log("Resending local offer to ready peer...");
            sendSignal({
                type: 'webrtc.offer',
                sdp: currentPc.localDescription,
                audioOnly: isAudioOnly
            });
        } else {
            console.log("No local description to resend, creating new offer...");
            await createOffer();
        }
    };

    const createAnswer = async () => {
        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({
                type: 'webrtc.answer',
                sdp: answer
            });
        } catch (err) {
            console.error("Error creating answer:", err);
        }
    };

    const candidateQueueRef = useRef<any[]>([]);

    const handleSignalMessage = async (data: any) => {
        // Type-safe self-filter: skip signals sent by us
        if (data.sender_id !== undefined && data.sender_id !== null &&
            String(data.sender_id) === String(user?.id)) return;

        // Record remote user ID from the first signal we get from them
        if (data.sender_id && !remoteUserIdRef.current) {
            console.log("Setting remote user ID for signaling:", data.sender_id);
            remoteUserIdRef.current = data.sender_id;
        }

        const signal = data.payload || data;
        const type = signal.type || data.type;

        if (!peerConnectionRef.current) createPeerConnection();
        const pc = peerConnectionRef.current!;

        if (type === 'webrtc.offer') {
            if (hasProcessedOfferRef.current) return;
            console.log("Processing Offer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            hasProcessedOfferRef.current = true;

            // Process queued candidates
            while (candidateQueueRef.current.length > 0) {
                const candidate = candidateQueueRef.current.shift();
                console.log("Processing queued candidate");
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }

            await createAnswer();

        } else if (type === 'webrtc.answer') {
            if (pc.signalingState !== 'have-local-offer') {
                console.log("Skipping Answer because signaling state is", pc.signalingState);
                return;
            }
            console.log("Processing Answer");
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                // Process queued candidates
                while (candidateQueueRef.current.length > 0) {
                    const candidate = candidateQueueRef.current.shift();
                    console.log("Processing queued candidate");
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) {
                console.warn("Failed to set remote answer:", err);
            }
        } else if (type === 'webrtc.ice') {
            if (signal.candidate) {
                if (pc.remoteDescription) {
                    try {
                        console.log("Adding ICE candidate now");
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } catch (e) {
                        console.warn("Error adding incoming ICE candidate", e);
                    }
                } else {
                    console.log("Queueing ICE candidate (RemoteDesc not set)");
                    candidateQueueRef.current.push(signal.candidate);
                }
            }
        } else if (type === 'webrtc.ready') {
            console.log("Peer reported ready, checking if we need to send offer");
            if (isInitiator) {
                await resendOffer();
            }
        } else if (type === 'call.end') {
            endCall();
        }
    };

    // Periodic polling as fallback for WebRTC signals (important if WS fails or relay is slow)
    useEffect(() => {
        let isConnecting = connectionStatus === 'connecting';
        let pollInterval: NodeJS.Timeout | null = null;

        if (isConnecting && chatId && mediaReady) {
            console.log("Starting signal polling...");
            pollInterval = setInterval(checkPendingSignals, 3000);
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
                console.log("Stopped signal polling.");
            }
        };
    }, [connectionStatus, chatId, mediaReady]);

    const checkPendingSignals = async () => {
        if (!chatId) return;
        try {
            const signals = await api.getP2PSignals(chatId);

            // Filter out signals that are older than our page load (stale test data)
            // We allow a 10s buffer in case the offer was sent just as we were joining
            const freshSignals = signals.filter((s: any) => {
                const signalTime = new Date(s.timestamp).getTime();
                return signalTime > (startTimeRef.current - 10000);
            });

            if (freshSignals.length === 0 && signals.length > 0) {
                console.log(`Skipped ${signals.length} stale signals from previous sessions`);
                return;
            }

            for (const signalObj of freshSignals) {
                // Build a stable ID to deduplicate across poll cycles
                const signalId = `${signalObj.id}_${signalObj.timestamp}`;
                if (processedSignalIdsRef.current.has(signalId)) continue;
                processedSignalIdsRef.current.add(signalId);

                // Determine the inner signal type
                const inner = signalObj.signal || signalObj.signal_data || {};
                const sigType = inner.type;

                // Build a wrapper that preserves sender_id for self-filtering
                const wrapper = {
                    ...inner,
                    sender_id: signalObj.sender_id,
                };

                if (sigType === 'webrtc.offer' && !hasProcessedOfferRef.current) {
                    console.log("Found pending offer from sender:", signalObj.sender_id);
                    await handleSignalMessage(wrapper);
                } else if (sigType === 'webrtc.answer') {
                    console.log("Found pending answer from sender:", signalObj.sender_id);
                    await handleSignalMessage(wrapper);
                } else if (sigType === 'webrtc.ice') {
                    await handleSignalMessage(wrapper);
                } else if (sigType === 'call.end') {
                    console.log("Found pending call.end");
                    await handleSignalMessage(wrapper);
                } else if (sigType === 'webrtc.ready') {
                    await handleSignalMessage(wrapper);
                }
            }
        } catch (e) {
            console.error("Error checking pending signals:", e);
        }
    };

    const sendSignal = (data: any) => {
        // Use remoteUserIdRef if we have it, otherwise fallback to otherUser.id
        const targetId = remoteUserIdRef.current || otherUser?.id || undefined;
        console.log('📤 [CallPage] sendSignal called:', {
            type: data.type,
            targetId,
            wsState: wsRef.current?.readyState,
            wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
            data_summary: data.type
        });

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const jsonStr = JSON.stringify(data);
            wsRef.current.send(jsonStr);
            console.log('✅ [CallPage] Signal sent via WebSocket');
        } else {
            console.warn("⚠️ [CallPage] WS not ready, sending via HTTP");
            if (chatId) {
                api.sendP2PSignal(chatId, targetId ?? '', data);
                console.log('✅ [CallPage] Signal sent via HTTP API to target:', targetId);
            }
        }

        // Concurrent fallback for critical signals
        if (['webrtc.offer', 'webrtc.answer', 'call.end'].includes(data.type)) {
            if (chatId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                api.sendP2PSignal(chatId, targetId ?? '', data).catch(err => console.warn("HTTP fallback failed", err));
                console.log('📨 [CallPage] Concurrent HTTP signal also sent for reliability');
            }
        }
    };

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !micEnabled);
            setMicEnabled(!micEnabled);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
            setVideoEnabled(!videoEnabled);
        }
    };

    const endCall = () => {
        sendSignal({ type: 'call.end' });
        navigate(`/chat/${chatId}`);
    };

    return (
        <div className="h-screen w-screen bg-black relative flex flex-col">
            <div className="flex-1 relative overflow-hidden">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Avatar
                                src={otherUser?.avatar || ''}
                                alt={otherUser?.displayName || 'User'}
                                className="w-24 h-24 mx-auto mb-4"
                            />
                            <p className="text-white text-xl animate-pulse">
                                {connectionStatus === 'failed' ? (
                                    <span className="text-red-500 font-bold">{errorMessage || 'Connection Failed'}</span>
                                ) : connectionStatus === 'connecting' ? 'Connecting...' : 'Waiting for user...'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {!isAudioOnly && (
                <div className="absolute top-4 right-4 w-32 h-48 bg-gray-900 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full ${micEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} transition-all`}
                >
                    {micEnabled ? <Mic className="text-white" /> : <MicOff className="text-white" />}
                </button>

                <button
                    onClick={endCall}
                    className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all scale-110"
                >
                    <PhoneOff className="text-white" />
                </button>

                <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full ${videoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-black'} transition-all`}
                >
                    {videoEnabled ? <Video className={videoEnabled ? "text-white" : "text-black"} /> : <VideoOff className="text-black" />}
                </button>
            </div>
        </div>
    );
}
