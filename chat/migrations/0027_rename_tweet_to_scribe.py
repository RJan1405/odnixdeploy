# Generated manually to rename Tweet model to Scribe

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0026_add_all_theme_choices'),
    ]

    operations = [
        # Rename the Tweet model to Scribe
        migrations.RenameModel(
            old_name='Tweet',
            new_name='Scribe',
        ),
        # Rename the TweetHashtag model to ScribeHashtag
        migrations.RenameModel(
            old_name='TweetHashtag',
            new_name='ScribeHashtag',
        ),
        # Rename the foreign key fields from 'tweet' to 'scribe'
        migrations.RenameField(
            model_name='comment',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='like',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='dislike',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='savedpost',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='postreport',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='scribehashtag',
            old_name='tweet',
            new_name='scribe',
        ),
        migrations.RenameField(
            model_name='mention',
            old_name='tweet',
            new_name='scribe',
        ),
    ]
