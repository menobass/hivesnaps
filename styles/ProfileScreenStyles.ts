import { StyleSheet } from 'react-native';

// Color theme definition
const profileScreenColors = {
  light: {
    background: '#fff',
    text: '#0F1419',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#E1E8ED',
    icon: '#1DA1F2',
    border: '#eee',
    bubble: '#f7f9f9',
    payout: '#17BF63',
    mutedButton: '#E74C3C',
    followButton: '#1DA1F2',
    unfollowButton: '#8B9DC3',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#22303C',
    icon: '#1DA1F2',
    border: '#38444D',
    bubble: '#22303C',
    payout: '#17BF63',
    mutedButton: '#E74C3C',
    followButton: '#1DA1F2',
    unfollowButton: '#8B9DC3',
  },
};

interface ProfileScreenColors {
  background: string;
  text: string;
  button: string;
  buttonText: string;
  buttonInactive: string;
  icon: string;
  border: string;
  bubble: string;
  payout: string;
  mutedButton: string;
  followButton: string;
  unfollowButton: string;
  // Additional colors used in ProfileScreen
  safeAreaBackground: string;
  headerBorderColor: string;
  defaultAvatarBackground: string;
  editAvatarTextColor: string;
  socialStatNumberColor: string;
  socialStatLabelColor: string;
  displayNameColor: string;
  aboutTextColor: string;
  statsSectionBackground: string;
  statLabelColor: string;
  statValueColor: string;
  unclaimedSectionBackground: string;
  unclaimedSectionBorderColor: string;
  unclaimedTitleColor: string;
  unclaimedTextColor: string;
  claimButtonBackground: string;
  infoTextColor: string;
  infoTextIconColor: string;
  snapsSectionTitleColor: string;
  loadSnapsButtonBackground: string;
  loadSnapsButtonTextColor: string;
  snapsErrorTextColor: string;
  retryButtonBackground: string;
  retryButtonTextColor: string;
  snapsEmptyTextColor: string;
  loadMoreButtonBackground: string;
  loadMoreButtonTextColor: string;
  logoutButtonBackground: string;
  errorTextColor: string;
}

export const createProfileScreenStyles = (isDark: boolean) => {
  const colors = isDark ? profileScreenColors.dark : profileScreenColors.light;
  
  // Create extended colors object with all the specific color mappings
  const extendedColors: ProfileScreenColors = {
    ...colors,
    // Additional colors for styles
    safeAreaBackground: colors.background,
    headerBorderColor: colors.border,
    defaultAvatarBackground: colors.bubble,
    editAvatarTextColor: colors.icon,
    socialStatNumberColor: colors.text,
    socialStatLabelColor: colors.text,
    displayNameColor: colors.text,
    aboutTextColor: colors.text,
    statsSectionBackground: colors.bubble,
    statLabelColor: colors.text,
    statValueColor: colors.payout,
    unclaimedSectionBackground: colors.bubble,
    unclaimedSectionBorderColor: colors.border,
    unclaimedTitleColor: colors.text,
    unclaimedTextColor: colors.payout,
    claimButtonBackground: colors.icon,
    infoTextColor: colors.text,
    infoTextIconColor: colors.icon,
    snapsSectionTitleColor: colors.text,
    loadSnapsButtonBackground: colors.button,
    loadSnapsButtonTextColor: colors.buttonText,
    snapsErrorTextColor: colors.text,
    retryButtonBackground: colors.button,
    retryButtonTextColor: colors.buttonText,
    snapsEmptyTextColor: colors.text,
    loadMoreButtonBackground: colors.buttonInactive,
    loadMoreButtonTextColor: colors.text,
    logoutButtonBackground: colors.mutedButton,
    errorTextColor: colors.text,
  };

  return StyleSheet.create({
    safeArea: { 
      flex: 1,
      backgroundColor: extendedColors.safeAreaBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: extendedColors.headerBorderColor,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
      textAlign: 'center',
      color: extendedColors.text,
    },
    headerSpacer: {
      width: 36, // Same width as back button to center title
    },
    content: {
      flex: 1,
    },
    profileSection: {
      padding: 24,
      alignItems: 'center',
    },
    username: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: extendedColors.text,
    },
    avatarContainer: {
      marginBottom: 16,
    },
    largeAvatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    defaultAvatar: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: extendedColors.defaultAvatarBackground,
    },
    editAvatarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    editAvatarText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 6,
      color: extendedColors.editAvatarTextColor,
    },
    displayName: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      textAlign: 'center',
      color: extendedColors.displayNameColor,
    },
    socialStats: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 40,
      marginBottom: 20,
    },
    socialStatItem: {
      alignItems: 'center',
    },
    socialStatNumber: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
      color: extendedColors.socialStatNumberColor,
    },
    socialStatLabel: {
      fontSize: 14,
      fontWeight: '500',
      opacity: 0.7,
      color: extendedColors.socialStatLabelColor,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    buttonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 14,
    },
    aboutSection: {
      marginBottom: 20,
      width: '100%',
    },
    aboutText: {
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'center',
      color: extendedColors.aboutTextColor,
    },
    statsSection: {
      width: '100%',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      backgroundColor: extendedColors.statsSectionBackground,
    },
    statItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: extendedColors.statLabelColor,
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.statValueColor,
    },
    additionalInfo: {
      width: '100%',
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoText: {
      fontSize: 15,
      color: extendedColors.infoTextColor,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: extendedColors.text,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: extendedColors.errorTextColor,
    },
    unclaimedSection: {
      width: '100%',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: extendedColors.unclaimedSectionBorderColor,
      backgroundColor: extendedColors.unclaimedSectionBackground,
    },
    unclaimedTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 12,
      color: extendedColors.unclaimedTitleColor,
    },
    unclaimedRewards: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16,
    },
    unclaimedText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.unclaimedTextColor,
    },
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      backgroundColor: extendedColors.claimButtonBackground,
    },
    claimButtonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    logoutSection: {
      width: '100%',
      marginTop: 20,
      marginBottom: 20,
      alignItems: 'center',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      width: '100%',
      backgroundColor: extendedColors.logoutButtonBackground,
    },
    logoutButtonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    // Snaps section styles
    snapsSection: {
      width: '100%',
      marginTop: 20,
    },
    snapsSectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
      color: extendedColors.snapsSectionTitleColor,
    },
    snapsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      position: 'relative',
    },
    refreshButton: {
      position: 'absolute',
      right: 0,
      padding: 8,
    },
    snapsLoadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsLoadingText: {
      marginTop: 8,
      fontSize: 14,
      color: extendedColors.text,
    },
    snapsErrorContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsErrorText: {
      marginTop: 8,
      fontSize: 14,
      textAlign: 'center',
      color: extendedColors.snapsErrorTextColor,
    },
    snapsEmptyContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsEmptyText: {
      marginTop: 12,
      fontSize: 16,
      textAlign: 'center',
      color: extendedColors.snapsEmptyTextColor,
    },
    // Vertical feed styles (replacing horizontal bubble styles)
    verticalFeedContainer: {
      marginTop: 16,
    },
    // Load More button styles
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
      backgroundColor: extendedColors.loadMoreButtonBackground,
    },
    loadMoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: extendedColors.loadMoreButtonTextColor,
    },
    // Load snaps button styles
    loadSnapsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      marginBottom: 20,
      backgroundColor: extendedColors.loadSnapsButtonBackground,
    },
    loadSnapsButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.loadSnapsButtonTextColor,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginTop: 12,
      backgroundColor: extendedColors.retryButtonBackground,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: extendedColors.retryButtonTextColor,
    },
  });
};