import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/services/api';

interface CommentItem {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

interface OmzoCommentsProps {
  omzoId: string;
  type?: 'omzo' | 'scribe';
  onCommentAdded?: () => void;
}

export function OmzoComments({ omzoId, type = 'omzo', onCommentAdded }: OmzoCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        let data;
        if (type === 'omzo') {
          data = await api.getOmzoComments(omzoId);
        } else {
          data = await api.getComments(omzoId);
        }
        setComments(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadComments();
  }, [omzoId, type]);

  const addComment = async () => {
    if (!text.trim() || !user) return;
    try {
      let newComment;
      if (type === 'omzo') {
        newComment = await api.addOmzoComment(omzoId, text.trim());
      } else {
        newComment = await api.addComment(omzoId, text.trim());
      }

      if (newComment) {
        setComments(prev => [newComment, ...prev]);
        setText('');
        if (onCommentAdded) onCommentAdded();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full max-w-md bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-border/50">
      <div className="max-h-56 overflow-y-auto pb-2 scrollbar-hide">
        {loading ? (
          <div className="text-center py-4 text-white/50 text-sm">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-white/70">No comments yet. Be the first!</div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-3 items-start py-2 border-b border-border/30 last:border-b-0">
              <Avatar src={c.avatar} alt={c.username} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">@{c.username}</span>
                  <span className="text-xs text-white/60">
                    · {c.createdAt && !isNaN(new Date(c.createdAt).getTime())
                      ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })
                      : 'just now'}
                  </span>
                </div>
                <div className="text-sm text-white/90">{c.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Avatar src={user?.avatar || ''} alt={user?.username || 'User'} size="xs" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
          placeholder="Add a comment..."
          className="flex-1 bg-transparent border border-border/40 rounded-2xl px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
        />
        <button
          onClick={addComment}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          disabled={!text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
