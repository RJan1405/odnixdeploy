import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Heart, Send, Repeat2 } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Story } from '@/services/api';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex(i => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return p + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, onClose, isPaused]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  };

  const handleReply = () => {
    if (reply.trim()) {
      console.log('Reply to story:', reply);
      setReply('');
    }
  };

  const toggleLike = () => {
    setLiked(prev => ({ ...prev, [currentStory.id]: !prev[currentStory.id] }));
  };

  const handleRepost = () => {
    console.log('Repost story:', currentStory.id);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 md:p-8"
      >
        {/* Desktop Navigation Left */}
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={currentIndex === 0}
          className={cn(
            "hidden md:flex absolute left-4 lg:left-32 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-50 text-white disabled:opacity-0 disabled:cursor-default"
          )}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Desktop Navigation Right */}
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={currentIndex === stories.length - 1}
          className={cn(
            "hidden md:flex absolute right-4 lg:right-32 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-50 text-white disabled:opacity-0 disabled:cursor-default"
          )}
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Close Button - Desktop (Outside) */}
        <button
          onClick={onClose}
          className="hidden md:block absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors z-50"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Main Story Container - Constrained properties for desktop, full for mobile */}
        <motion.div
          className="relative w-full h-full md:w-[400px] md:h-[85vh] md:max-h-[900px] md:rounded-2xl overflow-hidden bg-black shadow-2xl flex flex-col border md:border-white/10"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Progress bars */}
          <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
            {stories.map((_, index) => (
              <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-3">
              <Avatar
                src={currentStory.user.avatar}
                alt={currentStory.user.username}
                size="sm"
                className="ring-2 ring-black/20"
              />
              <div className="flex flex-col">
                <span className="text-white font-semibold text-sm drop-shadow-md shadow-black">
                  {currentStory.user.username}
                </span>
                <span className="text-white/80 text-xs drop-shadow-md shadow-black">
                  {(() => {
                    try {
                      return formatDistanceToNow(currentStory.createdAt, { addSuffix: true });
                    } catch (e) {
                      return 'Just now';
                    }
                  })()}
                </span>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button onClick={onClose} className="md:hidden p-2 bg-black/20 rounded-full backdrop-blur-sm">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Story content */}
          <div className="flex-1 relative flex items-center justify-center bg-zinc-900">
            {currentStory.type === 'video' ? (
              <video
                key={currentStory.id}
                src={currentStory.content}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                controls={false}
              />
            ) : currentStory.type === 'text' ? (
              <div
                key={currentStory.id}
                className="w-full h-full flex items-center justify-center p-8 text-center"
                style={{ backgroundColor: currentStory.backgroundColor || '#27272a' }}
              >
                <p className="text-white text-2xl font-bold break-words whitespace-pre-wrap font-sans">
                  {currentStory.content}
                </p>
              </div>
            ) : (
              <motion.img
                key={currentStory.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={currentStory.content}
                alt="Story"
                className="w-full h-full object-contain"
              />
            )}

            {/* Tap Navigation Areas (Invisible) - Mobile Only */}
            <div className="absolute inset-0 flex z-10 md:hidden">
              <div className="w-1/3 h-full" onClick={goPrev} />
              <div className="w-1/3 h-full" onClick={() => {/* Pause/Resume placeholder */ }} />
              <div className="w-1/3 h-full" onClick={goNext} />
            </div>
          </div>

          {/* Bottom actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20">
            {/* Input area */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder={`Reply to ${currentStory.user.username}...`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                className="flex-1 py-2.5 px-4 bg-transparent border border-white/30 rounded-full text-white placeholder:text-white/70 text-sm focus:outline-none focus:border-white focus:bg-black/20 transition-all"
              />

              {reply.trim() ? (
                <button
                  onClick={handleReply}
                  className="p-2 text-primary font-semibold text-sm hover:text-white transition-colors"
                >
                  Send
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={toggleLike} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Heart className={cn("w-6 h-6", liked[currentStory.id] ? "text-red-500 fill-red-500" : "text-white")} />
                  </button>
                  <button onClick={handleRepost} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Repeat2 className="w-6 h-6 text-white" />
                  </button>
                  <button onClick={() => {/* Message placeholder */ }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Send className="w-6 h-6 text-white -rotate-45 mb-1" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
