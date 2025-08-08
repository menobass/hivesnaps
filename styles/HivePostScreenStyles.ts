import { StyleSheet } from 'react-native';

export const HivePostScreenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  authorDetails: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contentBody: {
    marginBottom: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
  },
  engagementMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  engagementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upvoteButton: {
    marginRight: 16,
  },
  engagementText: {
    fontSize: 16,
    marginRight: 16,
  },
  commentIcon: {
    marginRight: 8,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  replyIcon: {
    marginRight: 6,
  },
  replyText: {
    fontSize: 16,
  },
  payoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  commentsSection: {
    marginTop: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  commentsHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  commentsError: {
    padding: 16,
    alignItems: 'center',
  },
  commentsErrorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryCommentsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  retryCommentsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noCommentsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  commentsList: {
    marginTop: 8,
  },
});
