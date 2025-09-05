import { StyleSheet, Platform, StatusBar } from 'react-native';

export const createStyles = (colors: any, colorScheme: string) => {
  return StyleSheet.create({
    // Main container
    container: {
      flex: 1,
      backgroundColor: colors.tosBackground,
      paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
    },

    // Header section
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerIcon: {
      position: 'absolute',
      left: 20,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.tosText,
      textAlign: 'center',
    },

    // Important notice section
    noticeContainer: {
      backgroundColor: colorScheme === 'dark' ? '#1A2A3A' : '#F0F8FF',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryButton,
    },
    noticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    noticeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.tosText,
      marginLeft: 8,
    },
    noticeText: {
      fontSize: 14,
      color: colors.tosText,
      opacity: 0.8,
      lineHeight: 20,
    },

    // ScrollView content
    scrollContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    termsText: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.tosText,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // Scroll progress indicator
    scrollIndicator: {
      position: 'absolute',
      bottom: 120,
      right: 20,
      backgroundColor: colors.warning,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    scrollIndicatorText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 6,
    },

    // Action buttons section
    actionContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.tosBackground,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    buttonRow: {
      flexDirection: 'row',
    },

    // Button styles
    declineButton: {
      flex: 1,
      backgroundColor: colors.secondaryButton,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginRight: 12,
    },
    declineButtonText: {
      color: colors.secondaryButtonText,
      fontSize: 16,
      fontWeight: '600',
    },
    acceptButton: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    acceptButtonIcon: {
      marginRight: 8,
    },
    acceptButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },

    // Helper text
    helperText: {
      fontSize: 12,
      color: colors.tosText,
      opacity: 0.6,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 16,
    },
  });
};
