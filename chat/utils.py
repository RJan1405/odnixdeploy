from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Message


def notify_sidebar_for_chat(chat, sender, last_message_text):
    channel_layer = get_channel_layer()

    recipients = chat.participants.exclude(id=sender.id)

    for user in recipients:
        unread_count = Message.objects.filter(
            chat=chat
        ).exclude(
            sender=user
        ).exclude(
            read_receipts__user=user
        ).count()

        async_to_sync(channel_layer.group_send)(
            f"sidebar_{user.id}",
            {
                "type": "sidebar_update",
                "chat_id": chat.id,
                "unread_count": unread_count,
                "last_message": last_message_text,
            }
        )


def broadcast_message_to_chat(chat, message, exclude_sender=True):
    """
    Broadcast a new message to all participants in the chat via WebSocket.
    This is used when messages are sent via HTTP (e.g., media uploads).
    """
    channel_layer = get_channel_layer()
    
    message_data = {
        "id": message.id,
        "content": message.content,
        "sender": message.sender.username,
        "sender_name": message.sender.full_name,
        "sender_avatar": message.sender.profile_picture_url if hasattr(message.sender, 'profile_picture_url') else None,
        "sender_initials": message.sender.initials if hasattr(message.sender, 'initials') else message.sender.username[0].upper(),
        "timestamp": message.timestamp.strftime("%H:%M"),
        "timestamp_iso": message.timestamp.isoformat(),
        "is_read": False,
        "one_time": message.one_time,
        "consumed": bool(message.consumed_at) if hasattr(message, 'consumed_at') else False,
        "sender_id": message.sender_id,
        "message_type": message.message_type,
        "media_url": message.media_url if hasattr(message, 'media_url') else None,
        "media_type": message.media_type if hasattr(message, 'media_type') else None,
        "media_filename": message.media_filename if hasattr(message, 'media_filename') else None,
        "has_media": message.has_media if hasattr(message, 'has_media') else False,
        "reply_to": {
            "id": message.reply_to.id,
            "content": message.reply_to.content,
            "sender_name": message.reply_to.sender.full_name
        } if message.reply_to else None
    }
    
    # Send to the chat group - the consumer will handle distribution
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat.id}",
        {
            "type": "chat_message",
            "message": message_data,
            "exclude_sender_id": message.sender_id if exclude_sender else None
        }
    )


def broadcast_message_consumed(chat, message, consumed_by_user):
    """
    Broadcast that a one-time message has been consumed to all participants.
    This ensures the sender sees the updated status immediately.
    """
    channel_layer = get_channel_layer()
    
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat.id}",
        {
            "type": "message_consumed",
            "message_id": message.id,
            "consumed_by": consumed_by_user.id,
            "consumed_at": message.consumed_at.isoformat() if message.consumed_at else None
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

