# Quick Setup Guide: Testing Read Receipts & Notification Badges

## Prerequisites

- Django backend running at `http://localhost:8000`
- React Native app configured to connect to backend
- At least 2 user accounts for testing

## Backend Setup

### 1. Apply Migrations (if needed)

```bash
cd react-odnix
python manage.py makemigrations
python manage.py migrate
```

### 2. Verify URLs are registered

Check that `chat/urls.py` includes:

```python
from .views import read_receipts

path('api/messages/mark-read/', read_receipts.mark_messages_read, name='api_mark_messages_read'),
path('api/chat/<int:chat_id>/mark-read/', read_receipts.mark_chat_read, name='api_mark_chat_read'),
path('api/unread-counts/', read_receipts.get_unread_counts, name='api_unread_counts'),
```

### 3. Start Django Server

```bash
python manage.py runserver
```

### 4. Start Channels/WebSocket Server

If using separate Daphne server:

```bash
daphne -b 0.0.0.0 -p 8001 odnix.asgi:application
```

Or if using single server with Channels:

```bash
python manage.py runserver 0.0.0.0:8000
```

## Mobile App Setup

### 1. Install Dependencies

```bash
cd odnix-mobile
npm install
# or
bun install
```

### 2. Configure API Endpoints

Check `src/config/index.ts`:

```typescript
export const API_CONFIG = {
    BASE_URL: 'http://YOUR_IP:8000',
    WS_URL: 'ws://YOUR_IP:8000',
    TIMEOUT: 30000,
};
```

Replace `YOUR_IP` with your computer's local IP address (not localhost).

### 3. Start Metro Bundler

```bash
npm start
# or
bun start
```

### 4. Run on Android

```bash
cd odnix-mobile
npm run android
# or
bun run android
```

## Testing Scenarios

### Scenario 1: Basic Read Receipts

**Setup:**

1. Login as User A on one device/emulator
2. Login as User B on another device/emulator

**Test Steps:**

1. User A sends message to User B
2. Verify User B sees notification badge with count = 1
3. User B opens chat
4. Verify badge disappears immediately
5. Verify User A sees green double-check (✓✓) on their message
6. Verify backend log shows: `User {B_id} marked X messages as read in chat {chat_id}`

**Expected Results:**

- ✅ Badge appears on User B's chat list
- ✅ Badge disappears when User B opens chat
- ✅ User A's checkmark turns green
- ✅ WebSocket broadcasts read receipt

### Scenario 2: Multiple Unread Messages

**Test Steps:**

1. User A sends 5 messages to User B
2. User B does NOT open chat
3. Verify badge shows "5"
4. User A sends 3 more messages
5. Verify badge updates to "8"
6. User B opens chat
7. Verify all 8 messages marked as read
8. Verify badge resets to 0

**Expected Results:**

- ✅ Badge increments correctly
- ✅ All messages marked as read in one operation
- ✅ Efficient bulk update (check backend logs)

### Scenario 3: Real-Time Updates

**Test Steps:**

1. User A has chat with User B open
2. User B opens same chat
3. User A sends message
4. DO NOT refresh User B's screen
5. Verify User B sees new message appear
6. Wait 1 second
7. Verify User A's checkmark turns green

**Expected Results:**

- ✅ Message appears via WebSocket
- ✅ Auto-marked as read after 1 second
- ✅ Read receipt broadcast back to User A

### Scenario 4: Unread Count Accuracy

**Test Steps:**

1. Create 3 chats for User A
2. Send 2 messages to Chat 1
3. Send 5 messages to Chat 2
4. Send 3 messages to Chat 3
5. Check User A's chat list
6. Verify counts: Chat 1 (2), Chat 2 (5), Chat 3 (3)
7. Open Chat 2
8. Return to chat list
9. Verify counts: Chat 1 (2), Chat 2 (0), Chat 3 (3)

**Expected Results:**

- ✅ Each chat shows correct unread count
- ✅ Opening chat resets only that chat's count
- ✅ Other chats unaffected

### Scenario 5: Offline/Online Sync

**Test Steps:**

1. User A sends 10 messages to User B
2. User B's app is closed
3. User B opens app (cold start)
4. Verify chat list loads
5. Verify badge shows "10"
6. Open chat
7. Verify all marked as read
8. Close and reopen app
9. Verify badge still shows "0"

**Expected Results:**

- ✅ Unread counts persist across app restarts
- ✅ Read receipts synced to backend
- ✅ No phantom unread messages

## API Testing with curl

### Mark Messages as Read

