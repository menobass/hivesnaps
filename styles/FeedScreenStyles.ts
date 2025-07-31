import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const createFeedScreenStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.buttonInactive,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  rewardIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: colors.background,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sloganRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  slogan: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.buttonInactive,
  },
  bellBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.buttonInactive,
  },
  filterContainer: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.buttonInactive,
  },
  filterScrollView: {
    paddingHorizontal: 16,
  },
  filterScrollContent: {
    alignItems: 'center',
  },
  filterBtnScrollable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTextScrollable: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  feedContainer: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.button,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.buttonText,
  },
  searchModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  searchContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flex: 1,
    padding: 16,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchCloseBtn: {
    padding: 8,
    marginRight: 8,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  searchTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  searchTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.buttonInactive,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: isDark ? '#1C2938' : '#F7F9FA',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  searchSubmitBtn: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: colors.button,
    borderRadius: 8,
  },
  recentSection: {
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#1C2938' : '#F7F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  recentSearchText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  recentSearchRemove: {
    padding: 4,
  },
  searchResults: {
    flex: 1,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  searchLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  searchLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text,
  },
  searchUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#1C2938' : '#F7F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  searchUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchUserHandle: {
    fontSize: 14,
    color: colors.buttonInactive,
    marginTop: 2,
  },
  searchUserAbout: {
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
    opacity: 0.7,
  },
  emptySearchContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptySearchText: {
    fontSize: 14,
    color: colors.buttonInactive,
    marginTop: 8,
  },
  // Additional search modal styles
  searchHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  searchFilters: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchFilterBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: colors.buttonInactive,
  },
  searchFilterBtnActive: {
    backgroundColor: colors.button,
  },
  searchFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  searchFilterTextActive: {
    color: colors.buttonText,
  },
  searchContent: {
    flex: 1,
  },
  recentSearchesSection: {
    marginBottom: 16,
  },
  recentSearchesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  clearRecentBtn: {
    padding: 4,
  },
  searchEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  searchEmptyText: {
    fontSize: 14,
    color: colors.buttonInactive,
    textAlign: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#1C2938' : '#F7F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchResultMeta: {
    fontSize: 14,
    color: colors.buttonInactive,
    marginTop: 2,
  },
  searchResultContent: {
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
    opacity: 0.7,
  },
});
