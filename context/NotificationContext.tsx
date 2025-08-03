import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  useHiveNotifications,
  sendTestNotification,
  clearAllNotifications,
} from '../lib/useHiveNotifications';

interface NotificationContextType {
  isEnabled: boolean;
  currentUsername: string | null;
  // Test functions for development
  sendTestNotification: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Load current user on mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const username = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(username);
        setIsEnabled(!!username);
      } catch (error) {
        console.error('Error loading current user for notifications:', error);
      }
    };

    loadCurrentUser();
  }, []);

  // Initialize notifications for the current user
  useHiveNotifications({
    username: currentUsername || undefined,
    onNotificationReceived: notification => {
      console.log(
        '🔔 App received notification:',
        notification.request.content.title
      );
    },
    onNotificationTapped: response => {
      console.log(
        '🔔 User tapped notification:',
        response.notification.request.content.title
      );
    },
  });

  const contextValue: NotificationContextType = {
    isEnabled,
    currentUsername,
    sendTestNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}
