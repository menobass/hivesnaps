import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export const useUserAuth = () => {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  // Load current user credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, []);

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');
      setCurrentUsername(null);
    } catch (err) {
      throw new Error(
        'Logout failed: ' +
          (err instanceof Error ? err.message : JSON.stringify(err))
      );
    }
  };

  return {
    currentUsername,
    setCurrentUsername,
    handleLogout,
  };
};
