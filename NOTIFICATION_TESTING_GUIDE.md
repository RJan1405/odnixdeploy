# Test Notification System

## Backend Changes Made:
1. ✅ Added WebSocket notification broadcasting for comments on Scribes
2. ✅ Added WebSocket notification broadcasting for comments on Omzos
3. ✅ Added WebSocket notification broadcasting for follow request acceptances
4. ✅ Added `notify_comment` handler in NotifyConsumer
5. ✅ Added `notify_omzo_comment` handler in NotifyConsumer
6. ✅ Fixed `get_all_activity` response key: 'activity' → 'activity_items'
7. ✅ Fixed activity type names: 'post_like' → 'like', 'post_comment' → 'comment'

## How to Test:

### Test 1: Comment Notifications
1. Open two browser windows (or use incognito for second user)
2. User A: Post a scribe
3. User B: Comment on User A's scribe
4. **Expected**: User A should see a real-time notification popup

### Test 2: Omzo Comment Notifications
1. User A: Upload an omzo
2. User B: Comment on User A's omzo
3. **Expected**: User A should see a real-time notification popup

### Test 3: Follow Request Acceptance
1. User A: Make account private (if not already)
2. User B: Send follow request to User A
3. User A: Accept the follow request
4. **Expected**: User B should see a real-time notification

### Test 4: Historical Notifications
1. Click on the notification bell icon
2. **Expected**: Should see all past notifications (likes, comments, follows, etc.)

## Debugging Steps:

### Check WebSocket Connection
Open browser console (F12) and look for:
```
🔔 Connecting to Notification WebSocket: ws://localhost:8000/ws/notify/
✅ Notification WebSocket connected
```

### Check Notification Reception
When an action happens, you should see:
```
📨 Notification received: {type: 'comment', user_id: ..., ...}
🔔 Real-time notification received in Dropdown: {type: 'comment', ...}
```

### Check Backend Logs
In your Django server terminal, you should see:
```
[NotifyConsumer] WebSocket connected
```

## Common Issues:

### Issue 1: "No notifications yet" in dropdown
**Cause**: Frontend API might not be fetching correctly
**Fix**: Check browser console for API errors

### Issue 2: WebSocket not connecting
**Cause**: Django server not running or CORS issues
**Fix**: Ensure `python manage.py runserver` is running

### Issue 3: Notifications not appearing in real-time
**Cause**: WebSocket connection dropped or not established
**Fix**: Refresh the page and check console for WebSocket connection logs

## API Endpoints:

- **Get Notifications**: `GET /api/activity/`
- **WebSocket**: `ws://localhost:8000/ws/notify/`

## WebSocket Message Types:

The NotifyConsumer now handles these types:
- `like` - Someone liked your scribe
- `comment` - Someone commented on your scribe
- `omzo_like` - Someone liked your omzo
- `omzo_comment` - Someone commented on your omzo
- `follow` - Someone followed you or accepted your follow request
- `post_report` - Your post was reported
- `omzo_report` - Your omzo was reported

## Next Steps:

1. **Restart Django server** (if not already done)
2. **Test each scenario** listed above
3. **Check browser console** for WebSocket logs
4. **Check Django terminal** for backend logs
5. If issues persist, share the console logs for debugging
