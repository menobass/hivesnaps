import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const createFeedScreenStyles = (colors: any, isDark: boolean) => {
  return StyleSheet.create({
    // Main container styles
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    safeArea: {
      backgroundColor: colors.background,
    },

    // Top bar styles
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    profileButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoText: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
    },
    notificationButton: {
      position: 'relative',
    },
    bellBtn: {
      marginLeft: 8,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    rewardIndicator: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#FFD700',
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
      minWidth: 16,
      alignItems: 'center',
    },
    username: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },

    // Slogan styles
    sloganRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    sloganText: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      textAlign: 'center',
      opacity: 0.8,
    },
    slogan: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      textAlign: 'center',
      opacity: 0.8,
    },

    // Filter styles
    filterContainer: {
      marginBottom: 18,
      height: 44,
      position: 'relative',
    },
    filterScrollView: {
      flexGrow: 0,
    },
    filterScrollContent: {
      paddingHorizontal: 4,
      alignItems: 'center',
      minWidth: '100%',
    },
    filterBtnScrollable: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 22,
      minWidth: 100,
      height: 40,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    filterTextScrollable: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    filterIcon: {
      marginRight: 6,
    },

    // Fade indicator styles
    fadeIndicator: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 20,
      zIndex: 1,
      opacity: 0.8,
    },
    leftFade: {
      left: 0,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    rightFade: {
      right: 0,
      borderTopLeftRadius: 10,
      borderBottomLeftRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },

    // Feed list styles
    feedList: {
      flex: 1,
    },
    feedContent: {
      paddingBottom: 20,
    },
    feedContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    loadingText: {
      color: colors.text,
      marginTop: 16,
      fontSize: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyText: {
      color: colors.text,
      fontSize: 18,
      textAlign: 'center',
      marginTop: 16,
    },

    // Modal styles
    modalOverlay: {
      justifyContent: 'flex-end',
      margin: 0,
    },
    modalContent: {
      backgroundColor: colors.background,
      padding: 16,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      minHeight: 200,
      maxHeight: screenHeight * 0.8,
    },
    modalTitle: {
      color: colors.text,
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 8,
    },
    modalImagePreview: {
      marginBottom: 10,
    },
    modalImage: {
      width: 120,
      height: 120,
      borderRadius: 10,
    },
    modalCloseButton: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    modalGifBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    modalGifBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    modalErrorText: {
      color: 'red',
      marginBottom: 8,
    },

    // Input row styles
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    inputButton: {
      marginRight: 16,
      paddingBottom: 8,
    },
    inputButtonText: {
      fontSize: 18,
    },
    textInput: {
      flex: 1,
      minHeight: 60,
      maxHeight: 120,
      borderRadius: 10,
      padding: 10,
      marginRight: 10,
      textAlignVertical: 'top',
      backgroundColor: colors.bubble,
      color: colors.text,
    },
    inputSpinner: {
      marginRight: 8,
      marginBottom: 8,
    },
    submitButton: {
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginBottom: 8,
    },
    submitButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 15,
    },

    // GIF picker styles
    gifPickerContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: screenHeight * 0.8,
      paddingBottom: 20,
    },
    gifPickerHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#38444d' : '#E1E8ED',
    },
    gifPickerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    gifSearchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    gifSearchInput: {
      backgroundColor: colors.bubble,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
    },
    gifGrid: {
      paddingHorizontal: 8,
    },
    gifGridContent: {
      paddingBottom: 20,
    },
    gifItem: {
      flex: 1,
      margin: 4,
      borderRadius: 8,
      overflow: 'hidden',
      aspectRatio: 1,
    },
    gifImage: {
      width: '100%',
      height: '100%',
    },
    gifLoadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    gifLoadingText: {
      color: colors.text,
      marginTop: 16,
    },
    gifEmptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    gifEmptyText: {
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
    },

    // FAB (Floating Action Button) styles
    fab: {
      position: 'absolute',
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.button,
      right: 20,
      bottom: 80,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    fabIcon: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },

    // Keyboard avoiding view
    keyboardAvoidingView: {
      flex: 0,
    },

    // Platform specific styles
    iosModalPadding: {
      paddingBottom: 16,
    },
    androidModalPadding: {
      paddingBottom: 16,
    },

    // Shadow styles
    cardShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },

    // Utility styles
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    row: {
      flexDirection: 'row',
    },
    column: {
      flexDirection: 'column',
    },
    spaceBetween: {
      justifyContent: 'space-between',
    },
    alignCenter: {
      alignItems: 'center',
    },
    fullWidth: {
      width: '100%',
    },
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
    },
  });
};

// Color-agnostic base styles that don't depend on theme
export const baseStyles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flex1: {
    flex: 1,
  },
  flex0: {
    flex: 0,
  },
  zIndex1: {
    zIndex: 1,
  },
  zIndex2: {
    zIndex: 2,
  },
  zIndex3: {
    zIndex: 3,
  },
});
