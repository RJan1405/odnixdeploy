import { useState } from 'react';
import { Avatar } from './Avatar';
import { mockChats } from '@/services/api';
import { Copy, Check } from 'lucide-react';

interface OmzoSharePanelProps {
  omzoId: string;
  onClose?: () => void;
}

export function OmzoSharePanel({ omzoId, onClose }: OmzoSharePanelProps) {
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const toggleChat = (id: string) => {
    setSelectedChats(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://odnix.app/omzo/${omzoId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onClose) onClose();
    } catch (e) {
      // ignore
      if (onClose) onClose();
    }
  };

  const sendToChats = () => {
    if (selectedChats.length === 0) return;
    // Mock send: clear selection and close panel
    setSelectedChats([]);
    if (onClose) onClose();
  };

  return (
    <div className="w-full max-w-md bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-border/50">
      <h3 className="text-sm font-semibold text-white mb-2">Share to chat</h3>

      <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
        {mockChats.map(chat => {
          const isSelected = selectedChats.includes(chat.id);
          return (
            <button
              key={chat.id}
              onClick={() => toggleChat(chat.id)}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${isSelected ? 'bg-primary/20 border border-primary/50' : 'bg-secondary hover:bg-secondary/80'}`}
            >
              <Avatar src={chat.user.avatar} alt={chat.user.username} size="md" />
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{chat.user.displayName}</p>
                <p className="text-sm text-muted-foreground truncate">@{chat.user.username}</p>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border/30 pt-3">
        <button
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 py-2 bg-secondary rounded-xl mb-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Link copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Copy Omzo link</span>
            </>
          )}
        </button>

        <button
          onClick={sendToChats}
          disabled={selectedChats.length === 0}
          className={`w-full py-2 rounded-xl font-medium ${selectedChats.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-muted-foreground cursor-not-allowed'}`}
        >
          Send to {selectedChats.length} chat{selectedChats.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
