import { Avatar } from './Avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Heart,
  ThumbsDown,
  Share2,
  Repeat2,
  MoreVertical,
  Music2,
  Flag,
  MessageSquare,
  Volume2,
  VolumeX
} from 'lucide-react';
import { BadgeCheck } from 'lucide-react';
import { OmzoComments } from './OmzoComments';
import { OmzoSharePanel } from './OmzoSharePanel';
import type { Omzo } from '@/services/api';
import { api } from '@/services/api';
import { useState, useRef, useEffect } from 'react';
import { useRef as useRefAlias } from 'react';

interface OmzoPlayerProps {
  omzo: Omzo;
  isActive: boolean;
  onUserClick?: () => void;
  onNavigate?: (dir: 'next' | 'prev') => void;
}

export function OmzoPlayer({ omzo, isActive, onUserClick, onNavigate }: OmzoPlayerProps) {
  const [liked, setLiked] = useState(omzo.isLiked);
  const [disliked, setDisliked] = useState(omzo.isDisliked);
  const [likes, setLikes] = useState(omzo.likes);
  const [dislikes, setDislikes] = useState(omzo.dislikes);
  const [reposted, setReposted] = useState<boolean>(!!omzo.isReposted);
  const [reposts, setReposts] = useState(omzo.reposts || 0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const [lastMutedState, setLastMutedState] = useState<boolean | null>(null);
  const muteTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number | null>(null);
  const singleTapTimer = useRef<number | null>(null);
  const heartTimer = useRef<number | null>(null);
  const [showDoubleHeart, setShowDoubleHeart] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && !isPaused) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, isPaused]);

  // Track view
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        api.trackOmzoView(omzo.id);
      }, 1000); // Only count view after 1 second
      return () => clearTimeout(timer);
    }
  }, [isActive, omzo.id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
    // update last state when changed (keeps overlay icon accurate)
    setLastMutedState(isMuted);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (muteTimer.current) window.clearTimeout(muteTimer.current);
      if (singleTapTimer.current) window.clearTimeout(singleTapTimer.current);
      if (heartTimer.current) window.clearTimeout(heartTimer.current);
    };
  }, []);

  // update progress when active
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener('timeupdate', handleTime);
    v.addEventListener('loadedmetadata', handleTime);
    return () => {
      v.removeEventListener('timeupdate', handleTime);
      v.removeEventListener('loadedmetadata', handleTime);
    };
  }, [isActive]);

  // keyboard shortcuts when this Omzo is active
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigate?.('next');
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate?.('prev');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, isPaused]);

  const handleLike = async () => {
    // Optimistic Update
    const prevLiked = liked;
    const prevLikes = likes;
    const prevDisliked = disliked;
    const prevDislikes = dislikes;

    if (liked) {
      setLiked(false);
      setLikes(l => l - 1);
    } else {
      setLiked(true);
      setLikes(l => l + 1);
      if (disliked) {
        setDisliked(false);
        setDislikes(d => d - 1);
      }
    }

    try {
      const res = await api.toggleOmzoLike(omzo.id);
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
    // Optimistic Update
    const prevDisliked = disliked;
    const prevDislikes = dislikes;
    const prevLiked = liked;
    const prevLikes = likes;

    if (disliked) {
      setDisliked(false);
      setDislikes(d => d - 1);
    } else {
      setDisliked(true);
      setDislikes(d => d + 1);
      if (liked) {
        setLiked(false);
        setLikes(l => l - 1);
      }
    }

    try {
      const res = await api.toggleOmzoDislike(omzo.id);
      setDisliked(res.isDisliked);
      // Backend omzo dislike logic likely updates likes_count too? 
      // Assuming it does or we ignore likes update here
    } catch (error) {
      // Rollback
      setDisliked(prevDisliked);
      setDislikes(prevDislikes);
      setLiked(prevLiked);
      setLikes(prevLikes);
    }
  };

  const handleRepost = async () => {
    console.log('=== REPOST DEBUG ===');
    console.log('Omzo ID:', omzo.id);
    console.log('Current reposted state:', reposted);
    console.log('Current reposts count:', reposts);
    
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
      console.log('Calling api.toggleRepostOmzo...');
      const res = await api.toggleRepostOmzo(omzo.id);
      console.log('API Response:', res);
      
      if (!res.success) {
        console.error('Repost failed - response.success is false');
        // Roll back on failure
        setReposted(prevReposted);
        setReposts(prevReposts);
        alert('Failed to repost. Please try again.');
      } else {
        console.log('Repost successful! isReposted:', res.isReposted);
        // Ensure local state matches backend flag if provided
        setReposted(res.isReposted);
      }
    } catch (error) {
      console.error('Error toggling omzo repost:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Failed to repost'));
      setReposted(prevReposted);
      setReposts(prevReposts);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const togglePlay = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="relative w-full h-full bg-background">
      {/* Video */}
      <video
        ref={videoRef}
        src={omzo.videoUrl}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={togglePlay}
      />

      {/* Double-tap heart animation */}
      {showDoubleHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center text-white opacity-95">
            <Heart className="w-14 h-14 text-destructive" />
          </div>
        </div>
      )}

      {/* Pause indicator */}
      {isPaused && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={togglePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); } }}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <div className="w-0 h-0 border-l-[30px] border-l-white border-y-[18px] border-y-transparent ml-2" />
          </div>
        </div>
      )}

      {/* Mute/Unmute transient icon (faint, small) */}
      {showMuteIcon && lastMutedState !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm text-white opacity-90">
            {lastMutedState ? (
              <VolumeX className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 omzo-gradient pointer-events-none" />

      {/* Progress bar */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 z-20">
          <div className="h-1 bg-white/20 w-full" />
          <div
            className="absolute top-0 left-0 h-1 bg-primary"
            style={{ width: `${progress}%`, transition: 'width 0.12s linear' }}
          />
        </div>
      )}

      {/* Right side actions */}
      <div className="absolute right-3 bottom-12 flex flex-col items-center gap-5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn(
            'w-12 h-12 rounded-full glass-button flex items-center justify-center',
            liked && 'bg-red-500/20 border-red-500/50'
          )}>
            <Heart className={cn(
              'w-6 h-6',
              liked ? 'text-red-500 fill-red-500' : 'text-white'
            )} />
          </div>
          <span className="text-xs text-white font-medium">{formatCount(likes)}</span>
        </motion.button>



        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleDislike}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn(
            'w-12 h-12 rounded-full glass-button flex items-center justify-center',
            disliked && 'bg-primary/20 border-primary/50'
          )}>
            <ThumbsDown className={cn(
              'w-6 h-6',
              disliked ? 'text-primary fill-primary' : 'text-white'
            )} />
          </div>
          <span className="text-xs text-white font-medium">{formatCount(dislikes)}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { setCommentsOpen(c => !c); setShareOpen(false); }}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn('w-12 h-12 rounded-full glass-button flex items-center justify-center', commentsOpen && 'bg-muted/20')}>
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-white font-medium">Comments</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleRepost}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn(
            'w-12 h-12 rounded-full glass-button flex items-center justify-center',
            reposted && 'bg-success/20 border-success/50'
          )}>
            <Repeat2 className={cn(
              'w-6 h-6',
              reposted ? 'text-success fill-success' : 'text-white'
            )} />
          </div>
          <span className="text-xs text-white font-medium">{formatCount(reposts)}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { setShareOpen(s => !s); setCommentsOpen(false); }}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn('w-12 h-12 rounded-full glass-button flex items-center justify-center', shareOpen && 'bg-muted/20')}>
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{formatCount(omzo.shares)}</span>
        </motion.button>
      </div>

      {/* Top right menu */}
      <div className="absolute top-4 right-4 flex flex-col gap-3 z-30">
        <button className="p-2 glass-button rounded-full">
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
        {isPaused && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            className="p-2 glass-button rounded-full"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
        )}
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-4 left-4 right-20">
        <div className="flex items-center gap-3 mb-3" onClick={onUserClick}>
          <Avatar
            src={omzo.user.avatar}
            alt={omzo.user.username}
            size="md"
            onClick={onUserClick}
          />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white cursor-pointer">
              @{omzo.user.username}
            </span>
            {omzo.user.isVerified && (
              <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
            )}
          </div>
        </div>

        <p className="text-white text-sm mb-2">{omzo.caption}</p>

        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-white animate-pulse" />
          <span className="text-sm text-white/80 truncate">{omzo.audioName}</span>
        </div>
      </div>

      {/* Comments panel */}
      {commentsOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setCommentsOpen(false)}>
          <div className="absolute right-4 bottom-24" onClick={(e) => e.stopPropagation()}>
            <OmzoComments omzoId={omzo.id} />
          </div>
        </div>
      )}

      {/* Share panel */}
      {shareOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)}>
          <div className="absolute right-4 bottom-24" onClick={(e) => e.stopPropagation()}>
            <OmzoSharePanel omzoId={omzo.id} onClose={() => setShareOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
