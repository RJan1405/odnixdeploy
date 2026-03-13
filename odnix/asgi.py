"""
ASGI config for odnix project.
"""

import os
import django
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'odnix.settings')

# Initialize Django BEFORE importing any app code
django.setup()

# Import routing ONLY AFTER django.setup()
from chat import routing


@database_sync_to_async
def get_user_from_token(token_key):
    """Authenticate a WebSocket connection using a DRF Token."""
    try:
        from rest_framework.authtoken.models import Token
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Exception:
        from django.contrib.auth.models import AnonymousUser
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Middleware that reads ?token=<key> from the WebSocket URL query string
    and populates scope['user'] with the authenticated user.
    Falls back to session auth if no token provided (for web clients).
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            token_key = token_list[0]
            scope['user'] = await get_user_from_token(token_key)
        # If no token, leave scope['user'] as set by AuthMiddlewareStack (session-based for web)
        return await super().__call__(scope, receive, send)


application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        TokenAuthMiddleware(
            URLRouter(
                routing.websocket_urlpatterns
            )
        )
    ),
})
