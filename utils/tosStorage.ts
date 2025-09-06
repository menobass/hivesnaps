import AsyncStorage from '@react-native-async-storage/async-storage';

const TOS_ACCEPTANCE_KEY = '@hivesnaps_tos_accepted';
const TOS_VERSION = '1.0'; // Update this when TOS changes to re-prompt users

export const tosStorage = {
  /**
   * Check if user has accepted the current version of Terms of Service
   */
  async hasAcceptedTOS(): Promise<boolean> {
    try {
      const acceptedVersion = await AsyncStorage.getItem(TOS_ACCEPTANCE_KEY);
      return acceptedVersion === TOS_VERSION;
    } catch (error) {
      console.error('Error checking TOS acceptance:', error);
      return false;
    }
  },

  /**
   * Mark current TOS version as accepted
   */
  async acceptTOS(): Promise<void> {
    try {
      await AsyncStorage.setItem(TOS_ACCEPTANCE_KEY, TOS_VERSION);
      console.log('TOS acceptance saved successfully');
    } catch (error) {
      console.error('Error saving TOS acceptance:', error);
      throw error;
    }
  },

  /**
   * Clear TOS acceptance (for testing/debugging)
   */
  async clearTOSAcceptance(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOS_ACCEPTANCE_KEY);
      console.log('TOS acceptance cleared');
    } catch (error) {
      console.error('Error clearing TOS acceptance:', error);
      throw error;
    }
  },

  /**
   * Get current TOS version
   */
  getCurrentTOSVersion(): string {
    return TOS_VERSION;
  }
};
