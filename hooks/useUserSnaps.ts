import { useState } from 'react';
import { Client } from '@hiveio/dhive';

// User snap interface for profile bubbles
export interface UserSnap {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  net_votes?: number;
  children?: number;
  pending_payout_value?: string;
  total_payout_value?: string;
  active_votes?: any[];
  [key: string]: any;
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useUserSnaps = (username: string | undefined) => {
  const [userSnaps, setUserSnaps] = useState<UserSnap[]>([]);
  const [snapsLoading, setSnapsLoading] = useState(false);
  const [snapsError, setSnapsError] = useState<string | null>(null);
  const [snapsLoaded, setSnapsLoaded] = useState(false);
  const [displayedSnapsCount, setDisplayedSnapsCount] = useState(10); // Show 10 initially
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  // Fetch user's recent snaps from Hive blockchain
  const fetchUserSnaps = async () => {
    if (!username) return;
    
    setSnapsLoading(true);
    setSnapsError(null);
    
    try {
      console.log('Fetching recent snaps for user:', username);
      
      // Get latest posts by @peak.snaps (container account) - increased limit for more snaps
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 20 // Increased to get more potential snaps
      }]);
      
      let userSnapsFound: UserSnap[] = [];
      
      // Search through all container posts for user's snaps
      for (const post of discussions) {
        try {
          const replies: UserSnap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
          
          // Filter replies to only those by the profile user
          const userReplies = replies.filter((reply) => reply.author === username);
          userSnapsFound = userSnapsFound.concat(userReplies);
        } catch (replyError) {
          console.log('Error fetching replies for post:', post.permlink, replyError);
        }
      }
      
      // Sort by created date descending (newest first)
      userSnapsFound.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      // Keep more snaps for load more functionality
      const limitedSnaps = userSnapsFound.slice(0, 50);
      
      setUserSnaps(limitedSnaps);
      setSnapsLoaded(true);
      setDisplayedSnapsCount(10); // Reset to initial display count
      console.log(`Found ${limitedSnaps.length} recent snaps for @${username}`);
      
    } catch (error) {
      console.error('Error fetching user snaps:', error);
      setSnapsError('Failed to load recent snaps');
    } finally {
      setSnapsLoading(false);
    }
  };

  // Load more snaps function
  const loadMoreSnaps = async () => {
    setLoadMoreLoading(true);
    
    // Simulate loading time for better UX
    setTimeout(() => {
      const currentCount = displayedSnapsCount;
      const newCount = Math.min(currentCount + 10, userSnaps.length);
      setDisplayedSnapsCount(newCount);
      setLoadMoreLoading(false);
    }, 500);
  };

  // Extract text content from snap body (removing images and formatting)
  const extractSnapText = (body: string): string => {
    // Remove images
    let text = body.replace(/!\[.*?\]\(.*?\)/g, '');
    // Remove markdown links but keep the text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // If no text remains, return a fallback
    if (!text) {
      return 'Snap contains media or links';
    }
    
    // Limit length
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  // Check if current user has upvoted a snap
  const hasUserUpvoted = (snap: UserSnap, currentUsername: string | null): boolean => {
    if (!currentUsername || !snap.active_votes) return false;
    return snap.active_votes.some((vote: any) => vote.voter === currentUsername && vote.percent > 0);
  };

  // Helper function to convert UserSnap to format expected by Snap component
  const convertUserSnapToSnapProps = (userSnap: UserSnap, currentUsername: string | null) => {
    // Calculate payout from pending_payout_value and total_payout_value
    const pendingPayout = parseFloat((userSnap.pending_payout_value || '0.000 HBD').replace(' HBD', ''));
    const totalPayout = parseFloat((userSnap.total_payout_value || '0.000 HBD').replace(' HBD', ''));
    const payout = pendingPayout + totalPayout;

    return {
      author: userSnap.author,
      avatarUrl: '', // Will be populated by Snap component's own avatar fetching
      body: userSnap.body,
      created: userSnap.created,
      voteCount: userSnap.net_votes || 0,
      replyCount: userSnap.children || 0,
      payout: payout,
      permlink: userSnap.permlink,
      hasUpvoted: hasUserUpvoted(userSnap, currentUsername),
    };
  };

  // Update a specific snap optimistically (for upvotes, etc.)
  const updateSnap = (author: string, permlink: string, updates: any) => {
    setUserSnaps(prevSnaps => 
      prevSnaps.map(snap => 
        snap.author === author && snap.permlink === permlink
          ? { ...snap, ...updates }
          : snap
      )
    );
  };

  return {
    userSnaps,
    snapsLoading,
    snapsError,
    snapsLoaded,
    displayedSnapsCount,
    loadMoreLoading,
    fetchUserSnaps,
    loadMoreSnaps,
    extractSnapText,
    hasUserUpvoted,
    convertUserSnapToSnapProps,
    updateSnap,
  };
}; 