// Simple test to verify username regex patterns handle dots correctly
// This is a quick test to verify the fix for @atma.love and similar usernames

// Test the updated regex patterns
const testUsernames = [
  'atma.love',
  'alice',
  'bob.test',
  'charlie-123',
  'user.with.dots',
  'simple',
  'test-user.123'
];

const testMessages = [
  '@atma.love voted on your post ($0.013)',
  '@atma.love replied to your post',
  '@atma.love reblogged your post',
  '@atma.love followed you',
  '@atma.love mentioned you in a post',
  '@alice voted on your post ($1.25)',
  '@bob.test replied to your comment',
  '@charlie-123 started following you'
];

const testUrls = [
  '@atma.love/sample-post-123',
  '@alice/another-post',
  '@bob.test/test-post-456',
  '@user.with.dots/my-awesome-post'
];

console.log('Testing username regex patterns...\n');

// Test vote pattern
const voteRegex = /@([a-z0-9.-]+) voted on your post \(\$([0-9.]+)\)/;
console.log('Vote pattern tests:');
testMessages.filter(msg => msg.includes('voted')).forEach(msg => {
  const match = msg.match(voteRegex);
  console.log(`  "${msg}" -> ${match ? `username: ${match[1]}, amount: $${match[2]}` : 'NO MATCH'}`);
});

// Test reply pattern
const replyRegex = /@([a-z0-9.-]+) replied to your/;
console.log('\nReply pattern tests:');
testMessages.filter(msg => msg.includes('replied')).forEach(msg => {
  const match = msg.match(replyRegex);
  console.log(`  "${msg}" -> ${match ? `username: ${match[1]}` : 'NO MATCH'}`);
});

// Test reblog pattern
const reblogRegex = /@([a-z0-9.-]+) reblogged your/;
console.log('\nReblog pattern tests:');
testMessages.filter(msg => msg.includes('reblogged')).forEach(msg => {
  const match = msg.match(reblogRegex);
  console.log(`  "${msg}" -> ${match ? `username: ${match[1]}` : 'NO MATCH'}`);
});

// Test follow pattern
const followRegex = /@([a-z0-9.-]+) (?:followed|started following) you/;
console.log('\nFollow pattern tests:');
testMessages.filter(msg => msg.includes('follow')).forEach(msg => {
  const match = msg.match(followRegex);
  console.log(`  "${msg}" -> ${match ? `username: ${match[1]}` : 'NO MATCH'}`);
});

// Test mention pattern
const mentionRegex = /@([a-z0-9.-]+) mentioned you/;
console.log('\nMention pattern tests:');
testMessages.filter(msg => msg.includes('mentioned')).forEach(msg => {
  const match = msg.match(mentionRegex);
  console.log(`  "${msg}" -> ${match ? `username: ${match[1]}` : 'NO MATCH'}`);
});

// Test URL pattern
const urlRegex = /@([a-z0-9.-]+)\/([a-z0-9-]+)/;
console.log('\nURL pattern tests:');
testUrls.forEach(url => {
  const match = url.match(urlRegex);
  console.log(`  "${url}" -> ${match ? `author: ${match[1]}, permlink: ${match[2]}` : 'NO MATCH'}`);
});

console.log('\nAll tests completed! ✅');
