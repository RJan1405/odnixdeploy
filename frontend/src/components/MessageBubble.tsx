import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Lock, Share2 } from 'lucide-react';
import type { Message } from '@/services/api';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const isMedia = (message.type as string) !== 'text';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'flex mb-2',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] relative',
          isOwn ? 'message-sent' : 'message-received',
          isMedia ? 'p-1' : 'px-4 py-2'
        )}
      >
        {/* Media Rendering */}
        {message.type === 'image' && (message.mediaUrl || message.content) && (
          <div className="relative w-full max-w-[280px] h-fit overflow-hidden rounded-xl">
            <img
              src={message.mediaUrl || message.content}
              alt="Shared image"
              className="w-full h-auto max-h-[320px] object-cover transition-transform hover:scale-105 duration-300 pointer-events-auto"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}

        {message.type === 'video' && (message.mediaUrl || message.content) && (
          <div className="relative w-full max-w-[280px] h-fit overflow-hidden rounded-xl bg-black/10">
            <video
              src={message.mediaUrl || message.content}
              className="w-full h-auto max-h-[320px] object-cover"
              controls
            />
          </div>
        )}

        {(message.type === 'audio' || (message as any).file_type === 'audio') && (message.mediaUrl || message.content) && (
          <audio
            src={message.mediaUrl || message.content}
            className="w-full max-w-[240px] h-10 mt-1"
            controls
          />
        )}

        {(message.type === 'file' || message.type === 'document') && (message.mediaUrl || message.content) && (
          <a
            href={message.mediaUrl || message.content}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors",
              isOwn ? "text-primary-foreground" : "text-foreground"
            )}
          >
            <div className="p-2 bg-background/20 rounded-lg">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.mediaFilename || (message.content && !message.content.includes('/') ? message.content : 'Download File')}
              </p>
              <p className="text-[10px] opacity-70 uppercase">
                {message.type}
              </p>
            </div>
          </a>
        )}

        {((message.type as string) === 'text' || (message.content && !message.content.startsWith('Sent '))) && (
          <p className={cn(
            'text-sm',
            isOwn ? 'text-primary-foreground' : 'text-foreground',
            (message.type as string) !== 'text' && 'mt-2 opacity-90'
          )}>
            {message.content}
          </p>
        )}

        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOwn ? 'justify-end' : 'justify-start',
          isMedia && 'px-2 pb-1'
        )}>
          {message.isOneTimeView && (
            <Lock className="w-3 h-3 text-muted-foreground" />
          )}
          <span className={cn(
            'text-[10px]',
            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {(() => {
              if (!message.timestamp) return '';

              // If it's already a formatted time like "10:30 PM", just return it
              if (typeof message.timestamp === 'string' && /^\d{1,2}:\d{2}/.test(message.timestamp)) {
                return message.timestamp;
              }

              const date = typeof message.timestamp === 'string'
                ? new Date(message.timestamp)
                : message.timestamp;

              if (!date || isNaN(date.getTime())) {
                return typeof message.timestamp === 'string' ? message.timestamp : '';
              }

              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}
          </span>
          {isOwn && (
            message.viewed
              ? <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
              : <Check className="w-3 h-3 text-primary-foreground/70" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