```bash
curl -X POST http://localhost:8000/api/messages/mark-read/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_AUTH_TOKEN" \
  -d '{
    "chat_id": 1,
    "message_ids": [1, 2, 3]
  }'
```

### Mark Entire Chat as Read

```bash
curl -X POST http://localhost:8000/api/chat/1/mark-read/ \
  -H "Authorization: Token YOUR_AUTH_TOKEN"
```

### Get Unread Counts

```bash
curl http://localhost:8000/api/unread-counts/ \
  -H "Authorization: Token YOUR_AUTH_TOKEN"
```

## Debugging

### Check WebSocket Connection

In mobile app console:

```
[LOG] Connected to chat 123
[LOG] 📨 WebSocket message received: {type: "message.new", ...}
[LOG] ✓✓ Message read: {message_id: 456, read_by: 789, ...}
```

### Check Backend Logs

```
User 2 marked 5 messages as read in chat 1
📬 Read receipt sent for message 123
✅ Sidebar update sent to user 2
```

### Check Database

```sql
-- Check MessageRead records
SELECT * FROM chat_messageread WHERE message_id = 123;

-- Check unread count for user
SELECT COUNT(*) FROM chat_message m
WHERE m.chat_id = 1
  AND m.sender_id != 2
  AND NOT EXISTS (
    SELECT 1 FROM chat_messageread mr
    WHERE mr.message_id = m.id AND mr.user_id = 2
  );
```

## Common Issues

### Issue: Badges not updating

**Solution:**

1. Check API_CONFIG in mobile app points to correct IP
2. Verify backend is accessible from mobile device
3. Check WebSocket connection log
4. Call `updateUnreadCounts()` manually to force refresh

### Issue: Read receipts not showing

**Solution:**

1. Verify WebSocket connection is active
2. Check `onReadReceipt` callback is registered
3. Look for WebSocket errors in console
4. Verify backend broadcasts message_read event

### Issue: Messages marked as read immediately

**Solution:**

1. This is expected behavior when opening a chat
2. To disable auto-mark, comment out `markChatAsRead(chatId)` in ChatScreen.tsx
3. Or increase the 1-second delay in the message callback

### Issue: Unread count incorrect after app restart

**Solution:**

1. Check `loadChats()` calls `updateUnreadCounts()`
2. Verify API endpoint returns correct counts
3. Clear app cache and restart

## Performance Testing

### Load Test: 100 Messages

```bash
# Send 100 messages to one chat
for i in {1..100}; do
  curl -X POST http://localhost:8000/api/send-message/ \
    -H "Authorization: Token TOKEN" \
    -F "chat_id=1" \
    -F "content=Test message $i"
  sleep 0.1
done

# Mark all as read
curl -X POST http://localhost:8000/api/chat/1/mark-read/ \
  -H "Authorization: Token TOKEN"
```

**Expected:**

- Bulk operation completes in < 1 second
- Single DB transaction for all MessageRead records
- One WebSocket broadcast per message

### Stress Test: Multiple Chats

- Create 50 chats for one user
- Send 10 messages to each
- Call `/api/unread-counts/`
- Should return in < 500ms

## Success Criteria

✅ **Read Receipts**

- [ ] Checkmarks change from gray to green
- [ ] Updates happen in real-time
- [ ] Persists after app restart

✅ **Notification Badges**

- [ ] Shows correct count on chat list
- [ ] Updates when new messages arrive
- [ ] Clears when opening chat
- [ ] Accurate across all chats

✅ **Performance**

- [ ] Bulk operations complete quickly
- [ ] No N+1 query issues
- [ ] WebSocket reconnects automatically

✅ **User Experience**

- [ ] No false unread notifications
- [ ] Instant UI feedback
- [ ] Smooth animations
- [ ] No lag or freezing

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Test on real devices (not just emulators)
3. Monitor WebSocket connection stability
4. Check database performance at scale
5. Consider adding push notifications
6. Implement read receipt privacy settings

## Support

If you encounter issues:

1. Check [READ_RECEIPTS_IMPLEMENTATION.md](READ_RECEIPTS_IMPLEMENTATION.md) for detailed docs
2. Review backend logs in `react-odnix/logs/`
3. Check mobile console logs
4. Verify WebSocket server is running
5. Test API endpoints directly with curl

## Summary

This implementation provides:

- ✅ Real-time read receipts
- ✅ Accurate unread count badges
- ✅ Efficient backend operations
- ✅ Smooth mobile UX
- ✅ Offline support and persistence

Happy testing! 🚀
