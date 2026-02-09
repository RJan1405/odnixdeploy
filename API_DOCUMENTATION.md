# Odnix API Architecture & Documentation

## Overview
Odnix is a comprehensive social media platform built on **Django** (Backend) and **React** (Frontend). The system relies on a hybrid architecture:
1.  **RESTful APIs**: For standard data fetching, submissions, and persistence (via HTTP/HTTPS).
2.  **WebSockets (Django Channels)**: For real-time updates (messages, notifications, active status, signaling).

---

## 1. Authentication & User Profile
These endpoints manage user identity and profile settings.

| Endpoint | Method | Description | Connections |
|----------|--------|-------------|-------------|
| `/api/login/` | POST | Authenticates user credentials. Returns Session/Cookie. | Used by `AuthContext.tsx`. |
| `/api/logout/` | POST | Ends the user session. | Clears frontend state. |
| `/api/profile/` | GET | Fetches the *current* user's full profile details. | Loads the "Me" page. |
| `/api/profile/<username>/` | GET | Fetches *any* public user profile. | Used for visiting others' profiles. |
| `/api/toggle-account-privacy/` | POST | Switches account between Public/Private. | Affects `follow_states` logic. |
| `/api/user/<id>/online-status/` | GET | Checks if a specific user is currently online. | Connected to Redis/Cache presence. |
| `/api/user/update-theme/` | POST | Saves user preference (Dark/Light/Dim). | Persists UI settings. |

---

## 2. The Social Graph
Manages relationships between users (Follows, Blocks, Requests).

### Key Mechanics
*   **Public Profile:** Clicking "Follow" immediately creates a specific relationship.
*   **Private Profile:** Clicking "Follow" creates a *FollowRequest*.
*   **Real-time:** Following a user triggers a `notify.follow` WebSocket event to them.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/toggle-follow/` | POST | Follow/Unfollow a user. **Triggers Notification.** |
| `/api/follow-states/` | POST | Batch check "Am I following these users?" |
| `/api/manage-follow-request/` | POST | Accept or Decline a follower request. |
| `/api/toggle-block/` | POST | Block/Unblock a user (prevents all interaction). |
| `/api/profile/<username>/followers/` | GET | List who follows a user. |
| `/api/profile/<username>/following/` | GET | List who a user follows. |

---

## 3. Communication: Chat & Messaging
The core messaging system. Supports text, media, and "one-time view" messages.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chats/` | GET | distinct list of all conversations (DM & Groups). |
| `/api/chat/<id>/messages/` | GET | Fetches message history with pagination. |
| `/api/send-message/` | POST | Sends a message. **Triggers WebSocket broadcast.** |
| `/api/edit-message/<id>/` | POST | Edits text of an existing message. |
| `/api/delete-message-for-me/<id>/` | POST | Hides message for current user only. |
| `/api/delete-message-for-everyone/<id>/` | POST | Removes message for all participants. |
| `/api/consume-message/<id>/` | POST | Marks "One-time view" message as consumed/deleted. |
| `/api/dm-requests/` | GET | Fetches "Message Requests" from strangers (Instagram-style). |

---

## 4. Content Modules

### A. Scribes (Posts)
Text, Image, or **Code** posts.
*   **Code Scribes:** Special posts containing HTML/CSS/JS that render in an iframe.
*   **Integration:** Hashtags and Mentions are parsed automatically on creation.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/post-scribe/` | POST | Creates a new post. Handles file uploads. |
| `/api/explore-feed/` | GET | Algorithmic feed of content from platform. |
| `/api/toggle-like/` | POST | Likes a post. **Triggers `notify.like`.** |
| `/api/toggle-save-post/` | POST | Bookmarks a post for later. |
| `/api/add-comment/` | POST | Adds a threaded comment. |
| `/api/report-post/` | POST | Flags content. **Triggers `notify.report`.** |

### B. Omzo (Reels/Shorts)
Vertical video content scroll.
*   **Batching:** Uses a cursor-based pagination system for infinite scroll performance.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/omzo/batch/` | GET | Fetches next 10-20 videos. |
| `/api/omzo/upload/` | POST | Uploads/compresses video. |
| `/api/omzo/track-view/` | POST | Analytics for view counts. |
| `/api/omzo/like/` | POST | Like a video. **Triggers `notify.omzo_like`.** |

