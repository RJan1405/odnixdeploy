import { API_CONFIG } from '@/config/api.config';

export type WebSocketMessage = {
    type: string;
    [key: string]: any;
};

export class ChatWebSocket {
    private ws: WebSocket | null = null;
    private chatId: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private messageHandlers: ((data: WebSocketMessage) => void)[] = [];

    constructor(chatId: string) {
        this.chatId = chatId;
    }

    connect(onMessage?: (data: WebSocketMessage) => void) {
        if (onMessage) {
            this.messageHandlers.push(onMessage);
        }

        const wsUrl = `${API_CONFIG.wsURL}/ws/chat/${this.chatId}/`;
        console.log('Connecting to WebSocket:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected to chat:', this.chatId);
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);

                    // Call all registered message handlers
                    this.messageHandlers.forEach(handler => handler(data));
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.ws = null;

                // Attempt to reconnect if not a normal closure
                if (event.code !== 1000 && event.code !== 1001) {
                    this.reconnect();
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.reconnect();
        }
    }

    private reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

            console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    send(data: WebSocketMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
                console.log('WebSocket message sent:', data);
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        } else {
            console.warn('WebSocket is not connected. Message not sent:', data);
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.messageHandlers = [];
        this.reconnectAttempts = 0;
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    addMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }
}

/**
 * WebSocket for real-time notifications (new messages, calls, follows, etc.)
 */
export class NotificationWebSocket {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private messageHandlers: ((data: WebSocketMessage) => void)[] = [];

    connect(onMessage?: (data: WebSocketMessage) => void) {
        if (onMessage) {
            this.messageHandlers.push(onMessage);
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('🔔 Notification WebSocket already connected');
            return;
        }

        const wsUrl = `${API_CONFIG.wsURL}/ws/notify/`;
        console.log('🔔 Connecting to Notification WebSocket:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Notification WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Notification received:', data);
                    this.messageHandlers.forEach(handler => handler(data));
                } catch (error) {
                    console.error('Error parsing notification:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ Notification WebSocket error:', error);
            };

            this.ws.onclose = (event) => {
                console.log('🔌 Notification WebSocket closed');
                this.ws = null;
                if (event.code !== 1000 && event.code !== 1001) {
                    this.reconnect();
                }
            };
        } catch (error) {
            console.error('Error creating Notification WebSocket:', error);
            this.reconnect();
        }
    }

    private reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

            console.log(`Reconnecting notification WS in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, delay);
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.messageHandlers = [];
    }

    addMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }
}

export const notificationWS = new NotificationWebSocket();

/**
 * WebSocket for real-time sidebar/chat list updates
 */
export class SidebarWebSocket {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private messageHandlers: ((data: WebSocketMessage) => void)[] = [];

    connect(onMessage?: (data: WebSocketMessage) => void) {
        if (onMessage) {
            this.messageHandlers.push(onMessage);
        }

        const wsUrl = `${API_CONFIG.wsURL}/ws/sidebar/`;
        console.log('💬 Connecting to Sidebar WebSocket:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Sidebar WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Sidebar update received:', data);
                    this.messageHandlers.forEach(handler => handler(data));
                } catch (error) {
                    console.error('Error parsing sidebar update:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ Sidebar WebSocket error:', error);
            };

            this.ws.onclose = (event) => {
                console.log('🔌 Sidebar WebSocket closed');
                this.ws = null;
                if (event.code !== 1000 && event.code !== 1001) {
                    this.reconnect();
                }
            };
        } catch (error) {
            console.error('Error creating Sidebar WebSocket:', error);
            this.reconnect();
        }
    }

    private reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

            console.log(`Reconnecting sidebar WS in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, delay);
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.messageHandlers = [];
    }

    addMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (data: WebSocketMessage) => void) {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }
}
