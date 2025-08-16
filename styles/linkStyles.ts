import { StyleSheet, TextStyle } from 'react-native';
import { useMemo } from 'react';

// Centralized link styles for inline links used across components
export const linkStyles = StyleSheet.create({
  base: {
    textDecorationLine: 'underline',
  },
  mention: {
    fontWeight: 'bold',
  },
  hashtag: {},
  external: {},
});

export type MinimalThemeColors = { icon: string };

// Hook to memoize link text style per theme and context
export function useLinkTextStyle(iconColor: string, isReply: boolean) {
  return useMemo(
    () => ({
      color: iconColor,
      fontSize: isReply ? 14 : 15,
      ...(isReply ? { lineHeight: 20 } : {}),
    }),
    [iconColor, isReply]
  );
}