### C. Stories
Ephemeral content (24h lifespan).
*   **Viewer List:** Tracks exactly who saw the story.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-story/` | POST | Uploads image/video story. |
| `/api/following-stories/` | GET | Feed of stories from people you follow. |
| `/api/story/mark-viewed/` | POST | Adds user to "viewed by" list. |
| `/api/story/add-reply/` | POST | Sends a DM reply to a story. |

---

## 5. Real-Time Architecture (WebSockets)
Odnix uses **Django Channels** to keep clients syncronized.

### 1. Connection Types
*   `ws/chat/<id>/`: Dedicated channel for a specific conversation.
*   `ws/notify/`: Global channel for User Notifications (Likes, Follows).
*   `ws/sidebar/`: Updates the chat list (e.g. "New Message" indicator).
*   `ws/call/<id>/`: Handles WebRTC signaling for Voice/Video calls.

### 2. Event Types
*   **`message.new`**: A new chat message arrived.
*   **`typing.update`**: Someone is typing...
*   **`notify.like`**: "User X liked your scribe".
*   **`notify.follow`**: "User Y started following you".
*   **`incoming.call`**: Triggers the call popup modal.
*   **`webrtc.offer/answer`**: Exchanges connection data for P2P calls.

---

## 6. Global Search & Discovery
*   `/api/global-search/?q=...`: A unified search engine that queries Users, Groups, Scribes, and Omzos simultaneously and returns a mixed result set.
*   `/api/trending-hashtags/`: Aggregates most used tags in the last 24h.

## 7. Groups
*   supports Invite Codes (`/join-group/<code/>`).
*   Admins can remove members (`/api/group/<id>/remove-member/`).
*   Admins can update settings (Name, Description).

---

## 8. Frontend Connection Map (Where they connect)

This section maps the **Backend URL** to the **Frontend Function** in `frontend/src/services/api.ts`. This is exactly "how" they are connected in the code.

| Feature | Backend View (`chat/views/*.py`) | URL Endpoint (`chat/urls.py`) | Frontend Function (`services/api.ts`) | Usage Component |
| :--- | :--- | :--- | :--- | :--- |
| **Login** | `api_auth.api_login` | `/api/login/` | `login(username, password)` | `LoginPage.tsx` |
| **Profile** | `api_auth.api_profile` | `/api/profile/` | `getProfile()` | `ProfilePage.tsx` |
| **Chat List** | `chat_api.get_chats_api` | `/api/chats/` | `getChats()` | `ChatPage.tsx` |
| **Active Scribe** | `social.post_scribe` | `/api/post-scribe/` | `createScribe(data)` | `CreateScribeModal.tsx` |
| **Like Post** | `social.toggle_like` | `/api/toggle-like/` | `toggleLike(id)` | `ScribeCard.tsx` |
| **Omzo Feed** | `social.get_omzo_batch` | `/api/omzo/batch/` | `getOmzoFeed(cursor)` | `OmzoFeed.tsx` |
| **Follow** | `social.toggle_follow` | `/api/toggle-follow/` | `toggleFollow(username)` | `ProfileHeader.tsx` |
| **Search** | `social.global_search` | `/api/global-search/` | `globalSearch(query)` | `SearchBar.tsx` |
| **Stories** | `stories.create_story` | `/api/create-story/` | `createStory(formData)` | `CreateStoryModal.tsx` |

### How the Connection Works:
1.  **Component Trigger**: A user clicks a button (e.g., "Like") in `ScribeCard.tsx`.
2.  **Service Call**: `ScribeCard` calls `api.toggleLike(postId)` from `services/api.ts`.
3.  **HTTP Request**: `axios` instance in `api.ts` sends a `POST /api/toggle-like/` request with the ID.
4.  **Django URL**: Django's `urls.py` matches the path `/api/toggle-like/` to the view `views.toggle_like`.
5.  **View Execution**: `social.py` -> `toggle_like` runs, updates the DB, and **Broadcasts WebSocket Event**.
6.  **Response**: Django returns `JSON { success: true }`.
7.  **UI Update**: Frontend updates the heart icon to red.
8.  **Real-time Update**: Simultaneously, the **WebSocket** delivers the "Notification" to the post owner.
