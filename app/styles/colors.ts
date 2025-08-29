import { useColorScheme } from 'react-native';

export type AppColors = {
  background: string;
  text: string;
  bubble: string;
  border: string;
  icon: string;
  payout: string;
  placeholderText: string;
};

export const palettes: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#FFFFFF',
    text: '#0F1419',
    bubble: '#F7F9F9',
    border: '#CFD9DE',
    icon: '#1DA1F2',
    payout: '#17BF63',
  // Slightly muted slate-ish gray for placeholders in light mode
  placeholderText: '#94a3b8',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    bubble: '#22303C',
    border: '#38444D',
    icon: '#1DA1F2',
    payout: '#17BF63',
  // Muted blue-gray for placeholders in dark mode
  placeholderText: '#8899A6',
  },
};

export function getAppColorsByScheme(scheme: 'light' | 'dark'): AppColors {
  return palettes[scheme];
}

export function useAppColors(): AppColors {
  const scheme = useColorScheme() || 'light';
  return getAppColorsByScheme(scheme as 'light' | 'dark');
}
