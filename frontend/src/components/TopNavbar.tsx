import { useNavigate } from 'react-router-dom';
import { NotificationDropdown } from './NotificationDropdown';
import { Avatar } from './Avatar';
import { Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Improved TopNavbar: integrated, sticky, matches MainLayout style
export default function TopNavbar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-md border-b border-border/50">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold gradient-text">Odnix</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-secondary glass-card rounded-full px-3 py-1 gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <NotificationDropdown />

          <button onClick={() => navigate('/profile/me')} aria-label="Profile">
            <Avatar
              src={user?.avatar || ''}
              alt={user?.displayName || 'User'}
              size="sm"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
