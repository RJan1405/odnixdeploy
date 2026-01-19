from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from chat.models import Scribe
import json

User = get_user_model()

from django.urls import reverse

class QuoteScribeTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(username='user1', email='user1@example.com', password='password')
        self.user2 = User.objects.create_user(username='user2', email='user2@example.com', password='password')
        self.url = reverse('post_scribe')
        
        # Create original scribe
        self.scribe1 = Scribe.objects.create(user=self.user1, content='Original Post')
        
    def test_quote_scribe_creation(self):
        self.client.login(username='user2', password='password')
        
        response = self.client.post(self.url, {
            'content': 'This is a quote',
            'repost_type': 'quote',
            'repost_id': self.scribe1.id
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Scribe.objects.filter(user=self.user2, content='This is a quote').exists())
        
        quote = Scribe.objects.get(user=self.user2, content='This is a quote')
        self.assertEqual(quote.quote_source, self.scribe1)
        self.assertFalse(quote.is_repost) # Quote is NOT a repost, it's a new post with reference

    def test_repost_creation(self):
        self.client.login(username='user2', password='password')
        
        response = self.client.post(self.url, {
            'repost_type': 'scribe',
            'repost_id': self.scribe1.id
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Scribe.objects.filter(user=self.user2, original_scribe=self.scribe1).exists())
        repost = Scribe.objects.get(user=self.user2, original_scribe=self.scribe1)
        self.assertTrue(repost.is_repost)
