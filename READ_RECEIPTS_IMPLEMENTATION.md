# Read Receipts and Notification Badge Management

## Overview

This document explains the implementation of read receipts and notification badge management in the Odnix mobile app, connecting with the Django backend.

## Architecture

### Backend (Django)

#### 1. Models (`chat/models.py`)

- **`MessageRead`**: Tracks which users have read which messages
  - `message`: ForeignKey to Message
  - `user`: ForeignKey to CustomUser
  - `read_at`: Timestamp when message was read
  - Unique constraint on (message, user)

#### 2. API Endpoints (`chat/views/read_receipts.py`)

**Mark Multiple Messages as Read**

- **URL**: `POST /api/messages/mark-read/`
- **Body**:

  ```json
  {
    "chat_id": 123,
    "message_ids": [456, 789]  // Optional: specific messages
  }
  ```

- **Response**:

  ```json
  {
    "success": true,
    "marked_count": 2,
    "unread_count": 5,
    "marked_message_ids": [456, 789]
  }
  ```

- **Features**:
  - Bulk creates MessageRead records
  - Broadcasts read receipts via WebSocket
  - Returns remaining unread count

**Mark Entire Chat as Read**

- **URL**: `POST /api/chat/<chat_id>/mark-read/`
- **Response**:

  ```json
  {
    "success": true,
    "marked_count": 10,
    "unread_count": 0
  }
  ```

- **Features**:
  - Marks all unread messages in a chat
  - Broadcasts to all participants

**Get Unread Counts**

- **URL**: `GET /api/unread-counts/`
- **Response**:

  ```json
  {
    "success": true,
    "counts": {
      "123": 5,
      "456": 2
    },
    "total_unread": 7
  }
  ```

- **Features**:
  - Returns unread count for all user's chats
  - Used for badge updates

#### 3. WebSocket Consumer (`chat/consumers.py`)

**Read Receipt Broadcasting**
The `ChatConsumer` already handles read receipt broadcasting:

```python
async def handle_message_read(self, data):
    message_id = data.get("message_id")
    await self.mark_message_read(message_id)
    
    # Broadcast to all in chat
    await self.channel_layer.group_send(
        self.group_name,
        {
            "type": "message_read",
            "message_id": message_id,
            "read_by": self.user.id,
            "read_at": timezone.now().isoformat()
        }
    )
```

**Unread Count Updates**
The consumer includes helper method:

```python
@database_sync_to_async
def get_unread_count_for_user(self, user_id):
    """Get unread message count for a specific user in this chat"""
    return Message.objects.filter(
        chat_id=self.chat_id
    ).exclude(
        sender_id=user_id
    ).exclude(
        read_receipts__user_id=user_id
    ).count()
```

### Mobile App (React Native)

#### 1. API Service (`src/services/api.ts`)

**New Methods Added**:

```typescript
async markMessagesRead(chatId: number, messageIds?: number[])
async markChatRead(chatId: number)
async getUnreadCounts()
```

#### 2. WebSocket Service (`src/services/websocket.ts`)

**Enhanced Features**:

- Read receipt callback support
- Proper event type handling
- Auto-reconnection with read receipt persistence

**New Methods**:

```typescript
sendReadReceipt(chatId: number, messageId: number): void
onReadReceipt(chatId: number, callback: ReadReceiptCallback): () => void
```

**Event Handling**:

```typescript
if (data.type === 'message.read') {
    readCallbacks.forEach(cb => cb({
        message_id: data.message_id,
        read_by: data.read_by,
        read_at: data.read_at
    }));
}
```

#### 3. Chat Store (`src/stores/chatStore.ts`)

**New State**:

```typescript
unreadCounts: Map<number, number>
```

**New Actions**:

**`markMessagesAsRead(chatId, messageIds?)`**

- Calls backend API
- Updates local message states
- Updates unread count in chat list
- Syncs unread counts map

**`markChatAsRead(chatId)`**

- Marks all messages as read
- Resets unread count to 0
- Updates UI immediately

**`updateUnreadCounts()`**

- Fetches latest unread counts from backend
- Updates all chat badges
- Called on mount and periodically

**`updateChatUnreadCount(chatId, count)`**

- Updates single chat's unread count
- Used for real-time updates

#### 4. Chat Screen (`src/screens/Chat/ChatScreen.tsx`)

**Auto-Mark as Read**:

```typescript
useEffect(() => {
    loadMessages(chatId);
    markChatAsRead(chatId); // Mark as read when opening chat
    
    // Listen for new messages
    const unsubscribe = websocket.connectToChat(chatId, (message) => {
        addMessage(chatId, message);
        // Auto-mark new incoming messages
        if (message.sender?.id !== user?.id) {
            setTimeout(() => markChatAsRead(chatId), 1000);
        }
    });
    
    // Listen for read receipts
    const unsubscribeReadReceipt = websocket.onReadReceipt(chatId, (data) => {
        updateMessage(chatId, data.message_id, { is_read: true });
    });
    
    return () => {
        unsubscribe();
        unsubscribeReadReceipt();
    };
}, [chatId]);
```

**Read Receipt UI**:

```typescript
{isOwnMessage && (
    <Icon 
        name={item.is_read ? "checkmark-done" : "checkmark-done-outline"} 
        size={14} 
        color={item.is_read ? '#10B981' : colors.textSecondary} 
    />
)}
```

