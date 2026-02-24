
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

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const hasProcessedOfferRef = useRef<boolean>(false);

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

    // Sync local video
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            console.log("Setting local video srcObject");
            localVideoRef.current.srcObject = localStream;
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
                pc.addTrack(track, activeStream);
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

            // Prefer streams[0] if available
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                // Fallback: create a new MediaStream from the solitary track
                console.log("No stream in ontrack, creating one from track");
                setRemoteStream(prev => {
                    if (prev) {
                        prev.addTrack(event.track);
                        return prev;
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
            sendSignal({
                type: 'webrtc.offer',
                sdp: offer,
                audioOnly: isAudioOnly
            });
        } catch (err) {
            console.error("Error creating offer:", err);
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
        if (data.sender_id === user?.id) return;

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
            console.log("Processing Answer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            // Process queued candidates
            while (candidateQueueRef.current.length > 0) {
                const candidate = candidateQueueRef.current.shift();
                console.log("Processing queued candidate");
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }

        } else if (type === 'webrtc.ice') {
            if (signal.candidate) {
                if (pc.remoteDescription) {
                    console.log("Adding ICE candidate now");
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } else {
                    console.log("Queueing ICE candidate (RemoteDesc not set)");
                    candidateQueueRef.current.push(signal.candidate);
                }
            }
        } else if (type === 'call.end') {
            endCall();
        }
    };

    // Periodic polling as fallback for WebRTC signals (important if WS fails or relay is slow)
    useEffect(() => {
        let isConnecting = connectionStatus === 'connecting';
        let pollInterval: NodeJS.Timeout | null = null;

        if (isConnecting && chatId) {
            console.log("Starting signal polling...");
            pollInterval = setInterval(checkPendingSignals, 3000);
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
                console.log("Stopped signal polling.");
            }
        };
    }, [connectionStatus, chatId]);

    const checkPendingSignals = async () => {
        if (!chatId) return;
        try {
            const signals = await api.getP2PSignals(chatId);
            console.log("Pending signals received:", signals);

            // Debug: Log all signals and parse if string
            signals.forEach(s => {
                if (typeof s.signal === 'string') {
                    try { s.signal = JSON.parse(s.signal); } catch (e) { console.error("Parse error", e); }
                }
                console.log("Signal in DB:", s.signal?.type, s);
            });

            // Fix: Backend returns 'signal' key, not 'signal_data'
            const offer = signals.find(s => (s.signal?.type === 'webrtc.offer') || (s.signal_data?.type === 'webrtc.offer'));
            if (offer && !hasProcessedOfferRef.current) {
                console.log("Found pending offer:", offer);
                await handleSignalMessage(offer.signal || offer.signal_data);
            }

            // Fallback: check type OR presence of 'candidate' property
            const candidates = signals.filter(s =>
                (s.signal?.type === 'webrtc.ice') ||
                (s.signal_data?.type === 'webrtc.ice') ||
                (s.signal?.candidate)
            );
            console.log(`Found ${candidates.length} pending candidates`);
            for (const c of candidates) {
                await handleSignalMessage(c.signal || c.signal_data);
            }
        } catch (e) {
            console.error("Error checking pending signals:", e);
        }
    };

    const sendSignal = (data: any) => {
        console.log('📤 [CallPage] sendSignal called:', {
            type: data.type,
            wsState: wsRef.current?.readyState,
            wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
            data: data
        });

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const jsonStr = JSON.stringify(data);
            console.log('📤 [CallPage] Sending via WebSocket:', jsonStr.substring(0, 200));
            wsRef.current.send(jsonStr);
            console.log('✅ [CallPage] Signal sent via WebSocket');
        } else {
            console.warn("⚠️ [CallPage] WS not ready, sending via HTTP", {
                wsState: wsRef.current?.readyState,
                wsExists: !!wsRef.current
            });
            if (chatId) {
                api.sendP2PSignal(chatId, data);
                console.log('✅ [CallPage] Signal sent via HTTP API');
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
