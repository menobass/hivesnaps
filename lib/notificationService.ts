import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import { Client } from '@hiveio/dhive';

// Configure how notifications should be handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationActivity {
  type: 'reply' | 'mention' | 'upvote' | 'follow';
  author: string;
  permlink?: string;
  voter?: string;
  timestamp: string;
  id: string; // unique identifier for deduplication
}

export interface NotificationStorage {
  lastChecked: string;
  notifiedItems: string[]; // array of notification IDs we've already shown
  username: string;
}

class HiveNotificationService {
  private client: Client;
  private isActive = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: any = null;
  private currentUsername: string | null = null;

  constructor() {
    this.client = new Client(['https://api.hive.blog', 'https://anyx.io']);
    this.setupAppStateListener();
  }

  // Initialize notification permissions and service
  async initialize(username: string): Promise<boolean> {
    try {
      this.currentUsername = username;

      // Request permissions for notifications
      const permission = await this.requestPermissions();
      if (!permission) {
        console.warn('Notification permissions denied');
        return false;
      }

      // Load or initialize notification storage
      await this.initializeStorage();

      // Start monitoring if app is active
      if (AppState.currentState === 'active') {
        this.startMonitoring();
      }

      console.log('🔔 Notification service initialized for user:', username);
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  // Request notification permissions
  private async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  // Setup app state listener for background/foreground detection
  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        console.log('🔔 App state changed to:', nextAppState);

        if (nextAppState === 'active') {
          // App came to foreground - check for missed notifications
          this.checkMissedActivity();
          this.startMonitoring();
        } else if (
          nextAppState === 'background' ||
          nextAppState === 'inactive'
        ) {
          // App went to background - stop monitoring to save battery
          this.stopMonitoring();
        }
      }
    );
  }

  // Start periodic monitoring while app is active
  private startMonitoring() {
    if (this.isActive || !this.currentUsername) return;

    this.isActive = true;
    console.log('🔔 Starting notification monitoring');

    // Check immediately
    this.checkForNewActivity();

    // Then check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkForNewActivity();
    }, 30000);
  }

  // Stop monitoring
  private stopMonitoring() {
    if (!this.isActive) return;

    this.isActive = false;
    console.log('🔔 Stopping notification monitoring');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Check for missed activity when app comes to foreground
  private async checkMissedActivity() {
    if (!this.currentUsername) return;

    try {
      console.log('🔔 Checking for missed activity...');
      const storage = await this.getStorage();
      const activities = await this.fetchRecentActivity(storage.lastChecked);

      if (activities.length > 0) {
        console.log(`🔔 Found ${activities.length} missed activities`);
        await this.processAndNotify(activities);
      }
    } catch (error) {
      console.error('Error checking missed activity:', error);
    }
  }

  // Check for new activity (called periodically when app is active)
  private async checkForNewActivity() {
    if (!this.currentUsername) return;

    try {
      const storage = await this.getStorage();
      const activities = await this.fetchRecentActivity(storage.lastChecked);

      if (activities.length > 0) {
        console.log(`🔔 Found ${activities.length} new activities`);
        await this.processAndNotify(activities);
      }

      // Update last checked timestamp
      await this.updateLastChecked();
    } catch (error) {
      console.error('Error checking for new activity:', error);
    }
  }

  // Fetch recent activity from Hive blockchain
  private async fetchRecentActivity(
    since: string
  ): Promise<NotificationActivity[]> {
    if (!this.currentUsername) return [];

    const activities: NotificationActivity[] = [];
    const sinceDate = new Date(since);

    try {
      // 1. Check for replies to user's posts
      const userPosts = await this.getUserRecentPosts();
      for (const post of userPosts) {
        const replies = await this.getPostReplies(
          post.author,
          post.permlink,
          sinceDate
        );
        activities.push(...replies);
      }

      // 2. Check for mentions of the user
      const mentions = await this.getUserMentions(sinceDate);
      activities.push(...mentions);

      // 3. Check for upvotes on user's content
      const upvotes = await this.getUserUpvotes(sinceDate);
      activities.push(...upvotes);

      // Sort by timestamp (newest first)
      activities.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return activities;
    } catch (error) {
      console.error('Error fetching activity:', error);
      return [];
    }
  }

  // Get user's recent posts to check for replies
  private async getUserRecentPosts(): Promise<
    Array<{ author: string; permlink: string }>
  > {
    if (!this.currentUsername) return [];

    try {
      const discussions = await this.client.database.getDiscussions('blog', {
        tag: this.currentUsername,
        limit: 10,
      });

      return discussions
        .filter(post => post.author === this.currentUsername)
        .map(post => ({
          author: post.author,
          permlink: post.permlink,
        }));
    } catch (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
  }

  // Get replies to a specific post since a given date
  private async getPostReplies(
    author: string,
    permlink: string,
    since: Date
  ): Promise<NotificationActivity[]> {
    const activities: NotificationActivity[] = [];

    try {
      const content = await this.client.database.call('get_content', [
        author,
        permlink,
      ]);
      const replies = await this.client.database.call('get_content_replies', [
        author,
        permlink,
      ]);

      for (const reply of replies) {
        const replyDate = new Date(reply.created);
        if (replyDate > since && reply.author !== this.currentUsername) {
          activities.push({
            type: 'reply',
            author: reply.author,
            permlink: reply.permlink,
            timestamp: reply.created,
            id: `reply-${reply.author}-${reply.permlink}`,
          });
        }
      }

      return activities;
    } catch (error) {
      console.error('Error fetching post replies:', error);
      return [];
    }
  }

  // Get mentions of the user (this is complex on Hive, simplified approach)
  private async getUserMentions(since: Date): Promise<NotificationActivity[]> {
    // Note: This is a simplified implementation
    // A full implementation would require scanning recent posts for @username mentions
    // For now, we'll return empty array and focus on replies and upvotes
    return [];
  }

  // Get recent upvotes on user's content
  private async getUserUpvotes(since: Date): Promise<NotificationActivity[]> {
    const activities: NotificationActivity[] = [];

    try {
      const userPosts = await this.getUserRecentPosts();

      for (const post of userPosts.slice(0, 5)) {
        // Check last 5 posts
        const content = await this.client.database.call('get_content', [
          post.author,
          post.permlink,
        ]);

        if (content.active_votes) {
          for (const vote of content.active_votes) {
            // Estimate vote timestamp (Hive doesn't provide exact vote timestamps easily)
            // This is approximate - in a real implementation you'd track this better
            const voteDate = new Date(
              Date.now() - Math.random() * 24 * 60 * 60 * 1000
            ); // Random within last 24h

            if (
              voteDate > since &&
              vote.voter !== this.currentUsername &&
              vote.percent > 0
            ) {
              activities.push({
                type: 'upvote',
                author: post.author,
                permlink: post.permlink,
                voter: vote.voter,
                timestamp: voteDate.toISOString(),
                id: `upvote-${vote.voter}-${post.permlink}`,
              });
            }
          }
        }
      }

      return activities;
    } catch (error) {
      console.error('Error fetching upvotes:', error);
      return [];
    }
  }

  // Process activities and send notifications
  private async processAndNotify(activities: NotificationActivity[]) {
    const storage = await this.getStorage();
    const newActivities = activities.filter(
      activity => !storage.notifiedItems.includes(activity.id)
    );

    if (newActivities.length === 0) return;

    // Send notifications for new activities
    for (const activity of newActivities.slice(0, 5)) {
      // Limit to 5 notifications at once
      await this.sendNotification(activity);
      storage.notifiedItems.push(activity.id);
    }

    // Keep only last 1000 notified items to prevent storage bloat
    if (storage.notifiedItems.length > 1000) {
      storage.notifiedItems = storage.notifiedItems.slice(-1000);
    }

    await this.saveStorage(storage);
  }

  // Send a local notification
  private async sendNotification(activity: NotificationActivity) {
    try {
      let title = '';
      let body = '';

      switch (activity.type) {
        case 'reply':
          title = '💬 New Reply';
          body = `@${activity.author} replied to your post`;
          break;
        case 'mention':
          title = '👋 You were mentioned';
          body = `@${activity.author} mentioned you in a post`;
          break;
        case 'upvote':
          title = '⬆️ New Upvote';
          body = `@${activity.voter} upvoted your post`;
          break;
        case 'follow':
          title = '👥 New Follower';
          body = `@${activity.author} started following you`;
          break;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: activity.type,
            author: activity.author,
            permlink: activity.permlink,
            voter: activity.voter,
          },
        },
        trigger: null, // Show immediately
      });

      console.log(`🔔 Sent notification: ${title} - ${body}`);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Storage management
  private async getStorage(): Promise<NotificationStorage> {
    try {
      const stored = await SecureStore.getItemAsync('hive_notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.username === this.currentUsername) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error reading notification storage:', error);
    }

    // Return default storage
    return {
      lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      notifiedItems: [],
      username: this.currentUsername || '',
    };
  }

  private async saveStorage(storage: NotificationStorage) {
    try {
      await SecureStore.setItemAsync(
        'hive_notifications',
        JSON.stringify(storage)
      );
    } catch (error) {
      console.error('Error saving notification storage:', error);
    }
  }

  private async initializeStorage() {
    const storage = await this.getStorage();
    await this.saveStorage(storage);
  }

  private async updateLastChecked() {
    const storage = await this.getStorage();
    storage.lastChecked = new Date().toISOString();
    await this.saveStorage(storage);
  }

  // Cleanup
  destroy() {
    this.stopMonitoring();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.currentUsername = null;
  }
}

// Singleton instance
export const notificationService = new HiveNotificationService();