- **Green double-check**: Message has been read
- **Gray double-check**: Message delivered but not read

#### 5. Chat List Screen (`src/screens/Chat/ChatListScreen.tsx`)

**Unread Badge Display**:

```typescript
{item.unread_count > 0 && (
    <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.unread_count}</Text>
    </View>
)}
```

**Periodic Refresh**:

```typescript
useEffect(() => {
    const interval = setInterval(() => {
        updateUnreadCounts();
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
}, []);
```

## Data Flow

### Message Sent Flow

1. User A sends message to User B
2. Message saved to database with `is_read=False`
3. WebSocket broadcasts message to User B
4. User B's unread count increases

### Message Read Flow

1. User B opens chat
2. `markChatAsRead(chatId)` called
3. API creates `MessageRead` records in bulk
4. Backend broadcasts read receipts via WebSocket
5. User A receives read receipt
6. User A's UI updates checkmark to green
7. User B's unread count resets to 0

### Real-Time Updates

1. **New Message**: WebSocket → Chat Store → UI update → Badge update
2. **Read Receipt**: WebSocket → Update message state → Update checkmark
3. **Unread Counts**: HTTP polling (30s) + WebSocket events

## Features

### ✅ Implemented Features

1. **Read Receipts**
   - Double-check icon (gray = delivered, green = read)
   - Real-time updates via WebSocket
   - Persistent storage in database

2. **Notification Badges**
   - Per-chat unread counts
   - Real-time updates
   - Accurate tracking using MessageRead model

3. **Auto-Mark as Read**
   - Messages marked read when opening chat
   - New messages auto-marked after 1 second
   - Efficient bulk operations

4. **Unread Count Management**
   - Periodic refresh (30 seconds)
   - Real-time WebSocket updates
   - Global unread count tracking

5. **Performance Optimizations**
   - Bulk MessageRead creation
   - Indexes on MessageRead model
   - Efficient queries excluding already-read messages

### 🎯 Best Practices

1. **Backend**
   - Use `bulk_create` for MessageRead records
   - Add `ignore_conflicts=True` to prevent duplicates
   - Broadcast read receipts after DB update
   - Use `select_related` and `prefetch_related` for queries

2. **Mobile**
   - Local state updates for instant UI feedback
   - Optimistic updates before API confirmation
   - WebSocket reconnection handling
   - Periodic polling as fallback

3. **Database**
   - Unique constraint on (message, user)
   - Indexes for faster queries
   - Proper foreign key relationships

## Testing

### Backend Testing

```python
# Test marking messages as read
response = client.post('/api/messages/mark-read/', {
    'chat_id': 1,
    'message_ids': [1, 2, 3]
})
assert response.data['marked_count'] == 3
assert MessageRead.objects.filter(message_id__in=[1,2,3]).count() == 3
```

### Mobile Testing

```typescript
// Test unread counts
await chatStore.updateUnreadCounts();
expect(chatStore.unreadCounts.get(chatId)).toBe(5);

// Test marking as read
await chatStore.markChatAsRead(chatId);
expect(chatStore.unreadCounts.get(chatId)).toBe(0);
```

## Troubleshooting

### Issue: Read receipts not updating

**Solution**: Check WebSocket connection status, ensure `onReadReceipt` callback is registered

### Issue: Unread counts incorrect

**Solution**: Call `updateUnreadCounts()` to sync with backend

### Issue: Messages marked as read too early

**Solution**: Adjust the 1-second delay in ChatScreen or remove auto-marking

## Performance Considerations

1. **Database Queries**
   - MessageRead uses `unique_together` constraint
   - Queries exclude sender and already-read messages
   - Consider archiving old MessageRead records

2. **WebSocket Traffic**
   - Only broadcast to participants in chat
   - Debounce rapid read receipt updates
   - Consider batching read receipts

3. **Mobile App**
   - Use Map for O(1) unread count lookups
   - Periodic refresh prevents stale data
   - WebSocket provides real-time updates

## Future Enhancements

1. **Typing Indicators** (partially implemented)
   - Visual feedback when others are typing
   - Debounced updates to reduce WebSocket traffic

2. **Last Seen Status**
   - Show when user was last online
   - Already tracked in CustomUser model

3. **Message Delivery Status**
   - Three states: sent, delivered, read
   - Currently only tracks read status

4. **Push Notifications**
   - Native mobile notifications for unread messages
   - Badge count on app icon

5. **Read Receipt Privacy**
   - Option to disable read receipts
   - Per-chat settings

## Files Modified

### Backend

- `chat/views/read_receipts.py` (NEW)
- `chat/urls.py` (UPDATED)
- `chat/consumers.py` (already had support)
- `chat/models.py` (MessageRead model already existed)

### Mobile

- `src/services/api.ts` (UPDATED)
- `src/services/websocket.ts` (UPDATED)
- `src/stores/chatStore.ts` (UPDATED)
- `src/screens/Chat/ChatScreen.tsx` (UPDATED)
- `src/screens/Chat/ChatListScreen.tsx` (UPDATED)

## Summary

The read receipt and notification badge system is now fully integrated between the Django backend and React Native mobile app. It uses:

- **REST API** for bulk operations and data fetching
- **WebSocket** for real-time updates
- **Local state management** for instant UI feedback
- **Periodic polling** as fallback for reliability

The implementation follows best practices for performance, reliability, and user experience.
