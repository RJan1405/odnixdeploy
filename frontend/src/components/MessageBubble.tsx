import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Lock, Share2, Reply as ReplyIcon } from 'lucide-react';
import type { Message } from '@/services/api';
import { useState } from 'react';
import { MessageContextMenu } from './MessageContextMenu';
import { api } from '@/services/api';
import { useParams } from 'react-router-dom';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onMessageUpdate?: () => void;
  onReply?: (message: Message) => void;
}

export function MessageBubble({ message, isOwn, onMessageUpdate, onReply }: MessageBubbleProps) {
  const isMedia = (message.type as string) !== 'text';
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { chatId } = useParams<{ chatId: string }>();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = async (action: string, messageId: string) => {
    try {
      if (action === 'copy') {
        // Copy text to clipboard
        await navigator.clipboard.writeText(message.content);
        alert('Text copied to clipboard!');
      } else if (action === 'edit') {
        // Prompt for new content
        const newContent = prompt('Edit message:', message.content);
        if (newContent && newContent.trim()) {
          const response = await api.executeMessageAction(messageId, 'edit', { new_content: newContent });
          if (response.success) {
            alert('Message edited successfully!');
            onMessageUpdate?.();
          }
        }
      } else if (action === 'info') {
        // Show message info
        const response = await api.executeMessageAction(messageId, 'info');
        if (response.success) {
          const info = response.info;
          const readByText = info.read_by.length > 0
            ? info.read_by.map((r: any) => `${r.full_name} at ${new Date(r.read_at).toLocaleString()}`).join('\n')
            : 'Not read yet';
          alert(`Message Info:\n\nSent by: ${info.sender}\nSent at: ${new Date(info.sent_at).toLocaleString()}\n${info.is_edited ? `Edited at: ${new Date(info.edited_at).toLocaleString()}\n` : ''}Read by:\n${readByText}`);
        }
      } else if (action === 'delete_me' || action === 'delete_everyone') {
        // Confirm deletion
        const confirmMsg = action === 'delete_everyone'
          ? 'Delete this message for everyone? This cannot be undone.'
          : 'Delete this message for you?';
        if (confirm(confirmMsg)) {
          const response = await api.executeMessageAction(messageId, action);
          if (response.success) {
            alert(response.message);
            onMessageUpdate?.();
          }
        }
      } else if (action === 'star' || action === 'unstar') {
        const response = await api.executeMessageAction(messageId, action);
        if (response.success) {
          alert(action === 'star' ? 'Message starred!' : 'Message unstarred!');
        }
      } else if (action === 'reply') {
        // Trigger reply UI
        if (onReply) {
          onReply(message);
        }
      } else if (action === 'forward') {
        // Show forward dialog (you can enhance this with a proper forward UI)
        alert(`Forward message: "${message.content}"\n\nThis will be implemented with a forward dialog showing your chats.`);
      } else if (action === 'download') {
        // Download media
        if (message.mediaUrl) {
          window.open(message.mediaUrl, '_blank');
        }
      } else if (action === 'select') {
        // Select message for bulk actions
        alert('Message selection for bulk actions will be implemented.');
      } else {
        // Execute other actions
        await api.executeMessageAction(messageId, action);
        onMessageUpdate?.();
      }
    } catch (error: any) {
      console.error('Error executing action:', error);
      alert(`Error: ${error.response?.data?.error || error.message || 'Failed to execute action'}`);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={cn(
          'flex mb-2',
          isOwn ? 'justify-end' : 'justify-start'
        )}
        onContextMenu={handleContextMenu}
      >
        <div
          className={cn(
            'max-w-[75%] relative cursor-context-menu',
            isOwn ? 'message-sent' : 'message-received',
            isMedia ? 'p-1' : 'px-4 py-2'
          )}
        >
          {/* Story Reply Indicator */}
          {message.storyReply && (
            <div className={cn(
              "flex items-start gap-2 mb-2 pb-2 border-l-2 pl-2",
              isOwn ? "border-primary-foreground/30" : "border-primary/30"
            )}>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[10px] font-medium mb-1",
                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  Story from {message.storyReply.story_owner}
                </p>
                {message.storyReply.story_type === 'text' && message.storyReply.story_content && (
                  <p className={cn(
                    "text-xs truncate",
                    isOwn ? "text-primary-foreground/60" : "text-foreground/60"
                  )}>
                    {message.storyReply.story_content}
                  </p>
                )}
                {message.storyReply.story_type === 'image' && message.storyReply.story_media_url && (
                  <img
                    src={message.storyReply.story_media_url}
                    alt="Story"
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                {message.storyReply.story_type === 'video' && message.storyReply.story_media_url && (
                  <video
                    src={message.storyReply.story_media_url}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
              </div>
            </div>
          )}

          {/* Reply Indicator */}
          {message.replyTo && message.replyToContent && (
            <div className={cn(
              "flex items-start gap-1 mb-2 pb-2 border-l-2 pl-2",
              isOwn ? "border-primary-foreground/30" : "border-primary/30"
            )}>
              <ReplyIcon className={cn(
                "w-3 h-3 mt-0.5 flex-shrink-0",
                isOwn ? "text-primary-foreground/50" : "text-muted-foreground"
              )} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[10px] font-medium",
                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {message.replyToSender || 'Unknown'}
                </p>
                <p className={cn(
                  "text-xs truncate",
                  isOwn ? "text-primary-foreground/60" : "text-foreground/60"
                )}>
                  {message.replyToContent}
                </p>
              </div>
            </div>
          )}

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

      {contextMenu && chatId && (
        <MessageContextMenu
          messageId={message.id}
          chatId={chatId}
          isOwn={isOwn}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleAction}
        />
      )}
    </>
  );
}
