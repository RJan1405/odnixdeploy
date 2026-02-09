import { Avatar } from './Avatar';
import type { Story } from '@/services/api';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface StoryItemProps {
  story: Story;
  onClick: () => void;
  showUpload?: boolean; // show small upload button overlay for own story
  onUpload?: () => void;
}

export function StoryItem({ story, onClick, showUpload = false, onUpload }: StoryItemProps) {
  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex flex-col items-center gap-2 min-w-[72px]"
      >
        <Avatar
          src={story.user.avatar}
          alt={story.user.username}
          size="lg"
          hasStory
          storyViewed={story.viewed}
        />
        {!showUpload && (
          <span className="text-xs text-muted-foreground truncate w-full text-center">
            {story.user.username}
          </span>
        )}
      </motion.button>

      {showUpload && onUpload && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpload();
          }}
          aria-label="Add story"
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-primary flex items-center justify-center"
        >
          <Plus className="w-3 h-3 text-primary-foreground" />
        </button>
      )}
    </div>
  );
}
