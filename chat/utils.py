from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Message


def notify_sidebar_for_chat(chat, sender, last_message_text):
    channel_layer = get_channel_layer()

    recipients = chat.participants.exclude(id=sender.id)

    for user in recipients:
        unread_count = Message.objects.filter(
            chat=chat,
            is_read=False
        ).exclude(sender=user).count()

        async_to_sync(channel_layer.group_send)(
            f"sidebar_{user.id}",
            {
                "type": "sidebar_update",
                "chat_id": chat.id,
                "unread_count": unread_count,
                "last_message": last_message_text,
            }
        )


# chat/utils.py

def clear_sidebar_unread(chat, user):
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"sidebar_{user.id}",
        {
            "type": "sidebar_update",
            "chat_id": chat.id,
            "unread_count": 0,
            "last_message": chat.messages.order_by('-timestamp').first().content if chat.messages.exists() else ''
        }
    )
