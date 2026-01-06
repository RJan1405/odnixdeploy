# Generated migration for omzo audio mute feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0017_omzo_copyright_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='omzo',
            name='is_muted',
            field=models.BooleanField(
                default=False, help_text='If True, audio will be disabled for all users'),
        ),
        migrations.AddField(
            model_name='omzoreport',
            name='disable_audio',
            field=models.BooleanField(
                default=False, help_text='If checked, audio will be disabled for this omzo'),
        ),
    ]
