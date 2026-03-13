import { Avatar } from './Avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ThumbsDown,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  MoreHorizontal,
  BadgeCheck,
  Flag,
  Link as LinkIcon,
  UserPlus,
  Loader2
} from 'lucide-react';
import { OmzoComments } from './OmzoComments';
import { ScribeSharePanel } from './ScribeSharePanel';
import { ReportModal } from './ReportModal';
import { createPortal } from 'react-dom';
import type { Scribe } from '@/services/api';
import { api } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { useState, useRef, useEffect } from 'react';


interface ScribeCardProps {
  scribe: Scribe;
  onUserClick?: () => void;
  onRepostToggled?: (scribeId: string, isReposted: boolean) => void;
}

export function ScribeCard({ scribe, onUserClick, onRepostToggled }: ScribeCardProps) {
  // For reposts, use original content's metrics and ID for interactions
  const isRepost = scribe.isRepost && scribe.originalData;
  const displayData = isRepost ? scribe.originalData! : scribe;
  const interactionId = isRepost ? scribe.originalData!.id : scribe.id;

  const [liked, setLiked] = useState(scribe.isLiked);
  const [disliked, setDisliked] = useState(scribe.isDisliked);
  const [saved, setSaved] = useState(scribe.isSaved);
  const [likes, setLikes] = useState(displayData.likes);
  const [dislikes, setDislikes] = useState(scribe.dislikes);
  const [commentsCount, setCommentsCount] = useState(displayData.comments);
  const [reposts, setReposts] = useState(displayData.reposts || 0);
  // If this is a repost card, mark as reposted (so user can undo)
  const [reposted, setReposted] = useState<boolean>(isRepost ? true : !!scribe.isReposted);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Follow state management
  const [isFollowing, setIsFollowing] = useState(displayData.user.isFollowing || false);
  const [followLoading, setFollowLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOmzo = scribe.type === 'video';

  useEffect(() => {
    setLiked(scribe.isLiked);
    setDisliked(scribe.isDisliked);
    setSaved(scribe.isSaved);
    setLikes(displayData.likes);
    setDislikes(scribe.dislikes);
    setCommentsCount(displayData.comments);
    setReposts(displayData.reposts || 0);
    // Update reposted state: true if it's a repost card, otherwise use isReposted flag
    setReposted(isRepost ? true : !!scribe.isReposted);
    // Update follow state from user data
    setIsFollowing(displayData.user.isFollowing || false);
  }, [scribe, displayData, isRepost]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLike = async () => {
    // Optimistic
    const prevLiked = liked;
    const prevLikes = likes;
    const prevDisliked = disliked;
    const prevDislikes = dislikes;

    if (liked) {
      setLiked(false);
      setLikes(l => Math.max(0, l - 1));
    } else {
      setLiked(true);
      setLikes(l => l + 1);
      if (disliked) {
        setDisliked(false);
        setDislikes(d => Math.max(0, d - 1));
      }
    }

    try {
      const res = isOmzo
        ? await api.toggleOmzoLike(interactionId)
        : await api.toggleLike(interactionId);

      setLiked(res.isLiked);
      setLikes(res.likesCount);
    } catch (error) {
      // Rollback
      setLiked(prevLiked);
      setLikes(prevLikes);
      setDisliked(prevDisliked);
      setDislikes(prevDislikes);
    }
  };

  const handleDislike = async () => {
    // Optimistic
    const prevDisliked = disliked;
    const prevDislikes = dislikes;
    const prevLiked = liked;
    const prevLikes = likes;

    if (disliked) {
      setDisliked(false);
      setDislikes(d => Math.max(0, d - 1));
    } else {
      setDisliked(true);
      setDislikes(d => d + 1);
      if (liked) {
        setLiked(false);
        setLikes(l => Math.max(0, l - 1));
      }
    }

    try {
      const res = isOmzo
        ? await api.toggleOmzoDislike(interactionId)
        : await api.toggleDislike(interactionId); // Assuming api.toggleDislike exists and returns { isDisliked, likesCount } or similar

      setDisliked(res.isDisliked);
      // Backend dislike API usually returns likes_count too or generic count? 
      // toggle_omzo_dislike returns likes_count.
      // Assuming Scribe toggle_dislike logic updates correctly.
    } catch (error) {
      setDisliked(prevDisliked);
      setDislikes(prevDislikes);
      setLiked(prevLiked);
      setLikes(prevLikes);
    }
  };

  const handleSave = async () => {
    const prevSaved = saved;
    setSaved(!saved);

    try {
      const res = isOmzo
        ? await api.toggleSaveOmzo(interactionId)
        : await api.toggleSaveScribe(interactionId);

      setSaved(res.isSaved);
    } catch (error) {
      setSaved(prevSaved);
      console.error('Error toggling save:', error);
    }
  };

  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevReposts = reposts;

    // Optimistic toggle
    if (reposted) {
      setReposted(false);
      setReposts(r => Math.max(0, r - 1));
    } else {
      setReposted(true);
      setReposts(r => r + 1);
    }

    try {
      // Determine the content type
      let contentType: 'scribe' | 'omzo' | 'story' = 'scribe';

      if (isRepost) {
        // For repost cards, use originalType
        contentType = scribe.originalType || 'scribe';
      } else {
        // For original content, detect type by feedType field (from explore feed API)
        const feedType = (scribe as any).feedType;
        if (feedType === 'omzo') {
          contentType = 'omzo';
        }
      }

      // Call the appropriate API function based on content type
      let res: { success: boolean; isReposted: boolean };
      if (contentType === 'omzo') {
        res = await api.toggleRepostOmzo(interactionId);
      } else {
        // Default to scribe for both 'scribe' and 'story' types
        res = await api.toggleRepostScribe(interactionId);
      }

      if (!res.success) {
        // Roll back on failure
        setReposted(prevReposted);
        setReposts(prevReposts);
        alert('Failed to repost. Please try again.');
      } else {
        // Ensure local state matches backend flag if provided
        setReposted(res.isReposted);

        // Notify parent component about repost toggle (for removing from reposts tab)
        if (onRepostToggled) {
          onRepostToggled(scribe.id, res.isReposted);
        }
      }
    } catch (error) {
      console.error('Error toggling repost:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Failed to repost'));
      setReposted(prevReposted);
      setReposts(prevReposts);
    }
  };

  const handleFollow = async () => {
    if (followLoading) return;

    const prevFollowing = isFollowing;
    setFollowLoading(true);

    try {
      const result = await api.toggleFollow(displayData.user.username);
      if (result.success) {
        setIsFollowing(result.isFollowing);
      }
    } catch (error) {
      setIsFollowing(prevFollowing);
      console.error('Failed to toggle follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const menuActions = [
    {
      label: 'Copy Link',
      icon: LinkIcon,
      action: () => {
        navigator.clipboard.writeText(`${window.location.origin}/${isOmzo ? 'omzo' : 'scribe'}/${interactionId}`);
        setMenuOpen(false);
      }
    },
    {
      label: 'Report',
      icon: Flag,
      action: () => {
        setReportOpen(true);
        setMenuOpen(false);
      },
      danger: true
    }
  ];

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 mb-4 relative"
    >
      {/* Repost Header - Show if this is a repost */}
      {scribe.isRepost && (
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Repeat2 className="w-4 h-4" />
          <span>
            <span className="font-semibold text-foreground">{scribe.user.displayName}</span> reposted
          </span>
        </div>
      )}

      {/* Original Content - Show if this is a repost with original data */}
      {scribe.isRepost && scribe.originalData ? (
        <div className="rounded-xl border border-border/50 p-4 bg-background/50">
          {/* Original Author Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={scribe.originalData.user.avatar}
                alt={scribe.originalData.user.username}
                size="md"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">
                    {scribe.originalData.user.displayName}
                  </span>
                  {scribe.originalData.user.isVerified && (
                    <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  @{scribe.originalData.user.username} · {formatDistanceToNow(scribe.originalData.timestamp, { addSuffix: false })}
                </span>
              </div>
            </div>
            {/* Follow Button for Original Author */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleFollow}
              disabled={followLoading}
              className={cn(
                'px-3 py-1.5 rounded-xl font-medium text-sm transition-all flex items-center gap-1.5',
                isFollowing
                  ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  : 'bg-primary text-primary-foreground hover:opacity-90',
                followLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {followLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                !isFollowing && <UserPlus className="w-3.5 h-3.5" />
              )}
              {followLoading ? (isFollowing ? 'Updating...' : 'Following...') : (isFollowing ? 'Following' : 'Follow')}
            </motion.button>
          </div>

          {/* Original Content */}
          <div className="mb-3">
            {scribe.originalType === 'scribe' && (
              <>
                {scribe.originalData.content && (
                  <p className="text-foreground whitespace-pre-wrap mb-3">{scribe.originalData.content}</p>
                )}
                {scribe.originalData.mediaUrl && (
                  <div className="rounded-xl overflow-hidden bg-secondary/30">
                    <img
                      src={scribe.originalData.mediaUrl}
                      alt="Original content"
                      loading="lazy"
                      className="w-full h-auto max-h-[400px] object-contain"
                    />
                  </div>
                )}
              </>
            )}

            {scribe.originalType === 'omzo' && scribe.originalData.videoUrl && (
              <>
                {scribe.originalData.caption && (
                  <p className="text-foreground mb-3">{scribe.originalData.caption}</p>
                )}
                <video
                  src={scribe.originalData.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="rounded-xl w-full bg-black max-h-80"
                />
              </>
            )}
          </div>

          {/* Original Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {formatCount(scribe.originalData.likes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {formatCount(scribe.originalData.comments)}
            </span>
            {scribe.originalData.reposts !== undefined && (
              <span className="flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                {formatCount(scribe.originalData.reposts)}
              </span>
            )}
            {scribe.originalData.views !== undefined && (
              <span className="flex items-center gap-1">
                <span>👁</span>
                {formatCount(scribe.originalData.views)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header - Show for non-reposts */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={onUserClick}>
              <Avatar
                src={scribe.user.avatar}
                alt={scribe.user.username}
                size="md"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">
                    {scribe.user.displayName}
                  </span>
                  {scribe.user.isVerified && (
                    <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  @{scribe.user.username} · {formatDistanceToNow(scribe.createdAt, { addSuffix: false })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Follow Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleFollow}
                disabled={followLoading}
                className={cn(
                  'px-3 py-1.5 rounded-xl font-medium text-sm transition-all flex items-center gap-1.5',
                  isFollowing
                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    : 'bg-primary text-primary-foreground hover:opacity-90',
                  followLoading && 'opacity-70 cursor-not-allowed'
                )}
              >
                {followLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  !isFollowing && <UserPlus className="w-3.5 h-3.5" />
                )}
                {followLoading ? (isFollowing ? 'Updating...' : 'Following...') : (isFollowing ? 'Following' : 'Follow')}
              </motion.button>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                    >
                      {menuActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={action.action}
                          className={cn(
                            "w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary/50",
                            action.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
                          )}
                        >
                          <action.icon className="w-4 h-4" />
                          {action.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="mb-4">
            {scribe.type === 'text' && (
              <p className="text-foreground whitespace-pre-wrap">{scribe.content}</p>
            )}

            {scribe.type === 'image' && (
              <>
                <p className="text-foreground mb-3">{scribe.content}</p>
                <div className="rounded-xl overflow-hidden bg-secondary/30">
                  <img
                    src={scribe.mediaUrl}
                    alt="Post content"
                    loading="lazy"
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
              </>
            )}

            {scribe.type === 'html' && (
              <>
                <p className="text-foreground mb-3">{scribe.content}</p>
                <div className="rounded-xl overflow-hidden border border-border">
                  <iframe
                    srcDoc={scribe.htmlContent}
                    className="w-full h-52 bg-background"
                    sandbox="allow-scripts"
                    title="HTML Content"
                  />
                </div>
              </>
            )}

            {scribe.type === 'video' && (
              <>
                <p className="text-foreground mb-3">{scribe.content}</p>
                <video
                  src={scribe.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="rounded-xl w-full bg-black max-h-96"
                />
              </>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
          )}
        >
          <Heart className={cn('w-5 h-5', liked && 'fill-red-500')} />
          <span>{formatCount(likes)}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleDislike}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            disliked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
          )}
        >
          <ThumbsDown className={cn('w-5 h-5', disliked && 'fill-current')} />
          <span>{formatCount(dislikes)}</span>
        </motion.button>

        <button onClick={() => setCommentsOpen(c => !c)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span>{formatCount(commentsCount)}</span>
        </button>

        <button
          onClick={handleRepost}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            reposted ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
          )}
        >
          <Repeat2 className={cn('w-5 h-5', reposted && 'fill-red-500')} />
          <span>{formatCount(reposts)}</span>
        </button>

        <button onClick={() => { setShareOpen(s => !s); setCommentsOpen(false); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors">
          <Share2 className="w-5 h-5" />
        </button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSave}
          className={cn(
            'text-sm transition-colors',
            saved ? 'text-warning' : 'text-muted-foreground hover:text-warning'
          )}
        >
          <Bookmark className={cn('w-5 h-5', saved && 'fill-current')} />
        </motion.button>
      </div>
      {commentsOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-40" onClick={() => setCommentsOpen(false)}>
          <div className="absolute right-4 bottom-24" onClick={(e) => e.stopPropagation()}>
            <OmzoComments
              omzoId={interactionId}
              type={isOmzo ? 'omzo' : 'scribe'}
              onCommentAdded={() => setCommentsCount(c => c + 1)}
            />
          </div>
        </div>, document.body
      ) : null}

      {shareOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)}>
          <div className="absolute right-4 bottom-24" onClick={(e) => e.stopPropagation()}>
            <ScribeSharePanel scribeId={interactionId} onClose={() => setShareOpen(false)} />
          </div>
        </div>, document.body
      ) : null}

      {/* Report Modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType={isOmzo ? 'omzo' : 'scribe'}
        contentId={interactionId}
        onReportSuccess={() => {
          console.log('Report submitted successfully');
        }}
      />
    </motion.div>
  );
}
