# Ecency Chat Implementation Guide

> **Internal Document** - Implementation details for porting to HiveSnaps Mobile (React Native)

## Overview

This document explains how we integrated Ecency's chat system (based on Mattermost) into Snapie. The chat allows users to communicate in a community channel and via direct messages (DMs).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                               │
│  ┌────────────────┐    ┌────────────────┐    ┌─────────────────┐   │
│  │  ChatPanel.tsx │───▶│  /api/chat/*   │───▶│  Ecency Chat API │   │
│  │   (UI Layer)   │    │  (Next.js API) │    │  (Mattermost)    │   │
│  └────────────────┘    └────────────────┘    └─────────────────┘   │
│          │                                                           │
│          ▼                                                           │
│  ┌────────────────┐                                                 │
│  │ Hive Keychain  │ ◀── Signs authentication challenge              │
│  └────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Authentication Layer** (`lib/hive/ecency-auth.ts`)
   - Generates Hivesigner-style tokens signed with Hive posting key
   - Uses Hive Keychain for client-side signing

2. **API Proxy Layer** (`app/api/chat/...`)
   - Proxies requests to Ecency's Mattermost API
   - Handles cookie-based session management

3. **UI Layer** (`components/chat/ChatPanel.tsx`)
   - Tabbed interface: Community chat + DMs
   - Message display with reactions
   - Minimize to floating bubble feature

---

## Authentication Flow

### Step 1: Generate Access Token

The user must sign a challenge using their Hive posting key. We use Hive Keychain for this.

```typescript
// lib/hive/ecency-auth.ts

export async function buildEcencyAccessToken(
  username: string,
  hsClientId: string = "snapie", // Your app identifier
  postingKey?: string // Optional: for server-side signing
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Hivesigner-style payload
  const payload = {
    signed_message: { type: "code", app: hsClientId },
    authors: [username],
    timestamp,
  };

  const message = JSON.stringify(payload);
  const hash = cryptoUtils.sha256(message); // From @hiveio/dhive

  let signature: string;

  if (postingKey) {
    // Server-side: sign with provided posting key
    signature = PrivateKey.fromString(postingKey).sign(hash).toString();
  } else {
    // Client-side: use Keychain
    const keychain = new KeychainSDK(window);
    const response = await keychain.signBuffer({
      username,
      message: hash.toString("hex"),
      method: KeychainKeyTypes.posting,
      title: "Chat Authentication",
    });
    signature = response.result;
  }

  // Attach signature and encode as base64url
  const signedPayload = { ...payload, signatures: [signature] };
  const base64 = btoa(JSON.stringify(signedPayload));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

### Step 2: Bootstrap Chat Session

Call the bootstrap endpoint with the signed token to get a session cookie (`mm_pat`).

```typescript
// POST /api/chat/bootstrap
const response = await fetch("/api/chat/bootstrap", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // IMPORTANT: allows cookies
  body: JSON.stringify({
    username: "meno",
    accessToken: "<token from step 1>",
  }),
});
```

**API Route Implementation:**

```typescript
// app/api/chat/bootstrap/route.ts
export async function POST(request: NextRequest) {
  const { username, accessToken } = await request.json();

  const response = await fetch("https://ecency.com/api/mattermost/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username,
      accessToken,
      refreshToken: accessToken, // Same token works for refresh
      displayName: username,
      community: "hive-178315", // Your community tag
      communityTitle: "Snapie",
    }),
  });

  const data = await response.json();
  
  // Forward the mm_pat cookie from Ecency to client
  const setCookieHeader = response.headers.get("set-cookie");
  const headers = new Headers();
  if (setCookieHeader) {
    headers.set("set-cookie", setCookieHeader);
  }

  return NextResponse.json(data, { headers });
}
```

### Step 3: Check Session Status

```typescript
// Check if mm_pat cookie exists (client-side only)
export function hasEcencyChatSession(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("mm_pat=");
}
```

---

## API Endpoints

All API routes proxy to `https://ecency.com/api/mattermost/...`

### Base URL
```
const ECENCY_CHAT_BASE = "https://ecency.com/api/mattermost";
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/bootstrap` | POST | Initialize chat session |
| `/api/chat/channels` | GET | Get user's channels (community + DMs) |
| `/api/chat/channels/[channelId]/posts` | GET | Get messages in a channel |
| `/api/chat/channels/[channelId]/posts` | POST | Send a message |
| `/api/chat/channels/[channelId]/posts/[postId]/reactions` | POST | Add/remove emoji reaction |
| `/api/chat/direct` | POST | Create/get DM channel with user |
| `/api/chat/unread` | GET | Get unread message count |

---

## API Route Implementations

### GET /api/chat/channels

```typescript
export async function GET(request: NextRequest) {
  const mmPatCookie = request.cookies.get("mm_pat");
  
  if (!mmPatCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${ECENCY_CHAT_BASE}/channels`, {
    method: "GET",
    headers: {
      Cookie: `mm_pat=${mmPatCookie.value}`,
    },
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

**Response Structure:**
```json
{
  "channels": [
    {
      "id": "channel-uuid",
      "name": "hive-178315",
      "display_name": "Snapie",
      "type": "O",  // O = Open/Community, D = Direct
      "last_post_at": 1702345678000
    }
  ],
  "users": {
    "user-uuid-1": { "username": "meno" },
    "user-uuid-2": { "username": "alice" }
  }
}
```

### GET /api/chat/channels/[channelId]/posts

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  const mmPatCookie = request.cookies.get("mm_pat");
  
  const response = await fetch(
    `${ECENCY_CHAT_BASE}/channels/${params.channelId}/posts`,
    {
      headers: { Cookie: `mm_pat=${mmPatCookie.value}` },
    }
  );

  return NextResponse.json(await response.json());
}
```

**Response Structure:**
```json
{
  "posts": [
    {
      "id": "post-uuid",
      "message": "Hello world!",
      "user_id": "user-uuid",
      "create_at": 1702345678000,
      "metadata": {
        "reactions": [
          { "emoji_name": "+1", "user_id": "user-uuid-2" }
        ]
      }
    }
  ],
  "users": {
    "user-uuid": { "username": "meno" }
  }
}
```

### POST /api/chat/channels/[channelId]/posts

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  const mmPatCookie = request.cookies.get("mm_pat");
  const body = await request.json();

  const response = await fetch(
    `${ECENCY_CHAT_BASE}/channels/${params.channelId}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mm_pat=${mmPatCookie.value}`,
      },
      body: JSON.stringify(body),
    }
  );

  return NextResponse.json(await response.json());
}
```

**Request Body:**
```json
{
  "message": "Hello world!",
  "channel_id": "channel-uuid"
}
```

### POST /api/chat/channels/[channelId]/posts/[postId]/reactions

```typescript
// Emoji to Mattermost name mapping
const EMOJI_TO_NAME: { [key: string]: string } = {
  "👍": "+1",
  "👎": "-1",
  "❤️": "heart",
  "😂": "joy",
  "😮": "open_mouth",
  "😢": "cry",
  "🔥": "fire",
  "🎉": "tada",
  "👀": "eyes",
};

export async function POST(request: NextRequest, { params }) {
  const { emoji, add } = await request.json();
  const emojiName = EMOJI_TO_NAME[emoji] || emoji;
  
  const method = add ? "POST" : "DELETE";
  
  const response = await fetch(
    `${ECENCY_CHAT_BASE}/channels/${params.channelId}/posts/${params.postId}/reactions`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `mm_pat=${mmPatCookie.value}`,
      },
      body: JSON.stringify({ emoji: emojiName }),
    }
  );

  return NextResponse.json({ success: true });
}
```

### POST /api/chat/direct

Creates or retrieves a DM channel with another user.

```typescript
export async function POST(request: NextRequest) {
  const { username } = await request.json();
  
  const response = await fetch(`${ECENCY_CHAT_BASE}/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `mm_pat=${mmPatCookie.value}`,
    },
    body: JSON.stringify({ username }),
  });

  return NextResponse.json(await response.json());
}
```

**Response:**
```json
{
  "id": "dm-channel-uuid",
  "name": "uuid1__uuid2",
  "type": "D"
}
```

---

## Important Considerations

### 1. Cookie Management

The `mm_pat` cookie is the session token. It must be:
- Set with `credentials: "include"` on all requests
- Forwarded from Ecency's response in the bootstrap endpoint
- Sent to Ecency in all subsequent API calls

**For React Native:** You'll need to handle cookies manually or use a cookie-aware HTTP client.

### 2. Dynamic Route Export

All API routes that use cookies need this export to prevent Next.js from statically rendering them:

```typescript
export const dynamic = 'force-dynamic';
```

### 3. Channel Types

- **Type "O"** = Open/Community channel
- **Type "D"** = Direct message channel

DM channel names are formatted as `uuid1__uuid2` (two user UUIDs separated by `__`).

### 4. User Resolution

Messages contain `user_id` (UUID), not username. The API returns a `users` object mapping UUIDs to usernames:

```typescript
const username = data.users?.[message.user_id]?.username || "Unknown";
```

### 5. Reaction Emoji Mapping

Mattermost uses text names for emojis. You need to convert:

```typescript
// Display: name → emoji
const NAME_TO_EMOJI = { "+1": "👍", "heart": "❤️", ... };

// Send: emoji → name
const EMOJI_TO_NAME = { "👍": "+1", "❤️": "heart", ... };
```

### 6. Message Polling

For real-time updates, poll the messages endpoint. **Warning:** Be careful with polling intervals to avoid performance issues. Consider:
- WebSocket connection (if Ecency supports it)
- Long polling
- Or simple manual refresh

### 7. Community Configuration

Set your community in the bootstrap call:
```typescript
community: "hive-178315", // Your Hive community tag
communityTitle: "Snapie",
```

---

## UI Features Implemented

### 1. Tabbed Interface
- Tab 0: Community chat
- Tab 1: Direct Messages list

### 2. Minimize to Bubble
- Chat can be minimized to a draggable floating bubble
- Shows unread count badge
- Constrained to stay above mobile footer

### 3. Message Reactions
- Click to add/remove reactions
- Shows reaction counts
- Popover picker for new reactions

### 4. DM Features
- Start DM by clicking on a username
- DM list sorted by most recent
- Shows other user's avatar

---

## Mobile (React Native) Adaptation Notes

### 1. Remove Next.js API Layer
Call Ecency directly from the app:
```typescript
// Instead of: fetch("/api/chat/bootstrap", ...)
// Use: fetch("https://ecency.com/api/mattermost/bootstrap", ...)
```

### 2. Cookie Handling
Use a library like `react-native-cookies` or `@react-native-cookies/cookies`:
```typescript
import CookieManager from '@react-native-cookies/cookies';

// After bootstrap, store the cookie
const cookies = await CookieManager.get('https://ecency.com');
const mmPat = cookies.mm_pat?.value;

// Include in subsequent requests
fetch(url, {
  headers: {
    Cookie: `mm_pat=${mmPat}`,
  },
});
```

### 3. Hive Keychain Alternative
For mobile, use Hive Keychain mobile app or alternative signing methods:
- HiveAuth
- Direct private key signing (less secure)
- WalletConnect-style QR flow

### 4. Avatar URLs
```typescript
const avatarUrl = `https://images.ecency.com/webp/u/${username}/avatar/small`;
// or
const avatarUrl = `https://images.hive.blog/u/${username}/avatar`;
```

---

## Quick Start Checklist

1. ✅ User logs in with Hive Keychain
2. ✅ Generate access token using `buildEcencyAccessToken()`
3. ✅ Call bootstrap endpoint to get `mm_pat` cookie
4. ✅ Load channels to find community channel
5. ✅ Load messages for selected channel
6. ✅ Poll for new messages periodically
7. ✅ Send messages via POST to channel posts endpoint
8. ✅ Handle reactions via reactions endpoint
9. ✅ Start DMs via direct endpoint

---

## Troubleshooting

### "Not authenticated" errors
- Check if `mm_pat` cookie is present
- Cookie may have expired - re-bootstrap

### "Channel not found"
- Ensure bootstrap included correct community tag
- User may not have joined the community

### Messages not showing usernames
- Check if `users` object is in API response
- Map `user_id` to username from users object

### Reactions not working
- Ensure emoji is converted to Mattermost name
- Check if user already has that reaction (toggle behavior)

---

## Files Reference

```
lib/hive/ecency-auth.ts          # Token generation & auth helpers
app/api/chat/bootstrap/route.ts   # Initialize chat session
app/api/chat/channels/route.ts    # Get channels list
app/api/chat/channels/[channelId]/posts/route.ts  # Messages CRUD
app/api/chat/channels/[channelId]/posts/[postId]/reactions/route.ts  # Reactions
app/api/chat/direct/route.ts      # DM channel creation
app/api/chat/unread/route.ts      # Unread count
components/chat/ChatPanel.tsx     # Main UI component
```

---

*Last updated: December 11, 2025*
