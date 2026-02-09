
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationWS } from '@/services/websocket';
import { Avatar } from '@/components/Avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface CallNotification {
    chat_id: string;
    from_user_id: string;
    from_username?: string;
    from_full_name?: string;
    from_avatar?: string;
    audioOnly?: boolean;
}

export const CallNotificationHandler: React.FC = () => {
    const [incomingCall, setIncomingCall] = useState<CallNotification | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Ensure the socket is connected (idempotent)
        notificationWS.connect();

        const handleMessage = (data: any) => {
            if (data.type === 'incoming.call') {
                console.log("Incoming call received:", data);
                setIncomingCall({
                    chat_id: data.chat_id,
                    from_user_id: data.from_user_id,
                    from_username: data.from_username,
                    from_full_name: data.from_full_name,
                    from_avatar: data.from_avatar,
                    audioOnly: data.audioOnly
                });

                // Optional: Play ringtone here
            }
        };

        notificationWS.addMessageHandler(handleMessage);

        return () => {
            notificationWS.removeMessageHandler(handleMessage);
        };
    }, []);

    const handleAccept = () => {
        if (!incomingCall) return;
        // Determine if audio only context needed
        const audioParam = incomingCall.audioOnly ? '?audio=true' : '';
        navigate(`/call/${incomingCall.chat_id}${audioParam}`);
        setIncomingCall(null);
    };

    const handleDecline = () => {
        setIncomingCall(null);
        // Optional: Send decline signal
    };

    if (!incomingCall) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center gap-6">

                <div className="flex flex-col items-center gap-2">
                    <Avatar
                        src={incomingCall.from_avatar || ''}
                        alt={incomingCall.from_full_name || 'Caller'}
                        className="w-24 h-24 border-4 border-primary/20"
                    />
                    <div className="text-center">
                        <h3 className="text-xl font-bold">{incomingCall.from_full_name || 'Unknown User'}</h3>
                        <p className="text-muted-foreground">
                            Incoming {incomingCall.audioOnly ? 'Audio' : 'Video'} Call...
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-8 w-full justify-center">
                    <button
                        onClick={handleDecline}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500 transition-colors duration-300">
                            <PhoneOff className="w-6 h-6 text-red-500 group-hover:text-white" />
                        </div>
                        <span className="text-xs text-red-500 font-medium">Decline</span>
                    </button>

                    <button
                        onClick={handleAccept}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500 transition-colors duration-300 animate-pulse">
                            {incomingCall.audioOnly ? (
                                <Phone className="w-6 h-6 text-green-500 group-hover:text-white" />
                            ) : (
                                <Video className="w-6 h-6 text-green-500 group-hover:text-white" />
                            )}
                        </div>
                        <span className="text-xs text-green-500 font-medium">Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
