from django.db import models
from django.conf import settings
from .models import Chat, CustomUser


class UserPrivateChat(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)
    is_private = models.BooleanField(default=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'chat')
        verbose_name = 'User Private Chat'
        verbose_name_plural = 'User Private Chats'

    def __str__(self):
        return f"{self.user.username} - {self.chat.id} (private: {self.is_private})"
