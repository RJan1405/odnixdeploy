import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { ScribeCard } from '@/components/ScribeCard';
import { UserCard } from '@/components/UserCard';
import { api } from '@/services/api';
import type { User, Scribe } from '@/services/api';

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Real data from Django
  const [scribes, setScribes] = useState<Scribe[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const [mixedItems, usersData] = await Promise.all([
        api.getExploreFeed(pageNum),
        pageNum === 1 ? api.searchUsers('') : Promise.resolve(null) // Only fetch users once
      ]);

      // Normalize items (Omzo -> Scribe-like with type='video')
      const normalizedItems: Scribe[] = mixedItems.map((item: any) => {
        if (item.feedType === 'omzo') {
          return {
            id: item.id,
            user: item.user,
            content: item.caption,
            type: 'video',
            mediaUrl: item.videoUrl,
            likes: item.likes,
            dislikes: item.dislikes,
            comments: item.comments || 0,
            reposts: item.shares || 0,
            createdAt: item.createdAt,
            isLiked: item.isLiked,
            isDisliked: item.isDisliked,
            isSaved: item.isSaved,
            isReposted: item.isReposted,
            feedType: 'omzo' // IMPORTANT: Preserve feedType so ScribeCard knows it's an Omzo
          } as Scribe;
        }
        return item as Scribe;
      });

      if (normalizedItems.length < 10) setHasMore(false); // Assuming limit is 10/15

      setScribes(prev => pageNum === 1 ? normalizedItems : [...prev, ...normalizedItems]);
      if (usersData) setSuggestedUsers(usersData.slice(0, 3));

    } catch (error) {
      console.error('Error fetching explore data:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFeed(1);
  }, [fetchFeed]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(p => {
            const nextPage = p + 1;
            fetchFeed(nextPage);
            return nextPage;
          });
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchFeed]);


  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      const results = await api.searchUsers(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Insert suggested users between scribes
  const feedWithSuggestions = scribes.flatMap((scribe, index) => {
    if (index === 1 && suggestedUsers.length > 0) {
      return [
        { type: 'suggestions' as const, id: 'suggestions' },
        { type: 'scribe' as const, data: scribe },
      ];
    }
    return [{ type: 'scribe' as const, data: scribe }];
  });

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-4">
      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 py-4 bg-background/80 backdrop-blur-lg z-10"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users or scribes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 glass-card rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Search Results */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3 mb-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Search Results
          </h3>
          {searchResults.length > 0 ? (
            searchResults.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onClick={() => navigate(`/profile/${user.username}`)}
              />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No users found
            </p>
          )}
        </motion.div>
      )}

      {/* Scribes Feed */}
      {!isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {scribes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No posts yet. Be the first to post!</p>
            </div>
          ) : (
            <>
              {feedWithSuggestions.map((item, index) => {
                if (item.type === 'suggestions') {
                  return (
                    <motion.div
                      key="suggestions"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="glass-card rounded-2xl p-4"
                    >
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Suggested for you
                      </h3>
                      <div className="space-y-3">
                        {suggestedUsers.map((user) => (
                          <UserCard
                            key={user.id}
                            user={user}
                            onClick={() => navigate(`/profile/${user.username}`)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={item.data.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ScribeCard
                      scribe={item.data}
                      onUserClick={() => navigate(`/profile/${item.data.user.username}`)}
                    />
                  </motion.div>
                );
              })}

              {/* Load More Sentinel */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
