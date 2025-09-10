import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { HivePostPreviewProvider } from '../context/HivePostPreviewContext';
import { ShareProvider } from '../context/ShareContext';
import { AppProvider } from '../store/context';
import TOSWrapper from '../components/TOSWrapper';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  // Do NOT call useUserProfile or useSetUserProfile here!
  return (
    <AppProvider>
      <ShareProvider>
        <HivePostPreviewProvider>
          <ThemeProvider
            value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
          >
            <TOSWrapper>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name='(tabs)' />
                <Stack.Screen name='FeedScreen' />
                <Stack.Screen name='NotificationsScreen' />
                <Stack.Screen name='ConversationScreen' />
                <Stack.Screen name='HivePostScreen' />
                <Stack.Screen name='ProfileScreen' />
                <Stack.Screen name='ComposeScreen' />
                <Stack.Screen name='modal' options={{ presentation: 'modal' }} />
              </Stack>
            </TOSWrapper>
          </ThemeProvider>
        </HivePostPreviewProvider>
      </ShareProvider>
    </AppProvider>
  );
}
