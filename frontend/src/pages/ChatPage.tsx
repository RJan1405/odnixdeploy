import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Video,
  Info,
  Image,
  Share2,
  Send,
  Lock,
  Eye,
  BadgeCheck,
  PlusCircle,
  X,
  Reply as ReplyIcon
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MessageBubble } from '@/components/MessageBubble';
import { api, Chat, Message } from '@/services/api';
import { cn } from '@/lib/utils';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [isOneTimeView, setIsOneTimeView] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const isTouchingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Moved hooks from below to avoid conditional execution
  const { openUploadModal } = useAppStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // WebSocket integration for real-time messaging
  const { sendMessage: sendWsMessage, sendTyping, isConnected } = useChatWebSocket({
    chatId: chatId || '',
    onMessage: (newMessage) => {
      console.log('[ChatPage] Received real-time message:', newMessage);
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      // Mark as read only if it's an incoming message AND user is currently viewing the chat
      const isIncoming = String(newMessage.senderId) !== String(user?.id);
      const isVisible = document.visibilityState === 'visible';

      if (chatId && isIncoming && isVisible && isMountedRef.current) {
        api.markMessagesRead(chatId);
      }
    },
    onTyping: (users) => {
      setTypingUsers(users);
    },
    onMessageRead: (messageId, readBy, readAt) => {
      console.log('[ChatPage] Message read by:', readBy, 'last message id:', messageId);
      const lastReadIdNum = parseInt(String(messageId));

      setMessages(prev => prev.map(m => {
        // Direct match
        if (String(m.id) === String(messageId)) return { ...m, viewed: true };

        // If it's our own message and we have numeric IDs, mark as read if it's earlier than the broadcasted ID
        if (m.isOwn && !m.viewed && !isNaN(lastReadIdNum)) {
          const currentMsgIdNum = parseInt(String(m.id));
          if (!isNaN(currentMsgIdNum) && currentMsgIdNum <= lastReadIdNum) {
            return { ...m, viewed: true };
          }
        }

        return m;
      }));
    }
  });

  useEffect(() => {
    if (!chatId) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching chat details for ID:', chatId);
        const [c, msgs] = await Promise.all([
          api.getChatDetails(chatId),
          api.getMessages(chatId)
        ]);
        console.log('Chat details:', c);
        if (c) {
          setChat(c);
        } else {
          setError("Chat not found (API returned null)");
        }
        setMessages(Array.isArray(msgs) ? msgs : []);

        // Mark as read when opening chat
        if (chatId) {
          api.markMessagesRead(chatId);
        }
      } catch (err: any) {
        console.error('Failed to load chat:', err);
        setError(err.message || 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [chatId]);

  // Refresh messages function
  const refreshMessages = async () => {
    if (!chatId) return;
    try {
      const msgs = await api.getMessages(chatId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('Failed to refresh messages:', err);
    }
  };

  // Mark as read when window/tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && chatId) {
        api.markMessagesRead(chatId);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [chatId]);

  // Proactively mark messages as read if any are unread and window is visible
  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!chatId || document.visibilityState !== 'visible' || !isMountedRef.current) return;

    const hasUnread = messages.some(m => !m.isOwn && !m.viewed);
    if (hasUnread) {
      console.log('[ChatPage] Proactively marking messages as read');
      api.markMessagesRead(chatId);
    }
  }, [messages, chatId]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    setUploading(true);
    try {
      const sentMsg = await api.sendMessage(chatId, '', file);
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
      }
    } catch (err: any) {
      console.error('Failed to send media:', err);
      toast({
        title: 'Failed to upload media',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleP2PFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // TODO: implement real P2P transfer. For now, just log selected files.
    console.log('Starting P2P transfer to', chat?.user.username, files);
    toast({ title: 'P2P transfer started', description: `${files.length} file(s) selected for P2P send.` });
    // clear input
    e.currentTarget.value = '';
  };

  const scrollToBottom = (smooth = false) => {
    if (containerRef.current) {
      if (smooth) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  };

  const isNearBottom = () => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
  };

  // Scroll to bottom when loading finishes (Initial load)
  // useLayoutEffect ensures this happens BEFORE paint, so it looks instant
  useLayoutEffect(() => {
    if (!loading && containerRef.current) {
      scrollToBottom(false); // Instant scroll
    }
  }, [loading, messages]); // Add messages to ensure it stays at bottom on initial render sequence

  useEffect(() => {
    // Only auto-scroll if user is already near the bottom
    if (isNearBottom()) {
      scrollToBottom(true); // Smooth scroll for new messages
    }
  }, [messages]);

  useEffect(() => {
    // VisualViewport helps on Android to detect virtual keyboard size
    const onResize = () => {
      const vv = (window as any).visualViewport;
      const heightDiff = window.innerHeight - (vv ? vv.height : window.innerHeight);
      setKeyboardOffset(heightDiff > 0 ? heightDiff : 0);
      // when keyboard appears, scroll messages into view
      setTimeout(() => scrollToBottom(true), 50);
    };

    onResize();
    if ((window as any).visualViewport) {
      (window as any).visualViewport.addEventListener('resize', onResize);
      (window as any).visualViewport.addEventListener('scroll', onResize);
    }
    window.addEventListener('resize', onResize);

    return () => {
      if ((window as any).visualViewport) {
        (window as any).visualViewport.removeEventListener('resize', onResize);
        (window as any).visualViewport.removeEventListener('scroll', onResize);
      }
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const bar = inputBarRef.current;
    if (!bar) return;

    const onTouchStart = () => {
      isTouchingRef.current = true;
    };
    const onTouchEnd = () => {
      isTouchingRef.current = false;
    };

    // Prevent the page from moving when dragging inside the input bar area.
    const onTouchMove = (e: TouchEvent) => {
      if (isTouchingRef.current) {
        e.preventDefault();
      }
    };

    bar.addEventListener('touchstart', onTouchStart, { passive: true });
    bar.addEventListener('touchend', onTouchEnd, { passive: true });
    // document-level listener needs passive: false so preventDefault works
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      bar.removeEventListener('touchstart', onTouchStart);
      bar.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchmove', onTouchMove as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p>Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-destructive p-6 text-center">
        <div className="bg-destructive/10 p-4 rounded-xl mb-4">
          <p className="font-bold mb-1">Error Loading Chat</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => navigate('/mobile/messages')}
          className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Chat not found</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!message.trim() || !chatId) return;

    const messageText = message.trim();
    const replyToId = replyingTo?.id;
    setMessage(''); // Clear input immediately for better UX
    setReplyingTo(null); // Clear reply state

    // Try WebSocket first (instant), fallback to HTTP
    if (isConnected) {
      const sent = sendWsMessage(messageText, isOneTimeView, replyToId);
      if (sent) {
        console.log('[ChatPage] Message sent via WebSocket', { replyToId });
        setIsOneTimeView(false);
        // Stop typing indicator
        sendTyping(false);
        return;
      }
    }

    // Fallback to HTTP if WebSocket fails
    try {
      console.log('[ChatPage] Sending message via HTTP fallback');
      const sentMsg = await api.sendMessage(chatId, messageText, undefined, replyToId);
      if (sentMsg) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === sentMsg.id)) {
            return prev;
          }
          return [...prev, sentMsg];
        });
        setIsOneTimeView(false);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      toast({
        title: 'Failed to send message',
        description: 'Please try again',
        variant: 'destructive',
      });
      // Restore message on error
      setMessage(messageText);
      if (replyToId) {
        setReplyingTo(messages.find(m => m.id === replyToId) || null);
      }
    }
  };

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setMessage(value);

    // Send typing indicator
    if (isConnected) {
      sendTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    }
  };

  const handleP2PClick = () => {
    if (!chat?.user.isOnline) {
      toast({ title: 'User is offline', description: 'P2P file transfer requires the recipient to be online.' });
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <div className="bg-background border-b border-border/50 safe-top fixed top-0 left-0 right-0 z-30 h-16">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>

            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => chat?.user?.id && navigate(`/profile/${chat.user.id}`)}
            >
              <Avatar
                src={chat?.user?.avatar || ''}
                alt={chat?.user?.username || 'User'}
                size="md"
                isOnline={chat?.user?.isOnline}
              />
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-foreground">{chat?.user?.displayName || 'Unknown'}</p>
                  {chat?.user?.isVerified && (
                    <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {chat?.user?.isOnline ? 'Online' : 'Offline'}
                  {isConnected && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Real-time
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Audio Call Button */}
            <button
              onClick={() => navigate(`/call/${chatId}?audio=true&initiator=true`)}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
              title="Audio Call"
            >
              <Phone className="w-5 h-5 text-foreground" />
            </button>

            {/* Video Call Button */}
            <button
              onClick={() => navigate(`/call/${chatId}?initiator=true`)}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
              title="Video Call"
            >
              <Video className="w-5 h-5 text-foreground" />
            </button>

            {/* Info Button */}
            <button
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
              title="Chat Info"
            >
              <Info className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area - Added scroll-auto to override global scroll-smooth */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-auto p-4 pt-[calc(4rem+env(safe-area-inset-top))]"
        style={{ paddingBottom: `calc(4rem + env(safe-area-inset-bottom) + ${keyboardOffset}px)` }}
      >
        {chat?.isNewRequest && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              This user wants to send you a message
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id || Math.random()}
            message={msg}
            isOwn={msg.isOwn !== undefined ? msg.isOwn : (String(msg.senderId) === 'me' || String(msg.senderId) === String(user?.id || ''))}
            onMessageUpdate={refreshMessages}
            onReply={setReplyingTo}
          />
        ))}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div
        ref={inputBarRef}
        className="fixed left-0 right-0 z-30 bg-background border-t border-border/50"
        style={{
          bottom: `calc(${keyboardOffset}px + env(safe-area-inset-bottom))`
        }}
      >
        {/* Reply Preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border/50">
            <ReplyIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Replying to {replyingTo.isOwn ? 'yourself' : chat?.user?.displayName}</p>
              <p className="text-sm text-foreground truncate">
                {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type}]`}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-background rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            ref={mediaInputRef}
            type="file"
            className="hidden"
            accept="*/*"
            onChange={handleMediaSelect}
          />
          <button
            onClick={() => mediaInputRef.current?.click()}
            disabled={uploading}
            className="p-3.5 bg-secondary text-foreground rounded-2xl hover:bg-secondary/80 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            value={message}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={uploading}
            className="w-full py-3.5 px-4 bg-secondary rounded-2xl text-foreground outline-none border border-transparent focus:border-primary/30 transition-all font-medium"
          />

          <button
            onClick={handleSend}
            disabled={(!message.trim() && !uploading) || uploading}
            className={cn(
              "p-3.5 rounded-2xl transition-all",
              (message.trim() && !uploading) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-100" : "bg-secondary text-muted-foreground scale-95"
            )}
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
