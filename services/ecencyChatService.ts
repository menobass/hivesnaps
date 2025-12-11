/**
 * Ecency Chat Service
 * Handles Ecency/Mattermost chat integration for HiveSnaps
 * 
 * Architecture:
 * - Uses Ecency's hosted Mattermost API (no self-hosting required)
 * - Authentication via Hivesigner-style signed tokens
 * - Session managed via mm_pat token stored in SecureStore
 * - Supports community chat (hive-178315/Snapie) and DMs
 */

import { PrivateKey, cryptoUtils } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { ECENCY_API_BASE_URL } from '../app/config/env';

// ============================================================================
// Types
// ============================================================================

export interface EcencyChatUser {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
}

export interface EcencyChatChannel {
  id: string;
  type: 'O' | 'D'; // O = Open (community), D = Direct
  display_name: string;
  name: string;
  header?: string;
  purpose?: string;
  last_post_at?: number;
  total_msg_count?: number;
  // DM-specific
  dm_partner?: EcencyChatUser;
  // State
  is_favorite?: boolean;
  is_muted?: boolean;
  unread_count?: number;
  mention_count?: number;
}

export interface EcencyChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  create_at: number;
  update_at: number;
  delete_at?: number;
  root_id?: string; // For threaded replies
  // Resolved username (from users map)
  username?: string;
  // Reactions
  metadata?: {
    reactions?: Record<string, string[]>; // emoji_name -> user_ids
  };
}

export interface EcencyChatReaction {
  emoji_name: string;
  user_id: string;
  post_id: string;
  create_at: number;
}

export interface BootstrapResponse {
  ok: boolean;
  userId?: string;
  channelId?: string; // Community channel ID if community was provided
  error?: string;
}

export interface ChannelsResponse {
  channels: EcencyChatChannel[];
}

export interface MessagesResponse {
  posts: EcencyChatMessage[];
  users: Record<string, EcencyChatUser>; // user_id -> user info
  order: string[]; // Ordered post IDs
}

export interface UnreadResponse {
  total_unread: number;
  channels: Record<string, { unread: number; mentions: number }>;
}

// ============================================================================
// Constants
// ============================================================================

const HIVESIGNER_APP_ID = 'ecency.app'; // Ecency's Hivesigner app ID
const SNAPIE_COMMUNITY = 'hive-178315';
const SNAPIE_COMMUNITY_TITLE = 'Snapie';
const MM_PAT_KEY = 'ecency_mm_pat';
const MM_USER_ID_KEY = 'ecency_mm_user_id';
const MM_CHANNEL_ID_KEY = 'ecency_mm_channel_id';

// Emoji mappings for Mattermost
const EMOJI_TO_NAME: Record<string, string> = {
  '👍': '+1',
  '👎': '-1',
  '❤️': 'heart',
  '😂': 'laughing',
  '😮': 'open_mouth',
  '😢': 'cry',
  '🔥': 'fire',
  '🎉': 'tada',
  '👀': 'eyes',
  '🙏': 'pray',
};

const NAME_TO_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_TO_NAME).map(([k, v]) => [v, k])
);

// ============================================================================
// Service Implementation
// ============================================================================

class EcencyChatServiceImpl {
  private readonly DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  private mmPat: string | null = null;
  private userId: string | null = null;
  private communityChannelId: string | null = null;

  // --------------------------------------------------------------------------
  // Token Generation
  // --------------------------------------------------------------------------

