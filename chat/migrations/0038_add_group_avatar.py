from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0037_add_chat_acceptance'),
    ]

    operations = [
        migrations.AddField(
            model_name='chat',
            name='group_avatar',
            field=models.ImageField(upload_to='group_avatars/', blank=True, null=True),
        ),
    ]
