import { useMemo } from 'react';
import { Appearance } from 'react-native';

// Type for theme colors we rely on
export interface ThemeColors {
  text: string;
  button: string; // accent
  border: string;
  card: string;
  icon: string;
  background: string;
}

// Helper to slightly adjust opacity for backgrounds
function withAlpha(hex: string, alpha: number) {
  if (hex.startsWith('#')) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

export interface MarkdownStylesOptions {
  isDark: boolean;
  colors: ThemeColors;
}

export function buildMarkdownStyles({ isDark, colors }: MarkdownStylesOptions) {
  const codeBg = isDark ? withAlpha(colors.card, 0.6) : withAlpha(colors.card, 0.9);
  const quoteBg = isDark ? withAlpha(colors.card, 0.6) : withAlpha(colors.card, 0.85);

  return {
    body: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    link: {
      color: colors.icon,
      textDecorationLine: 'underline',
    },
    strong: {
      fontWeight: 'bold',
      color: colors.text,
    },
    em: {
      fontStyle: 'italic',
      color: colors.text,
    },
    code_inline: {
      backgroundColor: codeBg,
      color: colors.text,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    code_block: {
      backgroundColor: codeBg,
      color: colors.text,
      padding: 10,
      borderRadius: 8,
      fontFamily: 'monospace',
      fontSize: 13,
      marginVertical: 8,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: colors.button,
      paddingLeft: 14,
      marginVertical: 8,
      backgroundColor: quoteBg,
      paddingVertical: 8,
      paddingRight: 12,
      borderRadius: 6,
    },
    list_item: {
      marginBottom: 4,
      color: colors.text,
    },
    bullet_list: {
      marginBottom: 12,
      paddingLeft: 16,
    },
    ordered_list: {
      marginBottom: 12,
      paddingLeft: 16,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
  } as const;
}

// React hook variant (optional usage) to memoize styles by theme
export function useMarkdownStyles(colors: ThemeColors) {
  const scheme = Appearance.getColorScheme();
  const isDark = scheme === 'dark' || colors.background?.toLowerCase?.() === '#000';
  return useMemo(() => buildMarkdownStyles({ isDark, colors }), [isDark, colors]);
}
