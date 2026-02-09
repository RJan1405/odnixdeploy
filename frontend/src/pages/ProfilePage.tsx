import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Grid3X3, Play, Bookmark, Repeat2, BadgeCheck, Loader2, Heart, MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ScribeCard } from '@/components/ScribeCard';
import { OmzoPlayer } from '@/components/OmzoPlayer';
import { SettingsModal } from '@/components/SettingsModal';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { User, Scribe, Omzo } from '@/services/api';
import { cn } from '@/lib/utils';

type ProfileTab = 'scribes' | 'omzos' | 'saved' | 'reposts';

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('scribes');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshProfile, setRefreshProfile] = useState(0);

  // Real data from Django
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [scribes, setScribes] = useState<Scribe[]>([]);
  const [omzos, setOmzos] = useState<Omzo[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    scribesCount: 0,
    followersCount: 0,
    followingCount: 0,
  });

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        setError(null);

        // If no userId, show current user's profile
        const username = userId || currentUser?.username || 'me';
        // Handle "me" explicitly if passed in URL
        const targetUsername = username === 'me' && currentUser ? currentUser.username : username;

        // Fetch full profile (user + posts)
        const fullProfile = await api.getUserFullProfile(targetUsername);

        if (!fullProfile) {
          setError('User not found');
          return;
        }

        setProfileUser(fullProfile.user);
        setIsFollowing(!!fullProfile.user.isFollowing);
        setScribes(fullProfile.scribes);
        setOmzos(fullProfile.omzos);

        // Set stats
        setStats({
          scribesCount: fullProfile.scribes.length,
          followersCount: fullProfile.user.followersCount || 0,
          followingCount: fullProfile.user.followingCount || 0,
        });

      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId, currentUser, refreshProfile]);

  const isOwnProfile = !userId || userId === 'me' || userId === currentUser?.username;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleProfileUpdate = () => {
    setRefreshProfile(p => p + 1);
  };

  const handleMessage = async () => {
    if (!profileUser) return;
    setMessageLoading(true);
    try {
      const chatId = await api.createChat(profileUser.username);
      if (chatId) {
        navigate(`/chat/${chatId}`);
      }
    } catch (error) {
      console.error('Failed to open chat');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profileUser) return;
    setFollowLoading(true);
    try {
      const result = await api.toggleFollow(profileUser.username);
      if (result.success) {
        setIsFollowing(result.isFollowing);
        setStats(prev => ({
          ...prev,
          followersCount: result.isFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
        }));
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Fetch saved items when tab changes
  useEffect(() => {
    if (activeTab === 'saved' && isOwnProfile) {
      const fetchSaved = async () => {
        try {
          setSavedLoading(true);
          const items = await api.getSavedItems();
          setSavedItems(items);
        } catch (error) {
          console.error('Error fetching saved items:', error);
        } finally {
          setSavedLoading(false);
        }
      };
      fetchSaved();
    }
  }, [activeTab, isOwnProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || 'Profile not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'scribes':
        return scribes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No scribes yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scribes.map((scribe) => (
              <ScribeCard key={scribe.id} scribe={scribe} />
            ))}
          </div>
        );

      case 'omzos':
        return omzos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No omzos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {omzos.map((omzo) => (
              <div
                key={omzo.id}
                className="aspect-[9/16] relative group cursor-pointer"
                onClick={() => navigate(`/omzo?omzoId=${omzo.id}`)}
              >
                <video
                  src={`${omzo.videoUrl}#t=0.1`}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  playsInline
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center text-white">
                    <Play className="w-6 h-6 fill-white" />
                    <span className="font-bold text-sm">{omzo.views}</span>
                  </div>
                  <div className="flex flex-col items-center text-white">
                    <Heart className="w-6 h-6 fill-white" />
                    <span className="font-bold text-sm">{omzo.likes}</span>
                  </div>
                  <div className="flex flex-col items-center text-white">
                    <MessageCircle className="w-6 h-6 fill-white" />
                    <span className="font-bold text-sm">{omzo.comments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'saved':
        if (!isOwnProfile) {
          return (
            <div className="text-center py-12 text-muted-foreground">
              <p>You can only see your own saved items</p>
            </div>
          );
        }
        if (savedLoading) {
          return (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          );
        }
        return savedItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No saved items yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedItems.map((item) => {
              if (item.feedType === 'omzo') {
                return (
                  <div key={`saved-omzo-${item.id}`} className="glass-card rounded-2xl overflow-hidden p-4">
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <Bookmark className="w-3 h-3" /> Saved Omzo
                    </p>
                    <div
                      className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group"
                      onClick={() => navigate(`/omzo?omzoId=${item.id}`)}
                    >
                      <video src={item.videoUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-12 h-12 text-white fill-white" />
                      </div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <Avatar src={item.user.avatar} alt={item.user.username} size="xs" />
                        <span className="text-white text-sm font-medium">@{item.user.username}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm line-clamp-2">{item.caption}</p>
                  </div>
                );
              }
              return (
                <div key={`saved-scribe-${item.id}`}>
                  <p className="text-xs text-muted-foreground mb-1 ml-4 flex items-center gap-1">
                    <Bookmark className="w-3 h-3" /> Saved Scribe
                  </p>
                  <ScribeCard scribe={item} />
                </div>
              );
            })}
          </div>
        );

      case 'reposts':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p>No reposts yet</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">@{profileUser.username}</h1>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Profile Info */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-start gap-4 mb-6">
            <Avatar
              src={profileUser.avatar}
              alt={profileUser.displayName}
              size="xl"
              isOnline={profileUser.isOnline}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{profileUser.displayName}</h2>
                {profileUser.isVerified && (
                  <BadgeCheck className="w-5 h-5 text-primary fill-primary" />
                )}
              </div>
              <p className="text-muted-foreground mb-4">@{profileUser.username}</p>

              {/* Stats */}
              <div className="flex gap-6 mb-4">
                <div className="text-center">
                  <div className="font-bold">{stats.scribesCount}</div>
                  <div className="text-sm text-muted-foreground">Scribes</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{stats.followersCount}</div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{stats.followingCount}</div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
              </div>

              {/* Action Buttons */}
              {!isOwnProfile && (
                <div className="flex gap-2">
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                      isFollowing
                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {followLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={handleMessage}
                    disabled={messageLoading}
                    className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 font-medium flex items-center justify-center gap-2"
                  >
                    {messageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Message'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[57px] z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex">
            {[
              { id: 'scribes' as const, icon: Grid3X3, label: 'Scribes' },
              { id: 'omzos' as const, icon: Play, label: 'Omzos' },
              { id: 'saved' as const, icon: Bookmark, label: 'Saved' },
              { id: 'reposts' as const, icon: Repeat2, label: 'Reposts' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 py-3 flex items-center justify-center gap-2 transition-colors relative',
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