  /**
   * Build Hivesigner-style access token for Ecency authentication
   * This is the key to authenticating without Keychain - we sign directly with the posting key
   */
  buildAccessToken(username: string, postingWif: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const payload: any = {
      signed_message: { type: 'code', app: HIVESIGNER_APP_ID },
      authors: [username],
      timestamp,
    };

    const message = JSON.stringify(payload);
    const hash = cryptoUtils.sha256(message);
    
    // Sign with posting key
    const signature = PrivateKey.fromString(postingWif).sign(hash).toString();
    
    // Attach signature
    payload.signatures = [signature];
    
    // Base64url encode
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    if (this.DEBUG) {
      console.log('[EcencyChatService] Built access token for:', username);
    }
    
    return token;
  }

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  /**
   * Initialize chat session - must be called before other methods
   * Returns true if session is ready, false if authentication failed
   */
  async bootstrap(): Promise<BootstrapResponse> {
    try {
      // Get credentials from SecureStore
      const username = await SecureStore.getItemAsync('hive_username');
      const postingKey = await SecureStore.getItemAsync('hive_posting_key');
      
      if (!username || !postingKey) {
        return { ok: false, error: 'Not logged in - missing credentials' };
      }

      // Check if we have a cached session
      const cachedPat = await SecureStore.getItemAsync(MM_PAT_KEY);
      const cachedUserId = await SecureStore.getItemAsync(MM_USER_ID_KEY);
      const cachedChannelId = await SecureStore.getItemAsync(MM_CHANNEL_ID_KEY);
      
      if (cachedPat && cachedUserId) {
        this.mmPat = cachedPat;
        this.userId = cachedUserId;
        this.communityChannelId = cachedChannelId;
        
        // Verify session is still valid by fetching channels
        try {
          await this.getChannels();
          if (this.DEBUG) {
            console.log('[EcencyChatService] Using cached session');
          }
          return { ok: true, userId: cachedUserId, channelId: cachedChannelId || undefined };
        } catch {
          // Session expired, continue to bootstrap
          if (this.DEBUG) {
            console.log('[EcencyChatService] Cached session expired, re-bootstrapping');
          }
        }
      }

      // Build access token
      const accessToken = this.buildAccessToken(username, postingKey);
      
      // Call bootstrap endpoint
      const response = await fetch(`${ECENCY_API_BASE_URL}/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          accessToken,
          // refreshToken not needed when we provide accessToken
          displayName: username,
          community: SNAPIE_COMMUNITY,
          communityTitle: SNAPIE_COMMUNITY_TITLE,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EcencyChatService] Bootstrap failed:', response.status, errorText);
        return { ok: false, error: `Bootstrap failed: ${response.status}` };
      }

      const data = await response.json();
      
      if (!data.ok) {
        return { ok: false, error: data.error || 'Bootstrap returned not ok' };
      }

      // Extract mm_pat from Set-Cookie header or response
      // Note: In React Native, we need to handle this differently than browser
      // The cookie might be in the response headers or we need to extract from response
      const setCookie = response.headers.get('set-cookie');
      let mmPat: string | null = null;
      
      if (setCookie) {
        const match = setCookie.match(/mm_pat=([^;]+)/);
        if (match) {
          mmPat = match[1];
        }
      }
      
      // If not in cookie, check response body (Ecency might include it)
      if (!mmPat && data.mm_pat) {
        mmPat = data.mm_pat;
      }

      if (!mmPat) {
        // Some implementations return the token directly in response
        // Let's try making a request to see if session was established
        if (this.DEBUG) {
          console.log('[EcencyChatService] No mm_pat in cookie/response, trying direct access');
        }
      }

      // Store session data
      this.mmPat = mmPat;
      this.userId = data.userId;
      this.communityChannelId = data.channelId;

      // Persist to SecureStore
      if (mmPat) {
        await SecureStore.setItemAsync(MM_PAT_KEY, mmPat);
      }
      if (data.userId) {
        await SecureStore.setItemAsync(MM_USER_ID_KEY, data.userId);
      }
      if (data.channelId) {
        await SecureStore.setItemAsync(MM_CHANNEL_ID_KEY, data.channelId);
      }

      if (this.DEBUG) {
        console.log('[EcencyChatService] Bootstrap successful:', {
          userId: data.userId,
          channelId: data.channelId,
          hasMmPat: !!mmPat,
        });
      }

      return {
        ok: true,
        userId: data.userId,
        channelId: data.channelId,
      };
    } catch (error) {
      console.error('[EcencyChatService] Bootstrap error:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown bootstrap error',
      };
    }
  }

  /**
   * Clear chat session (on logout)
   */
  async clearSession(): Promise<void> {
    this.mmPat = null;
    this.userId = null;
    this.communityChannelId = null;
    
    await SecureStore.deleteItemAsync(MM_PAT_KEY);
    await SecureStore.deleteItemAsync(MM_USER_ID_KEY);
    await SecureStore.deleteItemAsync(MM_CHANNEL_ID_KEY);
    
    if (this.DEBUG) {
      console.log('[EcencyChatService] Session cleared');
    }
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return !!this.userId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Get Snapie community channel ID
   */
  getCommunityChannelId(): string | null {
    return this.communityChannelId;
  }

  // --------------------------------------------------------------------------
  // API Request Helper
  // --------------------------------------------------------------------------

  private async makeRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include mm_pat as cookie header if available
    if (this.mmPat) {
      headers['Cookie'] = `mm_pat=${this.mmPat}`;
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const url = `${ECENCY_API_BASE_URL}${path}`;
    
    if (this.DEBUG) {
      console.log(`[EcencyChatService] ${method} ${path}`);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Channels
  // --------------------------------------------------------------------------

  /**
   * Get all channels for the current user
   */
  async getChannels(): Promise<EcencyChatChannel[]> {
    const data = await this.makeRequest<{ channels: EcencyChatChannel[] }>('/channels');
    return data.channels || [];
  }

  /**
   * Get unread counts across all channels
   */
  async getUnreadCounts(): Promise<UnreadResponse> {
    return this.makeRequest<UnreadResponse>('/channels/unreads');
  }

  /**
   * Join a channel
   */
  async joinChannel(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/join`, 'POST');
  }

  /**
   * Leave a channel
   */
  async leaveChannel(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/leave`, 'POST');
  }

  /**
   * Mark channel as viewed (clears unread)
   */
  async markChannelViewed(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/view`, 'POST');
  }

