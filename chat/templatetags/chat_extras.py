from django import template
from chat.models import Follow, Scribe, Omzo, Story

register = template.Library()

@register.filter(name='is_followed_by')
def is_followed_by(user, observer):
    """
    Returns True if the user is being followed by the observer.
    Usage: {{ target_user|is_followed_by:request.user }}
    """
    if not observer or not observer.is_authenticated:
        return False
    # Check simple case (user following themselves is usually irrelevant here but let's return False)
    if user == observer:
        return False
    
    return Follow.objects.filter(follower=observer, following=user).exists()

@register.filter
def get_shared_content(reactions):
    """
    Extracts shared content object from message reactions JSON.
    Usage: {{ message.reactions|get_shared_content }}
    """
    if not isinstance(reactions, dict):
        return None
        
    shared_data = reactions.get('shared_content')
    if not shared_data:
        return None
        
    content_type = shared_data.get('type')
    
    try:
        if content_type == 'scribe':
            return Scribe.objects.get(id=shared_data.get('scribe_id'))
        elif content_type == 'omzo':
            return Omzo.objects.get(id=shared_data.get('omzo_id'))
        elif content_type == 'story':
            return Story.objects.get(id=shared_data.get('story_id'))
    except (Scribe.DoesNotExist, Omzo.DoesNotExist, Story.DoesNotExist):
        return None
        
    return None

@register.filter
def get_content_type(reactions):
    if not isinstance(reactions, dict):
        return None
    return reactions.get('shared_content', {}).get('type')
