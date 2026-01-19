from django.db.models import Count, F, ExpressionWrapper, FloatField, Case, When, Value, IntegerField
from django.db.models.functions import Now, Cast
from django.utils import timezone
from .models import Omzo, Follow, OmzoLike, OmzoDislike, Scribe, Like, Dislike


class ContentRecommender:
    """
    Recommendation Engine for Odnix.
    Implements a weighted scoring algorithm inspired by social media ranking signals.
    
    Like/Dislike Philosophy (based on YouTube, Instagram, TikTok research):
    - Likes are positive signals (user chose to engage)
    - Dislikes are STRONGER negative signals because:
      * Users rarely dislike (it's an active rejection)
      * A dislike means "I don't want to see this type of content"
      * YouTube/TikTok treat "Not Interested" as stronger than likes
    """

    def __init__(self, user):
        self.user = user
        # Cache user's interaction data for efficient lookups
        self._liked_omzo_ids = None
        self._disliked_omzo_ids = None
        self._liked_user_ids = None
        self._disliked_user_ids = None
        # Scribe interactions
        self._liked_scribe_ids = None
        self._disliked_scribe_ids = None
        self._liked_scribe_user_ids = None
        self._disliked_scribe_user_ids = None

    def _get_user_interactions(self):
        """Cache user's likes and dislikes for Omzo scoring"""
        if not self.user.is_authenticated:
            return
        
        if self._liked_omzo_ids is None:
            # Get omzos user has liked
            self._liked_omzo_ids = set(OmzoLike.objects.filter(
                user=self.user).values_list('omzo_id', flat=True))
            
            # Get omzos user has disliked
            self._disliked_omzo_ids = set(OmzoDislike.objects.filter(
                user=self.user).values_list('omzo_id', flat=True))
            
            # Get user IDs whose content user has liked (to boost similar creators)
            liked_omzos = Omzo.objects.filter(id__in=self._liked_omzo_ids)
            self._liked_user_ids = set(liked_omzos.values_list('user_id', flat=True))
            
            # Get user IDs whose content user has disliked (to penalize similar creators)
            disliked_omzos = Omzo.objects.filter(id__in=self._disliked_omzo_ids)
            self._disliked_user_ids = set(disliked_omzos.values_list('user_id', flat=True))

    def _get_scribe_interactions(self):
        """Cache user's likes and dislikes for Scribe scoring"""
        if not self.user.is_authenticated:
            return
        
        if self._liked_scribe_ids is None:
            # Get scribes user has liked
            self._liked_scribe_ids = set(Like.objects.filter(
                user=self.user).values_list('scribe_id', flat=True))
            
            # Get scribes user has disliked
            self._disliked_scribe_ids = set(Dislike.objects.filter(
                user=self.user).values_list('scribe_id', flat=True))
            
            # Get user IDs whose scribes user has liked (to boost similar creators)
            liked_scribes = Scribe.objects.filter(id__in=self._liked_scribe_ids)
            self._liked_scribe_user_ids = set(liked_scribes.values_list('user_id', flat=True))
            
            # Get user IDs whose scribes user has disliked (to penalize similar creators)
            disliked_scribes = Scribe.objects.filter(id__in=self._disliked_scribe_ids)
            self._disliked_scribe_user_ids = set(disliked_scribes.values_list('user_id', flat=True))

    def get_omzo(self, limit=50):
        """
        Get recommended omzo for the user based on:
        1. Engagement (Likes, Comments, Views)
        2. Freshness (Time decay)
        3. Affinity (Following status)
        4. User Preference (Likes boost, Dislikes penalty)
        """
        # 1. Get IDs of users the current user follows
        if self.user.is_authenticated:
            following_ids = list(Follow.objects.filter(
                follower=self.user).values_list('following_id', flat=True))
            # Load user's like/dislike history
            self._get_user_interactions()
        else:
            following_ids = []

        # 2. Annotate omzo with signals
        # We calculate a 'rank_score'.
        # Note: SQLite date math can be tricky, so we'll use a simplified freshness approach
        # or do precise math if using PostgreSQL. For widespread compatibility,
        # we will fetch candidate posts and rank in Python if the dataset is small,
        # OR use robust Django expressions.

        # Let's use a Hybrid: Filter for candidates -> Rank in Python (safer for complex scoring on SQLite)

        # Candidate Generation: Get recent omzo (e.g., last 30 days) to keep query fast
        cutoff = timezone.now() - timezone.timedelta(days=30)
        candidates = Omzo.objects.filter(created_at__gte=cutoff).select_related(
            'user').prefetch_related('likes', 'comments')

        # We can annotate counts effectively in DB
        candidates = candidates.annotate(
            num_likes=Count('likes'),
            num_comments=Count('comments')
        )

        ranked_omzo = []
        now = timezone.now()
        import random

        for omzo in candidates:
            score = 0

            # --- SIGNAL 1: POPULARITY (Engagement) ---
            # Weights: Likes (2.0), Comments (4.0), Views (0.1)
            engagement_score = (omzo.num_likes * 2.0) + \
                (omzo.num_comments * 4.0) + (omzo.views_count * 0.1)
            score += engagement_score

            # --- SIGNAL 2: FRESHNESS (Time Decay) ---
            # Newer posts get significantly higher scores.
            # Formula: 1000 / (hours_old + 2)^1.8
            age_in_hours = (now - omzo.created_at).total_seconds() / 3600
            freshness_score = 1000 / ((age_in_hours + 2) ** 1.8)
            score += freshness_score

            # --- SIGNAL 3: AFFINITY (Relationship) ---
            # If user follows the creator, give a massive boost (e.g., +50)
            if omzo.user_id in following_ids:
                score += 50

            # --- SIGNAL 4: USER PREFERENCE (Dynamic Like/Dislike System) ---
            # Based on YouTube/Instagram/TikTok research:
            # - Dislikes are STRONGER than likes (3x) because users rarely dislike
            # - A dislike is explicit negative feedback ("don't show me this")
            # - Likes are weaker because users like casually
            if self.user.is_authenticated:
                # LIKE SIGNALS
                # Boost if user liked THIS specific omzo (shows interest in this content)
                if self._liked_omzo_ids and omzo.id in self._liked_omzo_ids:
                    score += 15  # Mild boost for already-liked content
                # Boost content from creators user generally likes
                if self._liked_user_ids and omzo.user_id in self._liked_user_ids:
                    score += 20  # Creator affinity boost
                
                # DISLIKE SIGNALS (stronger than likes - industry standard)
                # Penalize if user disliked THIS specific omzo (strong rejection)
                if self._disliked_omzo_ids and omzo.id in self._disliked_omzo_ids:
                    score -= 50  # Strong penalty (3x like boost)
                # Penalize content from creators user has disliked before
                if self._disliked_user_ids and omzo.user_id in self._disliked_user_ids:
                    score -= 35  # Creator penalty (1.75x creator like boost)

            # --- SIGNAL 5: SERENDIPITY (Random Jitter) ---
            # Randomize score broadly (0-400 points) to ensure feed variety on every refresh.
            # This high variance ensures that even lower-ranked omzo have a chance to jump to the top.
            score += random.uniform(0, 400)

            # If it's your own omzo, give it a slight boost so you see it,
            # or penalty if you want to hide own content. Let's boost slightly for confirmation.
            if omzo.user_id == self.user.id:
                score += 10

            ranked_omzo.append((omzo, score))

        # Sort by score descending
        ranked_omzo.sort(key=lambda x: x[1], reverse=True)

        # Deduplicate: Keep track of seen omzo IDs to avoid duplicates
        seen_ids = set()
        unique_omzo = []
        for omzo, score in ranked_omzo:
            if omzo.id not in seen_ids:
                seen_ids.add(omzo.id)
                unique_omzo.append(omzo)
                if len(unique_omzo) >= limit:
                    break

        # Return only the Omzo objects, capped by limit
        return unique_omzo

    def get_explore_feed(self, limit=100):
        """
        Get trending content for Explore page (ignoring follow status).
        """
        # Similar logic but without Affinity boost
        pass

    def get_scribes(self, following_users, limit=20):
        """
        Get recommended scribes for the user based on:
        1. Engagement (Likes, Comments)
        2. Freshness (Time decay)
        3. Affinity (Following status - already filtered)
        4. User Preference (Likes boost, Dislikes penalty)
        """
        from django.db.models import Q
        import random
        
        # Load user's like/dislike history for scribes
        if self.user.is_authenticated:
            self._get_scribe_interactions()
        
        # Get scribes from followed users and own scribes
        cutoff = timezone.now() - timezone.timedelta(days=30)
        candidates = Scribe.objects.filter(
            Q(user__in=following_users) | Q(user=self.user),
            timestamp__gte=cutoff
        ).select_related('user').prefetch_related('comments__user').distinct()
        
        # Annotate with engagement counts
        # Note: Scribe model uses 'scribe_likes' and 'comments' as related names
        candidates = candidates.annotate(
            num_likes=Count('scribe_likes'),
            num_comments=Count('comments')
        )
        
        ranked_scribes = []
        now = timezone.now()
        
        for scribe in candidates:
            score = 0
            
            # --- SIGNAL 1: POPULARITY (Engagement) ---
            # Weights: Likes (2.0), Comments (4.0)
            engagement_score = (scribe.num_likes * 2.0) + (scribe.num_comments * 4.0)
            score += engagement_score
            
            # --- SIGNAL 2: FRESHNESS (Time Decay) ---
            # Newer posts get significantly higher scores.
            age_in_hours = (now - scribe.timestamp).total_seconds() / 3600
            freshness_score = 1000 / ((age_in_hours + 2) ** 1.8)
            score += freshness_score
            
            # --- SIGNAL 3: USER PREFERENCE (Dynamic Like/Dislike System) ---
            # Dislikes weigh more than likes (industry standard from research)
            if self.user.is_authenticated:
                # LIKE SIGNALS
                if self._liked_scribe_ids and scribe.id in self._liked_scribe_ids:
                    score += 15  # Mild boost for already-liked content
                if self._liked_scribe_user_ids and scribe.user_id in self._liked_scribe_user_ids:
                    score += 20  # Creator affinity boost
                
                # DISLIKE SIGNALS (stronger - 3x likes)
                if self._disliked_scribe_ids and scribe.id in self._disliked_scribe_ids:
                    score -= 50  # Strong penalty for disliked content
                if self._disliked_scribe_user_ids and scribe.user_id in self._disliked_scribe_user_ids:
                    score -= 35  # Creator penalty
            
            # --- SIGNAL 4: SERENDIPITY (Random Jitter) ---
            # Randomize to ensure feed variety
            score += random.uniform(0, 200)
            
            # If it's your own scribe, give it a slight boost
            if scribe.user_id == self.user.id:
                score += 10
            
            ranked_scribes.append((scribe, score))
        
        # Sort by score descending
        ranked_scribes.sort(key=lambda x: x[1], reverse=True)
        
        # Deduplicate and limit
        seen_ids = set()
        unique_scribes = []
        for scribe, score in ranked_scribes:
            if scribe.id not in seen_ids:
                seen_ids.add(scribe.id)
                unique_scribes.append(scribe)
                if len(unique_scribes) >= limit:
                    break
        
        return unique_scribes
