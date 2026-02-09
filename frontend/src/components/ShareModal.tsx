import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Copy, Check, BadgeCheck } from 'lucide-react';
import { Avatar } from './Avatar';
import { mockUsers } from '@/services/api';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'omzo' | 'scribe';
}

export function ShareModal({ isOpen, onClose, type }: ShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const filteredUsers = mockUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://odnix.app/${type}/example-id`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-card rounded-2xl overflow-hidden max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Share {type === 'omzo' ? 'Omzo' : 'Scribe'}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Users list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredUsers.map(user => (
              <motion.button
                key={user.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleUser(user.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                  selectedUsers.includes(user.id)
                    ? 'bg-primary/20 border border-primary/50'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                <Avatar
                  src={user.avatar}
                  alt={user.username}
                  size="md"
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-foreground">{user.displayName}</p>
                    {user.isVerified && (
                      <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
                {selectedUsers.includes(user.id) && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>

          {/* Copy link section */}
          <div className="p-4 border-t border-border">
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-success" />
                  <span className="font-medium text-success">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Share {type === 'omzo' ? 'Omzo' : 'Scribe'} Link
                  </span>
                </>
              )}
            </button>

            {selectedUsers.length > 0 && (
              <button
                className="w-full mt-3 py-3 bg-primary text-primary-foreground font-medium rounded-xl glow-primary hover:opacity-90 transition-opacity"
              >
                Send to {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
