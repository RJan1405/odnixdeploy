import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, AtSign, UserPlus, Flag, AlertTriangle } from 'lucide-react';
import { Avatar } from './Avatar';
import { api, Notification } from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationWebSocket, notificationWS } from '@/services/websocket';

const notificationIcons: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  repost: Repeat2,
  mention: AtSign,
  connection_request: UserPlus,
  follow: UserPlus,
  omzo_like: Heart,
  omzo_comment: MessageCircle,
  reply: MessageCircle,
  post_report: Flag,
  omzo_report: Flag,
  report: AlertTriangle
};

const notificationColors: Record<string, string> = {
  like: 'text-destructive bg-destructive/20',
  comment: 'text-primary bg-primary/20',
  repost: 'text-success bg-success/20',
  mention: 'text-accent bg-accent/20',
  connection_request: 'text-warning bg-warning/20',
  follow: 'text-warning bg-warning/20',
  omzo_like: 'text-destructive bg-destructive/20',
  omzo_comment: 'text-primary bg-primary/20',
  reply: 'text-primary bg-primary/20',
  post_report: 'text-destructive bg-destructive/20',
  omzo_report: 'text-destructive bg-destructive/20',
  report: 'text-destructive bg-destructive/20'
};

export function NotificationDropdown() {
  const { notificationsOpen, toggleNotifications } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      setNotifications([]);
    }
  };

  useEffect(() => {
    if (notificationsOpen && user) {
      fetchNotifications();
      // Mark all notifications as read after a short delay
      setTimeout(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }, 1000);
    }
  }, [notificationsOpen, user]);

  // WebSocket connection for real-time notification updates
  useEffect(() => {
    if (!user) return;

    // Use singleton to avoid duplicate connections
    notificationWS.connect();

    // Handle incoming notifications
    const handleNotification = (data: any) => {
      console.log('🔔 Real-time notification received in Dropdown:', data);

      // If it's a notification type event, refresh the list
      if (['like', 'comment', 'follow', 'repost', 'mention', 'omzo_like', 'omzo_comment', 'post_report', 'omzo_report', 'report'].includes(data.type)) {
        fetchNotifications();
      }
    };

    notificationWS.addMessageHandler(handleNotification);

    return () => {
      notificationWS.removeMessageHandler(handleNotification);
    };
  }, [user]);

  // Safely calculate unread count with fallback
  const unreadCount = Array.isArray(notifications)
    ? notifications.filter(n => !n.read).length
    : 0;

  return (
    <div className="relative">
      <button
        onClick={toggleNotifications}
        className="relative p-2 hover:bg-secondary rounded-xl transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {notificationsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={toggleNotifications}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 bg-background border border-border/50 rounded-2xl overflow-hidden z-50 shadow-elevated"
            >
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!Array.isArray(notifications) || notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(notification => {
                    const Icon = notificationIcons[notification.type] || MessageCircle;
                    return (
                      <motion.div
                        key={notification.id}
                        whileHover={{ backgroundColor: 'hsl(var(--secondary) / 0.5)' }}
                        className={cn(
                          'flex items-start gap-3 p-4 cursor-pointer transition-colors',
                          !notification.read && 'bg-primary/5'
                        )}
                      >
                        <Avatar
                          src={notification.user.avatar}
                          alt={notification.user.username}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{notification.user.username}</span>
                            {' '}{notification.content}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <div className={cn(
                          'p-2 rounded-lg',
                          notificationColors[notification.type] || 'text-start bg-primary/20'
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
