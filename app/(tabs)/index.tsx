import { StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, TextInput, Image, TouchableOpacity, useColorScheme, Dimensions } from 'react-native';
import { useState } from 'react';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';

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

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];
  const router = useRouter();

  const handleLogin = () => {
    // Dummy login, just navigate to FeedScreen
    router.push('/FeedScreen');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
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
          />
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.button, width: FIELD_WIDTH }]} onPress={handleLogin}>
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Login</Text>
          </TouchableOpacity>
          <Text style={[styles.info, { color: colors.text, width: FIELD_WIDTH }]}>Your keys are locally stored and encrypted. Only your posting key is required</Text>
        </View>
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Hivesnaps, made with love by @meno</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerText: {
    fontSize: 13,
    color: twitterColors.light.footer, // fallback, will be overridden inline
    textAlign: 'center',
    width: '100%',
  },
});
