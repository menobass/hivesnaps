import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to LoginScreen on app launch
    router.replace('/LoginScreen');
  }, []);

  // No UI needed, just redirects
  return null;
}