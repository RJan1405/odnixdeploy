import { cn } from '@/lib/utils';
import { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  hasStory?: boolean;
  storyViewed?: boolean;
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-8 h-8 rounded-lg',
  sm: 'w-10 h-10 rounded-lg',
  md: 'w-12 h-12 rounded-xl',
  lg: 'w-14 h-14 rounded-xl',
  xl: 'w-16 h-16 rounded-2xl',
};

const onlineDotSizes = {
  xs: 'w-2 h-2 right-0 bottom-0',
  sm: 'w-2.5 h-2.5 right-0 bottom-0',
  md: 'w-3 h-3 right-0.5 bottom-0.5',
  lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5',
  xl: 'w-4 h-4 right-1 bottom-1',
};

const iconSizes = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
  xl: 'w-8 h-8',
};

export function Avatar({
  src,
  alt,
  size = 'md',
  hasStory = false,
  storyViewed = false,
  isOnline = false,
  className,
  onClick,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Get initials from alt text (usually username or display name)
  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const content = (
    <div className={cn('relative', onClick && 'cursor-pointer')} onClick={onClick}>
      {!imageError && src ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className={cn(
            sizeClasses[size],
            'object-cover transition-transform duration-200',
            onClick && 'hover:scale-105',
            className
          )}
        />
      ) : (
        <div
          className={cn(
            sizeClasses[size],
            'bg-secondary flex items-center justify-center transition-transform duration-200',
            onClick && 'hover:scale-105',
            className
          )}
        >
          {alt ? (
            <span className="text-muted-foreground font-semibold text-sm">
              {getInitials(alt)}
            </span>
          ) : (
            <User className={cn(iconSizes[size], 'text-muted-foreground')} />
          )}
        </div>
      )}
      {isOnline && (
        <span
          className={cn(
            'absolute bg-success rounded-full border-2 border-background',
            onlineDotSizes[size]
          )}
        />
      )}
    </div>
  );

  if (hasStory) {
    return (
      <div className={cn(
        'story-ring',
        storyViewed && 'opacity-50'
      )}>
        <div className="story-ring-inner">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
