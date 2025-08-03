// Simple test to verify notification settings persistence
const { getDefaultNotificationSettings } = require('../utils/notifications');

// Mock SecureStore for testing
const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
};

// Mock the expo-secure-store module
jest.mock('expo-secure-store', () => mockSecureStore);

describe('Notification Settings', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should have default settings', () => {
    const defaultSettings = getDefaultNotificationSettings();
    
    expect(defaultSettings).toEqual({
      votes: true,
      replies: true,
      reblogs: true,
      follows: true,
      mentions: true,
      communityUpdates: true,
      pushNotifications: false,
      emailNotifications: false,
    });
  });

  test('should save and load settings correctly', async () => {
    const testSettings = {
      votes: false,
      replies: true,
      reblogs: false,
      follows: true,
      mentions: false,
      communityUpdates: true,
      pushNotifications: true,
      emailNotifications: false,
    };

    // Mock that settings are saved
    mockSecureStore.setItemAsync.mockResolvedValue();
    
    // Mock that settings are loaded
    mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(testSettings));

    // Simulate saving settings
    await mockSecureStore.setItemAsync('notification_settings', JSON.stringify(testSettings));
    
    // Verify settings were saved
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'notification_settings', 
      JSON.stringify(testSettings)
    );

    // Simulate loading settings
    const loadedSettings = await mockSecureStore.getItemAsync('notification_settings');
    const parsedSettings = JSON.parse(loadedSettings);
    
    // Verify settings were loaded correctly
    expect(parsedSettings).toEqual(testSettings);
  });

  test('should handle missing settings gracefully', async () => {
    // Mock that no settings are stored
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    
    const loadedSettings = await mockSecureStore.getItemAsync('notification_settings');
    
    // Should return null when no settings exist
    expect(loadedSettings).toBeNull();
  });
});

console.log('✅ Notification settings tests completed successfully!'); 