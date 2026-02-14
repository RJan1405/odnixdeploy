import { useState, useEffect } from 'react';
import { Avatar } from './Avatar';
import { api, Chat } from '@/services/api';
import { Copy, Check, Send } from 'lucide-react';

interface ScribeSharePanelProps {
  scribeId: string;
  onClose?: () => void;
}

export function ScribeSharePanel({ scribeId, onClose }: ScribeSharePanelProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const data = await api.getChats();
        setChats(data);
      } catch (error) {
        console.error('Failed to fetch chats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  const toggleChat = (id: string) => {
    setSelectedChats(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://odnix.app/scribe/${scribeId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onClose) setTimeout(onClose, 1000);
    } catch (e) {
      if (onClose) onClose();
    }
  };

  const sendToChats = async () => {
    if (selectedChats.length === 0) return;

    setSending(true);
    const link = `https://odnix.app/scribe/${scribeId}`;

    try {
      await Promise.all(selectedChats.map(chatId =>
        api.sendMessage(chatId, `Check out this Scribe: ${link}`, undefined, undefined, scribeId)
      ));

      // Clear selection and close
      setSelectedChats([]);
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to share to chats', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-border/50">
      <h3 className="text-sm font-semibold text-white mb-2">Share to chat</h3>

      <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">No chats found</p>
        ) : (
          chats.map(chat => {
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
          })
        )}
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
              <span className="text-sm text-foreground">Copy Scribe link</span>
            </>
          )}
        </button>

        <button
          onClick={sendToChats}
          disabled={selectedChats.length === 0 || sending}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-medium transition-colors ${selectedChats.length > 0 && !sending
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-secondary/60 text-muted-foreground cursor-not-allowed'
            }`}
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send to {selectedChats.length} chat{selectedChats.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
