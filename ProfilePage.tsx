import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Grid3X3, Play, Bookmark, Repeat2, BadgeCheck } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ScribeCard } from '@/components/ScribeCard';
import { mockUsers, mockScribes, mockOmzos, mockReposts, currentUser, mockChats } from '@/services/api';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStore, Theme } from '@/stores/themeStore';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const themes: { id: Theme; name: string; preview: string }[] = [
  { id: 'light', name: 'Light', preview: 'bg-white border' },
  { id: 'dark', name: 'Dark', preview: 'bg-slate-900' },
  { id: 'amoled', name: 'AMOLED', preview: 'bg-black' },
  { id: 'dracula', name: 'Dracula', preview: 'bg-[#282a36]' },
  { id: 'nord', name: 'Nord', preview: 'bg-[#2e3440]' },
  { id: 'cyberpunk', name: 'Cyberpunk', preview: 'bg-purple-950' },
  { id: 'synthwave', name: 'Synthwave', preview: 'bg-violet-950' },
];

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scribes' | 'omzos' | 'saved' | 'reposts'>('scribes');
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useThemeStore();
  const user = userId === 'me' ? currentUser : (mockUsers.find(u => u.id === userId) || mockUsers[1]);
  const userScribes = mockScribes.filter(s => s.user.id === userId);
  const userOmzos = mockOmzos.filter(o => o.user.id === userId);

  const [firstName, setFirstName] = useState(() => {
    const parts = user.displayName?.split(' ') || [];
    return parts[0] || '';
  });
  const [lastName, setLastName] = useState(() => {
    const parts = user.displayName?.split(' ') || [];
    return parts.slice(1).join(' ') || '';
  });
  const [localUsername, setLocalUsername] = useState(user.username || '');
  const [privateAccount, setPrivateAccount] = useState(false);
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string>(user.avatar || '');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!pfpFile) return;
    const url = URL.createObjectURL(pfpFile);
    setPfpPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pfpFile]);

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="sticky top-0 z-10 glass-card border-b border-border/50"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <span className="font-semibold text-foreground">@{user.username}</span>
          {userId === 'me' && (
            <Dialog open={showSettings} onOpenChange={(open) => setShowSettings(open)}>
              <DialogTrigger asChild>
                <button className="p-2 hover:bg-secondary rounded-xl transition-colors">
                  <Settings className="w-6 h-6 text-foreground" />
                </button>
              </DialogTrigger>

              <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Manage your profile and appearance</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar src={pfpPreview} alt={user.username} size="md" />
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setPfpFile(e.target.files?.[0] || null)}
                    />
                    <span className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Upload / Change Photo</span>
                  </label>
                </div>
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Personal Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label>First Name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Username</Label>
                      <Input value={localUsername} onChange={(e) => setLocalUsername(e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">People can find you with @{localUsername || 'username'}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Privacy</h4>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <Label>Private Account</Label>
                      <p className="text-xs text-muted-foreground">Only approved followers can see your posts and stories</p>
                    </div>
                    <div className="mt-1">
                      <Switch checked={privateAccount} onCheckedChange={(val) => setPrivateAccount(!!val)} />
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Theme</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {themes.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl transition-all w-full',
                          theme === t.id
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-secondary hover:bg-secondary/80'
                        )}
                      >
                        <div className={cn('w-4 h-4 rounded', t.preview)} />
                        <span className="text-sm text-foreground">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <DialogFooter className="mt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.header>

      {/* Theme Settings Panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card border-b border-border/50 p-4"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Theme</h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl transition-all',
                  theme === t.id
                    ? 'bg-primary/20 border border-primary/50'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                <div className={cn('w-4 h-4 rounded', t.preview)} />
                <span className="text-sm text-foreground">{t.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Profile Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 text-center"
      >
        <Avatar
          src={user.avatar}
          alt={user.username}
          size="xl"
          isOnline={user.isOnline}
          className="mx-auto mb-4"
        />
        <h1 className="text-xl font-bold text-foreground mb-1">
          <div className="inline-flex items-center gap-1">
            <span>{user.displayName}</span>
            {user.isVerified && (
              <BadgeCheck className="w-5 h-5 text-primary fill-primary/20" />
            )}
          </div>
        </h1>
        <p className="text-muted-foreground mb-4">@{user.username}</p>

        <div className="flex justify-center gap-8 mb-6">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">234</p>
            <p className="text-sm text-muted-foreground">Scribes</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">12.5K</p>
            <p className="text-sm text-muted-foreground">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">890</p>
            <p className="text-sm text-muted-foreground">Following</p>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          {userId === 'me' ? null : (
            <>
              <button
                onClick={() => setIsFollowing(f => !f)}
                className={cn(
                  'px-8 py-2.5 rounded-xl font-medium text-sm transition-opacity',
                  isFollowing
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground glow-primary hover:opacity-90'
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={() => {
                  // find existing chat with this user
                  const existing = mockChats.find(c => c.user.id === user.id);
                  if (existing) {
                    navigate(`/chat/${existing.id}`);
                    return;
                  }
                  // create a new chat entry and navigate
                  const newChat = {
                    id: String(Date.now()),
                    user,
                    lastMessage: '',
                    timestamp: new Date(),
                    unreadCount: 0,
                    isPrivate: true,
                  };
                  // push to mockChats (mutable mock data)
                  // @ts-ignore mutate mockChats for demo
                  mockChats.unshift(newChat);
                  navigate(`/chat/${newChat.id}`);
                }}
                className="px-8 py-2.5 rounded-xl font-medium text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Message
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(() => {
          const tabs = [
            { id: 'scribes', icon: Grid3X3, label: 'Scribes' },
            { id: 'omzos', icon: Play, label: 'Omzos' },
            { id: 'reposts', icon: Repeat2, label: 'Reposts' },
          ];
          if (userId === 'me') {
            tabs.push({ id: 'saved', icon: Bookmark, label: 'Saved' });
          }
          return tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 transition-colors relative',
                activeTab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
              {activeTab === id && (
                <motion.div
                  layoutId="profile-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  style={{ boxShadow: '0 0 10px hsl(var(--primary))' }}
                />
              )}
            </button>
          ));
        })()}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'scribes' && (
          <div className="space-y-4">
            {mockScribes.slice(0, 9).map((scribe, i) => (
              <motion.div
                key={scribe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ScribeCard
                  scribe={scribe}
                  onUserClick={() => navigate(`/profile/${scribe.user.id}`)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'omzos' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {mockOmzos.map((omzo, i) => (
              <motion.div
                key={omzo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="aspect-[9/16] bg-secondary rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
                onClick={() => navigate(`/omzo?omzoId=${omzo.id}`)}
              >
                <video
                  src={omzo.videoUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="text-white text-xs font-medium">{omzo.caption}</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-12 h-12 text-white drop-shadow-lg" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'reposts' && (
          <div className="space-y-4">
            {mockReposts.filter(r => r.user.id === user.id).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Repeat2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No reposts yet</p>
              </div>
            )}

            {mockReposts.filter(r => r.user.id === user.id).map((repost, i) => (
              <motion.div
                key={repost.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="text-sm text-muted-foreground mb-2">Reposted by @{repost.user.username}</div>
                <ScribeCard
                  scribe={repost.original}
                  onUserClick={() => navigate(`/profile/${repost.original.user.id}`)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="py-12 text-center text-muted-foreground">
            <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No saved items yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
