import { StyleSheet } from 'react-native';

export const ConversationScreenStyles = StyleSheet.create({
  safeArea: { 
    flex: 1 
  },
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1 
  },
  topBarButton: { 
    padding: 6 
  },
  snapPost: { 
    padding: 16, 
    borderBottomWidth: 1 
  },
  snapAuthor: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 4 
  },
  snapBody: { 
    fontSize: 15, 
    marginBottom: 8 
  },
  snapMeta: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 4 
  },
  snapMetaText: { 
    marginLeft: 4, 
    fontSize: 14 
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'auto',
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  replyButtonText: {
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 15,
  },
  repliesList: { 
    padding: 12 
  },
  replyBubble: { 
    borderRadius: 12, 
    padding: 10, 
    marginBottom: 10 
  },
  replyAuthor: { 
    fontWeight: 'bold', 
    fontSize: 14, 
    marginBottom: 2 
  },
  replyBody: { 
    fontSize: 14, 
    marginBottom: 4 
  },
  replyMeta: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  replyMetaText: { 
    marginLeft: 4, 
    fontSize: 13 
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 10 
  },
  snapTimestamp: { 
    fontSize: 12, 
    color: '#8899A6', 
    marginLeft: 8 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  parentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  parentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    flex: 1,
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Loading styles
  loadingContainer: {
    alignItems: 'center', 
    marginTop: 40 
  },
  loadingText: {
    fontSize: 16 
  },
  // Error styles
  errorContainer: {
    alignItems: 'center', 
    marginTop: 40 
  },
  errorText: {
    fontSize: 16 
  },
  // Image styles
  imageContainer: {
    marginBottom: 8 
  },
  imageStyle: {
    width: '100%', 
    height: 200, 
    borderRadius: 12, 
    marginBottom: 6, 
    backgroundColor: '#eee' 
  },
  // Video styles
  videoContainer: {
    width: '100%', 
    aspectRatio: 16 / 9, 
    marginVertical: 10, 
    borderRadius: 12, 
    overflow: 'hidden', 
    backgroundColor: '#222' 
  },
  videoStyle: {
    width: '100%', 
    height: '100%' 
  },
  // Markdown image styles
  markdownImage: {
    width: '100%',
    aspectRatio: 1.2,
    maxHeight: 340,
    borderRadius: 14,
    marginVertical: 10,
    alignSelf: 'center',
    backgroundColor: '#222',
  },
  // Text content styles
  textContentContainer: {
    marginTop: 8 
  },
  // Profile link styles
  profileLink: {
    fontWeight: 'bold', 
    textDecorationLine: 'underline' 
  },
  // Hashtag link styles
  hashtagLink: {
    fontWeight: 'bold', 
    textDecorationLine: 'underline' 
  },
  // External link styles
  externalLink: {
    textDecorationLine: 'underline' 
  },
  // Spoiler styles
  spoilerContainer: {
    marginVertical: 4 
  },
  // Hive post preview styles
  hivePostPreviewContainer: {
    marginVertical: 8 
  },
  // Author row styles
  authorRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  authorInfo: {
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  authorName: {
    marginLeft: 10 
  },
  // Meta information styles
  metaInfo: {
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  voteCount: {
    marginLeft: 4 
  },
  replyCount: {
    marginLeft: 12 
  },
  payout: {
    marginLeft: 12 
  },
  // Action buttons container
  actionButtons: {
    flex: 1 
  },
  // Edit button styles
  editButton: {
    marginRight: 8 
  },
  editButtonText: {
    fontSize: 12 
  },
  // Reply button styles
  replyButtonContainer: {
    marginLeft: 'auto' 
  },
  // Upvote button styles
  upvoteButton: {
    backgroundColor: 'transparent' 
  },
  upvotedIcon: {
    color: '#8e44ad' 
  },
  // Timestamp styles
  timestamp: {
    marginLeft: 8 
  },
  // Edited indicator styles
  editedIndicator: {
    fontStyle: 'italic', 
    marginLeft: 8 
  },
  // Nested reply styles
  nestedReply: {
    marginLeft: 18, 
    marginBottom: 10 
  },
  // Visual level styles for nested replies
  visualLevel1: {
    marginLeft: 18 
  },
  visualLevel2: {
    marginLeft: 36 
  },
  visualLevel3: {
    marginLeft: 54 
  },
  // Content width calculations for nested replies
  contentWidthLevel0: {
    // Full width
  },
  contentWidthLevel1: {
    // Reduced width for level 1
  },
  contentWidthLevel2: {
    // Further reduced width for level 2
  },
  contentWidthLevel3: {
    // Maximum reduced width for level 3
  },
}); 