import { Avatar } from './Avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@/services/api';
import { motion } from 'framer-motion';
import { BadgeCheck } from 'lucide-react';

interface ChatItemProps {
  chat: Chat;
  onClick: () => void;
}

export function ChatItem({ chat, onClick }: ChatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: 'hsl(var(--secondary) / 0.5)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
        'border border-transparent hover:border-border/50'
      )}
    >
      <Avatar
        src={chat.user.avatar}
        alt={chat.user.username}
        size="lg"
        isOnline={chat.user.isOnline}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <span className="font-semibold text-foreground truncate">
              {chat.user.displayName}
            </span>
            {chat.user.isVerified && (
              <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(chat.timestamp, { addSuffix: false })}
          </span>
        </div>
        <p className={cn(
          'text-sm truncate mt-0.5',
          chat.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
        )}>
          {chat.lastMessage}
        </p>
      </div>

      {chat.unreadCount > 0 && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">
            {chat.unreadCount}
          </span>
        </div>
      )}
    </motion.div>
  );
}