  /**
   * Toggle channel favorite status
   */
  async setChannelFavorite(channelId: string, favorite: boolean): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/favorite`, 'POST', { favorite });
  }

  /**
   * Toggle channel mute status
   */
  async setChannelMuted(channelId: string, mute: boolean): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/mute`, 'POST', { mute });
  }

  // --------------------------------------------------------------------------
  // Messages
  // --------------------------------------------------------------------------

  /**
   * Get messages for a channel
   */
  async getMessages(channelId: string): Promise<MessagesResponse> {
    const data = await this.makeRequest<MessagesResponse>(`/channels/${channelId}/posts`);
    
    // Enrich messages with usernames from users map
    if (data.posts && data.users) {
      data.posts = data.posts.map(post => ({
        ...post,
        username: data.users[post.user_id]?.username || 'Unknown',
      }));
    }
    
    return data;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, message: string, rootId?: string): Promise<EcencyChatMessage> {
    const body: any = { message };
    if (rootId) {
      body.rootId = rootId;
    }
    
    return this.makeRequest<EcencyChatMessage>(`/channels/${channelId}/posts`, 'POST', body);
  }

  /**
   * Edit a message
   */
  async editMessage(channelId: string, postId: string, message: string): Promise<EcencyChatMessage> {
    return this.makeRequest<EcencyChatMessage>(
      `/channels/${channelId}/posts/${postId}`,
      'PATCH',
      { message }
    );
  }

  /**
   * Delete a message
   */
  async deleteMessage(channelId: string, postId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/posts/${postId}`, 'DELETE');
  }

  // --------------------------------------------------------------------------
  // Reactions
  // --------------------------------------------------------------------------

  /**
   * Add or remove a reaction
   * @param emoji The emoji character (e.g., '👍')
   * @param add True to add, false to remove
   */
  async toggleReaction(channelId: string, postId: string, emoji: string, add: boolean): Promise<void> {
    const emojiName = EMOJI_TO_NAME[emoji] || emoji;
    await this.makeRequest(
      `/channels/${channelId}/posts/${postId}/reactions`,
      'POST',
      { emoji: emojiName, add }
    );
  }

  /**
   * Convert Mattermost emoji name to emoji character
   */
  emojiNameToChar(name: string): string {
    return NAME_TO_EMOJI[name] || name;
  }

  /**
   * Convert emoji character to Mattermost name
   */
  emojiCharToName(char: string): string {
    return EMOJI_TO_NAME[char] || char;
  }

  // --------------------------------------------------------------------------
  // Direct Messages
  // --------------------------------------------------------------------------

  /**
   * Create or get a DM channel with a user
   */
  async createDirectChannel(username: string): Promise<EcencyChatChannel> {
    return this.makeRequest<EcencyChatChannel>('/direct', 'POST', { username });
  }

  /**
   * Search for users (for starting DMs)
   */
  async searchUsers(query: string): Promise<EcencyChatUser[]> {
    const data = await this.makeRequest<{ users: EcencyChatUser[] }>(
      `/users/search?q=${encodeURIComponent(query)}`
    );
    return data.users || [];
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  /**
   * Search messages
   */
  async searchMessages(term: string): Promise<EcencyChatMessage[]> {
    const data = await this.makeRequest<{ posts: EcencyChatMessage[] }>(
      '/search/posts',
      'POST',
      { term }
    );
    return data.posts || [];
  }

  /**
   * Search channels
   */
  async searchChannels(term: string): Promise<EcencyChatChannel[]> {
    const data = await this.makeRequest<{ channels: EcencyChatChannel[] }>(
      '/channels/search',
      'POST',
      { term }
    );
    return data.channels || [];
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  // NOTE: For avatar URLs, use AvatarService.imagesAvatarUrl(username) instead
  // This avoids code duplication and leverages the existing caching system

  /**
   * Format message timestamp for display
   */
  formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }
    
    // Same year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    
    // Different year
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Export singleton instance
export const ecencyChatService = new EcencyChatServiceImpl();
