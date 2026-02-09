import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StoryItem } from '@/components/StoryItem';
import { StoryViewer } from '@/components/StoryViewer';
import { ChatItem } from '@/components/ChatItem';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAppStore } from '@/stores/appStore';
import TopNavbar from '@/components/TopNavbar';
import type { UserStories, Chat } from '@/services/api';
import { SidebarWebSocket } from '@/services/websocket';

type ChatTab = 'all' | 'private';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatTab, setChatTab] = useState<ChatTab>('all');
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<UserStories | null>(null);
  const { openUploadModal, refreshTrigger } = useAppStore();

  // Real data from Django - now using grouped stories
  const [userStories, setUserStories] = useState<UserStories[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data from Django on component mount or refresh
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch grouped stories and chats in parallel
        const [storiesData, chatsData] = await Promise.all([
          api.getGroupedStories(),
          api.getChats()
        ]);

        setUserStories(storiesData);
        setChats(chatsData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshTrigger]);

  // WebSocket connection for real-time chat updates
  useEffect(() => {
    if (!user) return;

    const sidebarWS = new SidebarWebSocket();

    // Handle incoming WebSocket messages
    const handleSidebarUpdate = async (data: any) => {
      try {
        console.log('📨 Real-time sidebar update:', data);

        // Validate data structure
        if (!data || typeof data !== 'object') {
          console.warn('Invalid WebSocket data received:', data);
          return;
        }

        if (data.type === 'sidebar_update') {
          // Validate required fields
          if (!data.chat_id) {
            console.warn('sidebar_update missing chat_id:', data);
            return;
          }

          // Update specific chat's unread count and last message
          setChats(prevChats => {
            try {
              // Safety check
              if (!Array.isArray(prevChats)) {
                console.error('prevChats is not an array:', prevChats);
                return [];
              }

              return prevChats.map(chat => {
                if (chat.id === data.chat_id?.toString()) {
                  return {
                    ...chat,
                    unreadCount: typeof data.unread_count === 'number' ? data.unread_count : chat.unreadCount,
                    lastMessage: data.last_message || chat.lastMessage,
                    timestamp: new Date(),
                  };
                }
                return chat;
              });
            } catch (mapError) {
              console.error('Error mapping chats:', mapError);
              return prevChats; // Return unchanged on error
            }
          });
        } else if (data.type === 'new_chat') {
          // Refresh entire chat list when a new chat appears
          try {
            const chatsData = await api.getChats();
            if (Array.isArray(chatsData)) {
              setChats(chatsData);
            } else {
              console.error('getChats returned non-array:', chatsData);
            }
          } catch (error) {
            console.error('Error refreshing chats after new_chat:', error);
          }
        }
      } catch (error) {
        console.error('Error handling sidebar update:', error);
        // Don't crash the app - just log the error
      }
    };

    // Connect and add message handler
    try {
      sidebarWS.connect(handleSidebarUpdate);
    } catch (error) {
      console.error('Error connecting to sidebar WebSocket:', error);
    }

    // Cleanup on unmount
    return () => {
      try {
        sidebarWS.disconnect();
      } catch (error) {
        console.error('Error disconnecting sidebar WebSocket:', error);
      }
    };
  }, [user]);

  const filteredChats = chats.filter(chat =>
    chatTab === 'all' ? true : chat.isPrivate
  );

  const openStory = (userStoriesGroup: UserStories) => {
    setSelectedUserStories(userStoriesGroup);
    setStoryViewerOpen(true);
  };

  // Find current user's stories
  const myUserStories = userStories.find(us => user && us.user.id === user.id);
  const hasStory = myUserStories && myUserStories.stories.length > 0;


  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <TopNavbar />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <TopNavbar />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <TopNavbar />

      {/* Stories Section */}
      <section className="p-4 border-b border-border/50">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          {/* User's own story card - always show first */}
          {user && (
            <div className="flex-shrink-0">
              <div className="flex flex-col items-center gap-2 group">
                <div className={cn(
                  "relative rounded-full p-[2px]",
                  hasStory ? "bg-gradient-to-tr from-yellow-400 to-fuchsia-600" : "bg-transparent"
                )}>
                  {/* Avatar - click to view stories */}
                  <button
                    onClick={() => hasStory && myUserStories ? openStory(myUserStories) : openUploadModal('story')}
                    className="bg-background rounded-full p-[2px]"
                  >
                    <Avatar
                      src={user.avatar}
                      alt={user.displayName}
                      size="lg"
                      className="ring-0"
                    />
                  </button>

                  {/* Always show + button (Instagram-style) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openUploadModal('story');
                    }}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center ring-2 ring-background group-hover:scale-110 transition-transform hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
                <span className="text-xs text-center max-w-[70px] truncate">
                  Your Story
                </span>
              </div>
            </div>
          )}

          {/* Other users' stories - grouped by user */}
          {userStories.length === 0 ? (
            <div className="text-center w-full py-8 text-muted-foreground">
              <p className="mb-4">No stories yet. Be the first to share!</p>
              <button
                onClick={() => openUploadModal('story')}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Story
              </button>
            </div>
          ) : (
            userStories
              .filter(userStory => user && userStory.user.id !== user.id) // Don't show user's own story in the list since it's shown first
              .map((userStory) => (
                <StoryItem
                  key={userStory.user.id}
                  story={userStory.stories[0]} // Show first story as preview
                  onClick={() => openStory(userStory)}
                />
              ))
          )}
        </div>
      </section>

      {/* Chat sub-tabs */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 border-b border-border/50">
        <div className="flex p-2 gap-2">
          {(['all', 'private'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setChatTab(tab)}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all',
                chatTab === tab
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {tab === 'all' ? 'All Chats' : 'Private'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="p-2">
        {filteredChats.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No chats yet</p>
            <p className="text-sm">Start a conversation to see it here</p>
          </div>
        ) : (
          filteredChats.map((chat, index) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ChatItem
                chat={chat}
                onClick={() => navigate(`/chat/${chat.id}`)}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Story Viewer */}
      {storyViewerOpen && selectedUserStories && selectedUserStories.stories.length > 0 && (
        <StoryViewer
          stories={selectedUserStories.stories}
          initialIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </div>
  );
}
