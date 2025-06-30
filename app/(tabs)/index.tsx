import { StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, TextInput, Image, TouchableOpacity, useColorScheme, Dimensions, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Client, PrivateKey } from '@hiveio/dhive';

const twitterColors = {
  light: {
    background: '#FFFFFF',
    text: '#0F1419',
    inputBg: '#F7F9F9',
    inputBorder: '#CFD9DE',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    info: '#536471',
    footer: '#AAB8C2',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    inputBg: '#22303C',
    inputBorder: '#38444D',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    info: '#8899A6',
    footer: '#38444D',
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_WIDTH = SCREEN_WIDTH * 0.8;

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLoading, setAutoLoading] = useState(true); // New state for auto-login loading
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];
  const router = useRouter();

  // Auto-login functionality
  useEffect(() => {
    const checkStoredCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        const storedPostingKey = await SecureStore.getItemAsync('hive_posting_key');
        
        if (storedUsername && storedPostingKey) {
          // Validate stored credentials before auto-login
          const privKey = PrivateKey.from(storedPostingKey);
          const account = await client.database.getAccounts([storedUsername]);
          
          if (account && account[0]) {
            const pubPosting = privKey.createPublic().toString();
            const postingAuths = account[0].posting.key_auths.map(([key]) => key);
            
            if (postingAuths.includes(pubPosting)) {
              // Valid credentials found, auto-navigate to feed
              router.push('/FeedScreen');
              return;
            }
          }
        }
      } catch (error) {
        // If auto-login fails, clear stored credentials and show login screen
        await SecureStore.deleteItemAsync('hive_username');
        await SecureStore.deleteItemAsync('hive_posting_key');
      } finally {
        setAutoLoading(false);
      }
    };

    checkStoredCredentials();
  }, [router]);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Validate posting key
      const postingWif = postingKey.trim();
      const privKey = PrivateKey.from(postingWif);
      const account = await client.database.getAccounts([username.trim()]);
      if (!account || !account[0]) throw new Error('Account not found');
      const pubPosting = privKey.createPublic().toString();
      const postingAuths = account[0].posting.key_auths.map(([key]) => key);
      if (!postingAuths.includes(pubPosting)) throw new Error('Invalid posting key');
      // Store key securely
      await SecureStore.setItemAsync('hive_username', username.trim());
      await SecureStore.setItemAsync('hive_posting_key', postingWif);
      setLoading(false);
      router.push('/FeedScreen');
    } catch (e) {
      setLoading(false);
      setError('Invalid username or posting key. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      {autoLoading ? (
        // Show loading screen during auto-login check
        <View style={[styles.flexContainer, styles.loadingContainer]}>
          <Image source={require('../../assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <ActivityIndicator size="large" color={colors.button} style={{ marginTop: 24 }} />
          <Text style={[styles.loadingText, { color: colors.info }]}>Checking credentials...</Text>
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View style={styles.flexContainer}>
              <View style={styles.innerContainer}>
                {/* App logo at the top */}
                <Image source={require('../../assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
                <Text style={[styles.title, { color: colors.text }]}>Hive Snaps Login</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, width: FIELD_WIDTH }]}
                  placeholder="username do not use @"
                  placeholderTextColor={colorScheme === 'dark' ? '#8899A6' : '#536471'}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, width: FIELD_WIDTH }]}
                  placeholder="Posting key only"
                  placeholderTextColor={colorScheme === 'dark' ? '#8899A6' : '#536471'}
                  value={postingKey}
                  onChangeText={setPostingKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}
                <TouchableOpacity style={[styles.button, { backgroundColor: colors.button, width: FIELD_WIDTH, opacity: loading ? 0.7 : 1 }]} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.buttonText, { color: colors.buttonText }]}>Login</Text>}
                </TouchableOpacity>
                <Text style={[styles.info, { color: colors.text, width: FIELD_WIDTH }]}>Your keys are locally stored and encrypted. Only your posting key is required</Text>
                {/* Add space and move the phrase up here */}
                <View style={{ height: 32 }} />
                <Text style={styles.footerText}>Hivesnaps, made with love by @meno</Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flexContainer: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    alignSelf: 'center',
  },
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  info: {
    marginTop: 18,
    fontSize: 14,
    textAlign: 'center',
    alignSelf: 'center',
  },
  footerText: {
    fontSize: 13,
    color: twitterColors.light.footer, // fallback, will be overridden inline
    textAlign: 'center',
    width: '100%',
  },
});
