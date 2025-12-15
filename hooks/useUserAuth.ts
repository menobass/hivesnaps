import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '../store/context';

/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use `useAuth()` from '../store/context' for logout functionality
 * Use `useCurrentUser()` from '../store/context' to get the current username
 * 
 * Migration example:
 * ```ts
 * // Old:
 * const { currentUsername, handleLogout } = useUserAuth();
 * 
 * // New:
 * import { useAuth, useCurrentUser } from '../store/context';
 * const { handleLogout } = useAuth(); // if you need logout
 * const currentUsername = useCurrentUser(); // if you only need username
 * ```
 */
export const useUserAuth = () => {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const { setCurrentUser } = useAppStore();

  // Load current user credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);
        setCurrentUser(storedUsername); // Sync with context
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, [setCurrentUser]);

  // Keep context in sync if username changes (manual set)
  useEffect(() => {
    setCurrentUser(currentUsername);
  }, [currentUsername, setCurrentUser]);

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');
      setCurrentUsername(null);
      setCurrentUser(null); // Sync with context
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
