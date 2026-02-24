from django.contrib.auth import login, logout, authenticate
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
import json


@require_http_methods(["POST"])
def api_login(request):
    """API endpoint for React frontend login"""
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return JsonResponse({
                'success': False,
                'error': 'Username and password are required'
            }, status=400)

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            user.mark_online()

            return JsonResponse({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'display_name': user.full_name or user.username,
                    'email': user.email,
                    'avatar': user.profile_picture.url if user.profile_picture else '',
                    'is_verified': user.is_verified,
                    'is_online': True,
                }
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid username or password'
            }, status=401)

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["POST"])
def api_logout(request):
    """API endpoint for React frontend logout"""
    if request.user.is_authenticated:
        request.user.mark_offline()
        logout(request)
    return JsonResponse({'success': True})


@require_http_methods(["GET", "POST"])
def api_profile(request):
    """API endpoint to get or update current user profile"""
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'Not authenticated'
        }, status=401)

    user = request.user

    if request.method == 'POST':
        try:
            # Handle file upload
            if 'avatar' in request.FILES:
                user.profile_picture = request.FILES['avatar']

            # Handle text fields
            display_name = request.POST.get('displayName')
            if display_name:
                user.full_name = display_name

            user.save()

            return JsonResponse({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'display_name': user.full_name or user.username,
                    'email': user.email,
                    'avatar': user.profile_picture.url if user.profile_picture else '',
                    'is_verified': user.is_verified,
                    'is_online': user.is_online,
                    'is_private': user.is_private,
                }
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    return JsonResponse({
        'user': {
            'id': user.id,
            'username': user.username,
            'display_name': user.full_name or user.username,
            'email': user.email,
            'avatar': user.profile_picture.url if user.profile_picture else '',
            'is_verified': user.is_verified,
            'is_online': user.is_online,
            'is_private': user.is_private,
        }
    })


@ensure_csrf_cookie
@require_http_methods(["GET"])
def get_csrf_token(request):
    """Get CSRF token for API requests"""
    return JsonResponse({'success': True})


@require_http_methods(["GET"])
def api_user_profile(request, username):
    """API endpoint to get user profile by username"""
    from django.shortcuts import get_object_or_404
    from ..models import CustomUser, Follow

    # Get the user by username or 'me' for current user
    if username == 'me':
        if not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Not authenticated'
            }, status=401)
        user = request.user
    else:
        user = get_object_or_404(CustomUser, username=username)

    # Get user's scribes
    from ..models import Scribe, Omzo, Like, Dislike, SavedScribeItem, SavedOmzoItem

    scribes_queryset = Scribe.objects.filter(user=user).select_related(
        'user',
        'original_scribe', 'original_scribe__user',
        'original_omzo', 'original_omzo__user',
        'original_story', 'original_story__user'
    ).order_by('-timestamp')

    scribes_data = []
    reposts_data = []

    for scribe in scribes_queryset:
        is_liked = Like.objects.filter(scribe=scribe, user=request.user).exists(
        ) if request.user.is_authenticated else False
        is_disliked = Dislike.objects.filter(scribe=scribe, user=request.user).exists(
        ) if request.user.is_authenticated else False
        is_saved = SavedScribeItem.objects.filter(scribe=scribe, user=request.user).exists(
        ) if request.user.is_authenticated else False

        # Determine type correctly: if it has an image and type is text (default), it's an image scribe
        scribe_type = getattr(scribe, 'content_type', 'text')
        if scribe.image and (not scribe_type or scribe_type == 'text'):
            scribe_type = 'image'

        # Check if this is a repost
        is_repost = bool(
            scribe.original_scribe or scribe.original_omzo or scribe.original_story)

        # Build scribe data
        scribe_obj = {
            'id': scribe.id,
            'content': scribe.content,
            'timestamp': scribe.timestamp,
            'type': scribe_type,
            'media_url': scribe.image.url if scribe.image else None,
            'likes': scribe.scribe_likes.count(),
            'dislikes': scribe.scribe_dislikes.count(),
            'comments': scribe.comments.count(),
            'reposts': scribe.reposts.count(),
            'is_liked': is_liked,
            'is_disliked': is_disliked,
            'is_saved': is_saved,
            'code_html': getattr(scribe, 'code_html', ''),
            'code_css': getattr(scribe, 'code_css', ''),
            'code_js': getattr(scribe, 'code_js', ''),
            'is_repost': is_repost,
        }

        # If it's a repost, add original content information
        if is_repost:
            original_data = None
            original_type = None

            if scribe.original_scribe:
                original = scribe.original_scribe
                original_type = 'scribe'
                original_data = {
                    'id': original.id,
                    'content': original.content,
                    'timestamp': original.timestamp,
                    'type': getattr(original, 'content_type', 'text'),
                    'media_url': original.image.url if original.image else None,
                    'likes': original.scribe_likes.count(),
                    'comments': original.comments.count(),
                    'reposts': original.reposts.count(),
                    'user': {
                        'id': str(original.user.id),
                        'username': original.user.username,
                        'display_name': original.user.full_name or original.user.username,
                        'avatar': original.user.profile_picture.url if original.user.profile_picture else '',
                        'is_verified': original.user.is_verified,
                    }
                }
            elif scribe.original_omzo:
                original = scribe.original_omzo
                original_type = 'omzo'
                original_data = {
                    'id': original.id,
                    'caption': original.caption,
                    'video_url': original.video_file.url if original.video_file else None,
                    'timestamp': original.created_at,
                    'likes': original.likes.count(),
                    'comments': original.comments.count(),
                    'views': original.views_count,
                    'user': {
                        'id': str(original.user.id),
                        'username': original.user.username,
                        'display_name': original.user.full_name or original.user.username,
                        'avatar': original.user.profile_picture.url if original.user.profile_picture else '',
                        'is_verified': original.user.is_verified,
                    }
                }
            elif scribe.original_story:
                original = scribe.original_story
                original_type = 'story'
                original_data = {
                    'id': original.id,
                    'timestamp': original.created_at,
                    'user': {
                        'id': str(original.user.id),
                        'username': original.user.username,
                        'display_name': original.user.full_name or original.user.username,
                        'avatar': original.user.profile_picture.url if original.user.profile_picture else '',
                        'is_verified': original.user.is_verified,
                    }
                }

            scribe_obj['original_type'] = original_type
            scribe_obj['original_data'] = original_data

            # Add to reposts list
            reposts_data.append(scribe_obj)
        else:
            # Add to regular scribes list
            scribes_data.append(scribe_obj)

    # Get user's omzos
    omzos_queryset = Omzo.objects.filter(user=user).order_by('-created_at')
    omzos_data = []

    for omzo in omzos_queryset:
        is_liked = omzo.is_liked_by(
            request.user) if request.user.is_authenticated else False
        is_saved = SavedOmzoItem.objects.filter(omzo=omzo, user=request.user).exists(
        ) if request.user.is_authenticated else False
        repost_count = Scribe.objects.filter(original_omzo=omzo).count()
        is_reposted = Scribe.objects.filter(user=request.user, original_omzo=omzo, quote_source__isnull=True).exists(
        ) if request.user.is_authenticated else False

        omzos_data.append({
            'id': omzo.id,
            'caption': omzo.caption,
            'video_url': omzo.video_file.url if omzo.video_file else None,
            'timestamp': omzo.created_at,
            'likes': omzo.likes.count(),
            'dislikes': omzo.dislikes.count(),
            'shares': 0,  # Placeholder
            'views': omzo.views_count,
            'comments': omzo.comments.count(),
            'is_liked': is_liked,
            'is_saved': is_saved,
            'reposts': repost_count,
            'is_reposted': is_reposted,
        })

    return JsonResponse({
        'user': {
            'id': str(user.id),
            'username': user.username,
            'display_name': user.full_name or user.username,
            'email': user.email,
            'avatar': user.profile_picture.url if user.profile_picture else '',
            'is_verified': user.is_verified,
            'is_online': user.is_online,
            'is_private': user.is_private,
            'followers_count': user.follower_count,
            'following_count': user.following_count,
            'is_following': Follow.objects.filter(follower=request.user, following=user).exists() if request.user.is_authenticated and username != 'me' and user != request.user else False,
        },
        'scribes': scribes_data,
        'reposts': reposts_data,
        'omzos': omzos_data
    })
