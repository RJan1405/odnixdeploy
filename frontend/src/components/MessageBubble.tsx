import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Lock, Share2, Reply as ReplyIcon, Play, Flame, X, Eye, Loader2 } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Message } from '@/services/api';
import { useState, useEffect } from 'react';
import { MessageContextMenu } from './MessageContextMenu';
import { api } from '@/services/api';
import { useParams, useNavigate } from 'react-router-dom';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onMessageUpdate?: () => void;
  onReply?: (message: Message) => void;
}

export function MessageBubble({ message, isOwn, onMessageUpdate, onReply }: MessageBubbleProps) {
  const isMedia = (message.type as string) !== 'text';
  const isShared = !!(message.sharedScribe || message.sharedOmzo);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();

  const [viewOnceOpen, setViewOnceOpen] = useState(false);
  const [isConsumedLocal, setIsConsumedLocal] = useState(message.consumed || false);
  const [viewContent, setViewContent] = useState<{ url: string, type: string } | null>(null);
  const [isOpeningViewOnce, setIsOpeningViewOnce] = useState(false);

  useEffect(() => {
    if (message.consumed) {
      setIsConsumedLocal(true);
    }
  }, [message.consumed]);

  const handleConsumeOneTime = async () => {
    if (isConsumedLocal || isOpeningViewOnce) return;

    // 🚀 OPTIMISTIC UI: Open overlay immediately for instant feedback
    setViewOnceOpen(true);
    setIsOpeningViewOnce(true);

    try {
      console.log('[OTV] Consuming message:', message.id);
      console.log('[OTV] Current message:', message);

      // Call API to consume (runs in background while overlay is already visible)
      const res = await api.consumeOneTimeMessage(message.id);
      console.log('[OTV] API Response:', res);

      if (res && res.success) {
        // Set the content to view
        const url = res.media_url || message.mediaUrl || message.content;
        // Improved type detection from URL if missing or generic
        let type = res.media_type || message.type;
        const urlLower = (url || '').toLowerCase();

        if (!type || type === 'file' || type === 'media') {
          if (urlLower.includes('.pdf') || urlLower.endsWith('.pdf')) type = 'document';
          else if (urlLower.match(/\.(mp4|mov|avi|mkv|webm)$/)) type = 'video';
          else if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) type = 'image';
          else type = 'image';
        }
        if (!type) type = 'image';

        console.log('[OTV] Content URL:', url);
        console.log('[OTV] Content Type:', type);
        console.log('[OTV] Response content:', res.content);

        if (url) {
          setViewContent({ url, type });
          setIsConsumedLocal(true);
          onMessageUpdate?.();
        } else if (res.content) {
          // Text only case
          setViewContent({ url: res.content, type: 'text' });
          setIsConsumedLocal(true);
          onMessageUpdate?.();
        } else {
          console.error('[OTV] No content returned for view once message');
          alert('Failed to load message content.');
          setViewOnceOpen(false); // Close overlay on error
        }

      } else {
        console.error('[OTV] Failed to consume message', res);
        alert('This message has already been viewed or is unavailable.');
        setIsConsumedLocal(true);
        setViewOnceOpen(false); // Close overlay on error
      }
    } catch (error) {
      console.error('[OTV] Error opening view once:', error);
      alert('Error opening message. Please try again.');
      setViewOnceOpen(false); // Close overlay on error
    } finally {
      setIsOpeningViewOnce(false);
    }
  };

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
            (isMedia || isShared) ? 'p-1' : 'px-4 py-2',
            // Constrain width for shared content to avoid bubble being wider than the card (due to long text)
            message.sharedOmzo ? 'max-w-[220px]' : (message.sharedScribe ? 'max-w-[250px]' : '')
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

          {/* Shared Scribe Card */}
          {message.sharedScribe && (
            <div
              className="bg-black/20 rounded-lg overflow-hidden mb-2 cursor-pointer border border-white/10 hover:bg-black/30 transition-colors w-full"
              onClick={() => navigate(`/scribe/${message.sharedScribe!.id}`)}
            >
              <div
                className="flex items-center gap-2 p-2 border-b border-white/5 bg-black/10 hover:bg-white/5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${message.sharedScribe!.user.username}`);
                }}
              >
                <Avatar src={message.sharedScribe.user.avatar} alt={message.sharedScribe.user.username} size="xs" />
                <span className="text-xs font-semibold truncate text-white/90">@{message.sharedScribe.user.username}</span>
              </div>
              {message.sharedScribe.image && (
                <div className="w-full h-32 bg-black/50 relative">
                  <img
                    src={message.sharedScribe.image}
                    alt="Scribe"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {message.sharedScribe.content && (
                <div className="p-2">
                  <p className="text-xs text-white/80 line-clamp-2">{message.sharedScribe.content}</p>
                </div>
              )}
            </div>
          )}

          {/* Shared Omzo Card */}
          {message.sharedOmzo && (
            <div
              className="bg-black/20 rounded-lg overflow-hidden mb-2 cursor-pointer border border-white/10 hover:bg-black/30 transition-colors w-full"
              onClick={() => navigate(`/omzo/${message.sharedOmzo!.id}`)}
            >
              <div
                className="flex items-center gap-2 p-2 border-b border-white/5 bg-black/10 hover:bg-white/5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${message.sharedOmzo!.user.username}`);
                }}
              >
                <Avatar src={message.sharedOmzo!.user.avatar} alt={message.sharedOmzo!.user.username} size="xs" />
                <span className="text-xs font-semibold truncate text-white/90">@{message.sharedOmzo!.user.username}</span>
              </div>
              <div className="relative aspect-[9/16] bg-gradient-to-br from-gray-900 to-black w-full max-h-[300px]">
                {/* Fallback pattern or color */}
                <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white/20" />
                </div>
                <video
                  src={`${message.sharedOmzo!.videoUrl}#t=0.001`}
                  className="w-full h-full object-cover relative z-10"
                  muted
                  preload="metadata"
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                </div>
              </div>
              {message.sharedOmzo!.caption && (
                <div className="p-2 text-xs text-white/80 line-clamp-2">
                  {message.sharedOmzo!.caption}
                </div>
              )}
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

          {/* One-Time View Logic */}
          {message.isOneTimeView ? (
            <div className="flex flex-col gap-2 my-1">
              <button
                disabled={isOwn || isConsumedLocal || isOpeningViewOnce}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isOwn && !isConsumedLocal) handleConsumeOneTime();
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all w-full max-w-[260px]",
                  isOwn
                    ? "bg-primary/5 border-primary/20 cursor-default"
                    : isConsumedLocal
                      ? "bg-secondary/50 border-white/5 cursor-default opacity-70"
                      : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border-amber-500/30 cursor-pointer shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)] group"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0",
                  isOwn
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : isConsumedLocal
                      ? "bg-white/5 text-muted-foreground border border-white/10"
                      : "bg-amber-500/20 text-amber-500 border border-amber-500/30 group-hover:scale-110 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                )}>
                  {isOpeningViewOnce ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  ) : (
                    isOwn ? <Lock className="w-5 h-5" /> : (isConsumedLocal ? <Lock className="w-5 h-5" /> : <Flame className="w-5 h-5 animate-pulse" />)
                  )}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className={cn(
                    "text-sm font-semibold truncate w-full text-left",
                    isOwn || isConsumedLocal ? "text-muted-foreground" : "text-foreground group-hover:text-amber-500 transition-colors"
                  )}>
                    {isOpeningViewOnce ? "Opening..." : (isOwn ? "Sent as one-time view" : (isConsumedLocal ? "Opened" : "Tap to view"))}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 text-left leading-tight">
                    {isOwn ? "Recipient can view once" : (isConsumedLocal ? "This message has been viewed" : "Expires after opening")}
                  </span>
                </div>
              </button>

              {/* Full Screen View Once Overlay */}
              {viewOnceOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
                  {/* Header */}
                  <div className="absolute top-0 left-0 right-0 p-4 pt-8 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center gap-3">
                      {/* Only show sender info if not own, or if own (which shouldn't happen here usually) */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                        <Lock className="w-3 h-3 text-white/70" />
                        <span className="text-white/90 text-xs font-medium">One-time view</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewOnceOpen(false);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md group"
                    >
                      <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4" onClick={(e) => e.stopPropagation()}>
                    {/* Loading Spinner while fetching content */}
                    {isOpeningViewOnce && !viewContent && (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                        <p className="text-white/70 text-sm">Loading content...</p>
                      </div>
                    )}

                    {/* Image View */}
                    {!isOpeningViewOnce && (viewContent ? viewContent.type === 'image' : message.type === 'image') && (
                      <img
                        src={viewContent?.url || message.mediaUrl || message.content}
                        className="max-w-full max-h-[80vh] object-contain drop-shadow-2xl"
                        alt="One-time view"
                        onError={(e) => {
                          console.error('[OTV] Image failed to load:', e.currentTarget.src);
                          e.currentTarget.style.display = 'none';
                        }}
                        onLoad={(e) => {
                          console.log('[OTV] Image loaded successfully:', e.currentTarget.src);
                        }}
                      />
                    )}

                    {/* Video View */}
                    {!isOpeningViewOnce && (viewContent ? viewContent.type === 'video' : message.type === 'video') && (
                      <video
                        src={viewContent?.url || message.mediaUrl || message.content}
                        className="max-w-full max-h-[80vh] object-contain drop-shadow-2xl"
                        controls
                        autoPlay
                        onError={(e) => {
                          console.error('[OTV] Video failed to load:', e.currentTarget.src);
                        }}
                        onLoadedData={(e) => {
                          console.log('[OTV] Video loaded successfully:', e.currentTarget.src);
                        }}
                      />
                    )}

                    {/* PDF/Document View */}
                    {!isOpeningViewOnce && (
                      (viewContent ? (viewContent.type === 'document' || viewContent.type === 'pdf') : (message.type === 'document' || message.type === 'file')) ||
                      (viewContent?.url || message.mediaUrl || '').toLowerCase().endsWith('.pdf')
                    ) && (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <div className="bg-white/10 px-4 py-2 rounded-full backdrop-blur-md mb-4 text-white/90 text-sm font-medium border border-white/10 shadow-lg">
                            {message.mediaFilename || (viewContent as any)?.media_filename || (viewContent?.url || message.mediaUrl || '').split('/').pop()}
                          </div>
                          <iframe
                            src={`${viewContent?.url || message.mediaUrl || message.content}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full max-w-4xl max-h-[80vh] rounded-xl shadow-2xl bg-white border border-white/20"
                            title="PDF Viewer"
                          />
                        </div>
                      )}

                    {/* Text View (Caption or Text Message) */}
                    {!isOpeningViewOnce && (message.content && !message.content.startsWith('Sent ') && !message.content.startsWith('http')) && (
                      <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl max-w-md text-center border border-white/10">
                        <p className="text-white/90 font-medium text-lg leading-relaxed">{message.content}</p>
                      </div>
                    )}

                    {/* Debug info - remove after testing */}
                    {!isOpeningViewOnce && (!viewContent?.url && !message.mediaUrl && !message.content) && (
                      <div className="bg-red-500/20 p-4 rounded-xl border border-red-500/50">
                        <p className="text-white text-sm">No content available</p>
                        <p className="text-white/70 text-xs mt-2">Type: {viewContent?.type || message.type}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer Warning */}
                  <div className="absolute bottom-10 px-6 py-3 bg-black/60 backdrop-blur-md rounded-full border border-amber-500/30 flex items-center gap-2 animate-pulse">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span className="text-white/90 text-sm font-medium">This message will disappear when you close it</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}

          {!message.isOneTimeView && (message.type === 'file' || message.type === 'document') && (message.mediaUrl || message.content) && (
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

          {((message.type as string) === 'text' || (message.content && !message.content.startsWith('Sent '))) && !message.isOneTimeView && (
            <p className={cn(
              'text-sm whitespace-pre-wrap break-words',
              isOwn ? 'text-primary-foreground' : 'text-foreground',
              (message.type as string) !== 'text' && 'mt-2 opacity-90',
              isShared && 'px-2 mt-2 mb-1'
            )}>
              {message.content}
            </p>
          )}

          <div className={cn(
            'flex items-center gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start',
            (isMedia || isShared) && 'px-2 pb-1'
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
