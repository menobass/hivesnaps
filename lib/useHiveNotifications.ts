import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { notificationService } from './notificationService';

export interface NotificationHookOptions {
  username?: string;
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void;
}

export function useHiveNotifications({
  username,
  onNotificationReceived,
  onNotificationTapped,
}: NotificationHookOptions) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!username) return;

    // Initialize the notification service
    const initializeNotifications = async () => {
      try {
        const success = await notificationService.initialize(username);
        if (success) {
          console.log('🔔 Notifications initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Listen for notifications while app is running
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification received:', notification);
        onNotificationReceived?.(notification);
      });

    // Listen for notification taps
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('🔔 Notification tapped:', response);

        // Handle navigation based on notification type
        handleNotificationTap(response, router);

        onNotificationTapped?.(response);
      });

    // Cleanup function
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [username, onNotificationReceived, onNotificationTapped, router]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      notificationService.destroy();
    };
  }, []);
}

// Handle notification tap navigation
function handleNotificationTap(
  response: Notifications.NotificationResponse,
  router: any
) {
  const { data } = response.notification.request.content;

  if (!data) return;

  try {
    switch (data.type) {
      case 'reply':
        if (data.author && data.permlink) {
          // Navigate to the conversation screen
          router.push({
            pathname: '/ConversationScreen',
            params: { author: data.author, permlink: data.permlink },
          });
        }
        break;

      case 'mention':
        if (data.author && data.permlink) {
          // Navigate to the post where user was mentioned
          router.push({
            pathname: '/ConversationScreen',
            params: { author: data.author, permlink: data.permlink },
          });
        }
        break;

      case 'upvote':
        if (data.author && data.permlink) {
          // Navigate to the upvoted post
          router.push({
            pathname: '/ConversationScreen',
            params: { author: data.author, permlink: data.permlink },
          });
        }
        break;

      case 'follow':
        if (data.author) {
          // Navigate to the follower's profile
          router.push({
            pathname: '/ProfileScreen',
            params: { username: data.author },
          });
        }
        break;

      default:
        console.log('Unknown notification type:', data.type);
    }
  } catch (error) {
    console.error('Error handling notification tap:', error);
  }
}

// Utility function to manually send a test notification (for development)
export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'This is a test notification from HiveSnaps!',
        data: {
          type: 'test',
          author: 'testuser',
          permlink: 'test-post',
        },
      },
      trigger: {
        seconds: 2,
      } as any, // Expo notification trigger type
    });
    console.log('🔔 Test notification scheduled');
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}

// Utility function to clear all notifications
export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🔔 All notifications cleared');
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}
