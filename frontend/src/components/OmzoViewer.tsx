import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, ThumbsDown, Share2, Flag, Music } from 'lucide-react';
import { Avatar } from './Avatar';
import { ReportModal } from './ReportModal';
import type { Omzo } from '@/services/api';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OmzoViewerProps {
  omzos: Omzo[];
  initialIndex: number;
  onClose: () => void;
}

export function OmzoViewer({ omzos, initialIndex, onClose }: OmzoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const currentOmzo = omzos[currentIndex];

  useEffect(() => {
    // Play current video, pause others
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === currentIndex) {
          video.play().catch(() => { });
        } else {
          video.pause();
        }
      }
    });
  }, [currentIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < omzos.length) {
      setCurrentIndex(newIndex);
    }
  };

  const toggleLike = (id: string) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
    if (disliked[id]) setDisliked(prev => ({ ...prev, [id]: false }));
  };

  const toggleDislike = (id: string) => {
    setDisliked(prev => ({ ...prev, [id]: !prev[id] }));
    if (liked[id]) setLiked(prev => ({ ...prev, [id]: false }));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 rounded-full"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Scrollable container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        >
          {omzos.map((omzo, index) => (
            <div
              key={omzo.id}
              className="h-full w-full snap-start relative flex items-center justify-center"
            >
              {/* Video */}
              <video
                ref={(el) => { videoRefs.current[index] = el; }}
                src={omzo.videoUrl}
                className="h-full w-full object-cover"
                loop
                playsInline
                muted={index !== currentIndex}
              />

              {/* Bottom overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-end gap-3">
                  <Avatar src={omzo.user.avatar} alt={omzo.user.username} size="md" />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{omzo.user.username}</p>
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <Music className="w-3 h-3" />
                      <span className="truncate">{omzo.audioName}</span>
                    </div>
                    <p className="text-white text-sm mt-1">{omzo.caption}</p>
                  </div>
                </div>
              </div>

              {/* Right side actions */}
              <div className="absolute right-4 bottom-32 flex flex-col gap-4">
                <button
                  onClick={() => toggleLike(omzo.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className={cn(
                    "p-3 rounded-full bg-black/50",
                    liked[omzo.id] && "bg-red-500/20"
                  )}>
                    <Heart className={cn(
                      "w-7 h-7",
                      liked[omzo.id] ? "text-red-500 fill-red-500" : "text-white"
                    )} />
                  </div>
                  <span className="text-white text-xs">
                    {omzo.likes + (liked[omzo.id] ? 1 : 0)}
                  </span>
                </button>

                <button
                  onClick={() => toggleDislike(omzo.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className={cn(
                    "p-3 rounded-full bg-black/50",
                    disliked[omzo.id] && "bg-blue-500/20"
                  )}>
                    <ThumbsDown className={cn(
                      "w-7 h-7",
                      disliked[omzo.id] ? "text-blue-500" : "text-white"
                    )} />
                  </div>
                  <span className="text-white text-xs">
                    {omzo.dislikes + (disliked[omzo.id] ? 1 : 0)}
                  </span>
                </button>

                <button className="flex flex-col items-center gap-1">
                  <div className="p-3 rounded-full bg-black/50">
                    <Share2 className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white text-xs">{omzo.shares}</span>
                </button>

                <button
                  onClick={() => setReportModalOpen(true)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="p-3 rounded-full bg-black/50">
                    <Flag className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white text-xs">Report</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          contentType="omzo"
          contentId={currentOmzo?.id || ''}
          onReportSuccess={() => {
            console.log('Omzo reported successfully from viewer');
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
