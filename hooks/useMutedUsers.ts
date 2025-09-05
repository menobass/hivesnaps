import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Storage key for local muted users cache
const MUTED_USERS_STORAGE_KEY = 'muted_users_list';

export const useMutedUsers = (currentUsername: string | null) => {
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch muted users from Hive blockchain
  const fetchMutedUsersFromBlockchain = useCallback(async (): Promise<string[]> => {
    if (!currentUsername) {
      return [];
    }

    try {
      console.log(`🔇 Fetching muted users for: ${currentUsername}`);
      
      // Get all users that currentUsername ignores
      const ignoring = await client.call('condenser_api', 'get_following', [
        currentUsername,
        '',
        'ignore',
        1000, // Max limit to get all muted users
      ]);

      const mutedUsersList = Array.isArray(ignoring) 
        ? ignoring
            .filter((f: any) => f.what?.includes('ignore'))
            .map((f: any) => f.following)
        : [];

      console.log(`🔇 Found ${mutedUsersList.length} muted users:`, mutedUsersList);
      return mutedUsersList;
    } catch (error) {
      console.error('Error fetching muted users from blockchain:', error);
      throw error;
    }
  }, [currentUsername]);

  // Load muted users from AsyncStorage
  const loadMutedUsersFromStorage = useCallback(async (): Promise<string[]> => {
    try {
      const stored = await AsyncStorage.getItem(MUTED_USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log(`💾 Loaded ${parsed.length} muted users from storage`);
        return parsed;
      }
      return [];
    } catch (error) {
      console.error('Error loading muted users from storage:', error);
      return [];
    }
  }, []);

  // Save muted users to AsyncStorage
  const saveMutedUsersToStorage = useCallback(async (usersList: string[]) => {
    try {
      await AsyncStorage.setItem(MUTED_USERS_STORAGE_KEY, JSON.stringify(usersList));
      console.log(`💾 Saved ${usersList.length} muted users to storage`);
    } catch (error) {
      console.error('Error saving muted users to storage:', error);
    }
  }, []);

  // Sync muted users from blockchain and update local storage
  const syncMutedUsers = useCallback(async () => {
    if (!currentUsername) {
      setMutedUsers(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch fresh data from blockchain
      const blockchainMutedUsers = await fetchMutedUsersFromBlockchain();
      
      // Update local state
      setMutedUsers(new Set(blockchainMutedUsers));
      
      // Save to AsyncStorage for next app launch
      await saveMutedUsersToStorage(blockchainMutedUsers);
      
      console.log(`✅ Successfully synced ${blockchainMutedUsers.length} muted users`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync muted users';
      setError(errorMessage);
      console.error('Error syncing muted users:', err);
      
      // Fallback to cached data on error
      const cachedUsers = await loadMutedUsersFromStorage();
      setMutedUsers(new Set(cachedUsers));
      console.log(`⚠️ Using cached muted users (${cachedUsers.length}) due to sync error`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUsername, fetchMutedUsersFromBlockchain, saveMutedUsersToStorage, loadMutedUsersFromStorage]);

  // Add user to muted list (for real-time updates)
  const addMutedUser = useCallback(async (username: string) => {
    console.log(`➕ Adding ${username} to muted users list`);
    
    const newMutedUsers = new Set(mutedUsers);
    newMutedUsers.add(username);
    setMutedUsers(newMutedUsers);
    
    // Save to storage
    await saveMutedUsersToStorage(Array.from(newMutedUsers));
  }, [mutedUsers, saveMutedUsersToStorage]);

  // Remove user from muted list (for real-time updates)
  const removeMutedUser = useCallback(async (username: string) => {
    console.log(`➖ Removing ${username} from muted users list`);
    
    const newMutedUsers = new Set(mutedUsers);
    newMutedUsers.delete(username);
    setMutedUsers(newMutedUsers);
    
    // Save to storage
    await saveMutedUsersToStorage(Array.from(newMutedUsers));
  }, [mutedUsers, saveMutedUsersToStorage]);

  // Check if a user is muted
  const isUserMuted = useCallback((username: string): boolean => {
    return mutedUsers.has(username);
  }, [mutedUsers]);

  // Load muted users on hook initialization
  useEffect(() => {
    const initializeMutedUsers = async () => {
      if (!currentUsername) {
        setIsLoading(false);
        return;
      }

      // Start with cached data for immediate UI updates
      const cachedUsers = await loadMutedUsersFromStorage();
      if (cachedUsers.length > 0) {
        setMutedUsers(new Set(cachedUsers));
        console.log(`🚀 Initialized with ${cachedUsers.length} cached muted users`);
      }

      // Then sync with blockchain for fresh data
      await syncMutedUsers();
    };

    initializeMutedUsers();
  }, [currentUsername, syncMutedUsers, loadMutedUsersFromStorage]);

  return {
    mutedUsers: Array.from(mutedUsers), // Return as array for easier iteration
    mutedUsersSet: mutedUsers, // Return Set for O(1) lookup performance
    isLoading,
    error,
    isUserMuted,
    addMutedUser,
    removeMutedUser,
    syncMutedUsers,
  };
};
