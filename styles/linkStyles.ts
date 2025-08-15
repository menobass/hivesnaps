import { StyleSheet } from 'react-native';
import { useMemo } from 'react';

// Shared link styles for inline links in markdown/HTML renderers
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

// Hook to memoize color/size/lineHeight per theme and context (reply vs. main)
export function useLinkTextStyle(iconColor: string, isReply: boolean) {
  return useMemo(
    () => ({
      color: iconColor,
      fontSize: isReply ? 14 : 15,
      ...(isReply ? { lineHeight: 20 } : null),
    }),
    [iconColor, isReply]
  );
}
