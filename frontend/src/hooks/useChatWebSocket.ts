import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface WebSocketMessage {
    type: string;
    message?: any;
    message_id?: string;
    read_by?: number;
    read_at?: string;
    consumed_by?: number;
    consumed_at?: string;
    users?: Array<{ id: number; name: string }>;
    signal?: any;
    sender_id?: number;
    sender_name?: string;
    sender_avatar?: string;
    target_user_id?: number;
}

interface UseChatWebSocketProps {
    chatId: string;
    onMessage?: (message: any) => void;
    onTyping?: (users: Array<{ id: number; name: string }>) => void;
    onMessageRead?: (messageId: string, readBy: number, readAt: string) => void;
    onMessageConsumed?: (messageId: string, consumedBy: number, consumedAt: string) => void;
}

export function useChatWebSocket({
    chatId,
    onMessage,
    onTyping,
    onMessageRead,
    onMessageConsumed,
}: UseChatWebSocketProps) {
    const { user } = useAuth();
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Use refs for callbacks to avoid recreating connect function
    const onMessageRef = useRef(onMessage);
    const onTypingRef = useRef(onTyping);
    const onMessageReadRef = useRef(onMessageRead);
    const onMessageConsumedRef = useRef(onMessageConsumed);

    // Update refs when callbacks change
    useEffect(() => {
        onMessageRef.current = onMessage;
        onTypingRef.current = onTyping;
        onMessageReadRef.current = onMessageRead;
        onMessageConsumedRef.current = onMessageConsumed;
    }, [onMessage, onTyping, onMessageRead, onMessageConsumed]);

    const connect = useCallback(() => {
        if (!chatId || !user) {
            console.warn('[WebSocket] Cannot connect: missing chatId or user', { chatId, user: !!user });
            return;
        }

        // Close existing connection
        if (wsRef.current) {
            console.log('[WebSocket] Closing existing connection');
            wsRef.current.close();
        }

        // WebSocket URL (ws:// for local, wss:// for production)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/chat/${chatId}/`;

        console.log('[WebSocket] Attempting connection...', {
            url: wsUrl,
            chatId,
            userId: user.id,
            protocol,
            hostname: window.location.hostname,
        });

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ [WebSocket] Connected successfully!', {
                    chatId,
                    readyState: ws.readyState,
                    url: wsUrl,
                });
                reconnectAttemptsRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    console.log('📨 [WebSocket] Received:', data.type, data);

                    switch (data.type) {
                        case 'message.new':
                            if (data.message && onMessageRef.current) {
                                console.log('📬 [WebSocket] New message received:', data.message);

                                // Transform WebSocket message format to match frontend Message type
                                const normalizedMessage = {
                                    id: data.message.id,
                                    content: data.message.content,
                                    senderId: data.message.sender_id || data.message.sender,
                                    senderName: data.message.sender_name || data.message.sender,
                                    senderAvatar: data.message.sender_avatar,
                                    timestamp: data.message.timestamp_iso || data.message.timestamp || new Date().toISOString(),
                                    type: (data.message.media_type || data.message.file_type || data.message.message_type || data.message.type || 'text') as any,
                                    mediaUrl: data.message.media_url || data.message.file,
                                    mediaFilename: data.message.media_filename || data.message.filename,
                                    isOneTimeView: data.message.one_time || false,
                                    viewed: data.message.is_read || data.message.consumed || false,
                                    isOwn: String(data.message.sender_id || data.message.sender) === String(user?.id),
                                    replyTo: data.message.reply_to?.id?.toString(),
                                    replyToContent: data.message.reply_to?.content,
                                    replyToSender: data.message.reply_to?.sender_name,
                                    storyReply: data.message.story_reply,
                                };

                                onMessageRef.current(normalizedMessage);
                            }
                            break;

                        case 'typing.update':
                            if (data.users && onTypingRef.current) {
                                console.log('⌨️ [WebSocket] Typing update:', data.users);
                                onTypingRef.current(data.users);
                            }
                            break;

                        case 'message.read':
                            if (data.message_id && data.read_by && data.read_at && onMessageReadRef.current) {
                                onMessageReadRef.current(data.message_id, data.read_by, data.read_at);
                            }
                            break;

                        case 'message.consumed':
                            if (data.message_id && data.consumed_by && data.consumed_at && onMessageConsumedRef.current) {
                                onMessageConsumedRef.current(data.message_id, data.consumed_by, data.consumed_at);
                            }
                            break;

                        default:
                            console.log('[WebSocket] Unhandled message type:', data.type);
                    }
                } catch (error) {
                    console.error('❌ [WebSocket] Error parsing message:', error, event.data);
                }
            };

            ws.onerror = (error) => {
                console.error('❌ [WebSocket] Connection error:', {
                    error,
                    readyState: ws.readyState,
                    url: wsUrl,
                });
            };

            ws.onclose = (event) => {
                console.warn('🔌 [WebSocket] Disconnected:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                    url: wsUrl,
                });

                // Common close codes:
                // 1000 = Normal closure
                // 1006 = Abnormal closure (no close frame)
                // 1008 = Policy violation (auth failure)
                // 1011 = Server error
                if (event.code === 1008) {
                    console.error('❌ [WebSocket] Authentication failed! Check if you are logged in.');
                } else if (event.code === 1006) {
                    console.error('❌ [WebSocket] Connection failed - server may be unreachable or rejecting connection');
                }

                // Attempt to reconnect
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
                    console.log(`🔄 [WebSocket] Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, delay);
                } else {
                    console.error('❌ [WebSocket] Max reconnection attempts reached. Giving up.');
                }
            };
        } catch (error) {
            console.error('❌ [WebSocket] Failed to create WebSocket:', error);
        }
    }, [chatId, user]); // Only depend on chatId and user, not the callbacks

    // Send a message via WebSocket
    const sendMessage = useCallback((content: string, oneTime: boolean = false, replyTo?: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message.send',
                content,
                one_time: oneTime,
                reply_to: replyTo,
            }));
            return true;
        }
        console.warn('[WebSocket] Cannot send message: WebSocket not connected');
        return false;
    }, []);

    // Send typing indicator
    const sendTyping = useCallback((isTyping: boolean) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'typing',
                is_typing: isTyping,
            }));
        }
    }, []);

    // Mark message as read
    const markAsRead = useCallback((messageId: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message.read',
                message_id: messageId,
            }));
        }
    }, []);

    // Connect on mount, disconnect on unmount
    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    return {
        sendMessage,
        sendTyping,
        markAsRead,
        isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    };
}
