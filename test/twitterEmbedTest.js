// Quick test for Twitter/X embed functionality
const { removeTwitterUrls, removeEmbedUrls } = require('../utils/extractVideoInfo');

// Simple extract function for testing
function extractTwitterUrl(text) {
  const twitterMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
  return twitterMatch ? twitterMatch[0] : null;
}

// Test cases
const testCases = [
  {
    name: 'Twitter.com URL',
    input: 'Check out this tweet: https://twitter.com/elonmusk/status/1234567890123456789',
    expectExtract: 'https://twitter.com/elonmusk/status/1234567890123456789',
    expectRemove: 'Check out this tweet:'
  },
  {
    name: 'X.com URL', 
    input: 'Amazing post! https://x.com/jack/status/9876543210987654321 What do you think?',
    expectExtract: 'https://x.com/jack/status/9876543210987654321',
    expectRemove: 'Amazing post! What do you think?'
  },
  {
    name: 'Mixed content with YouTube and Twitter',
    input: 'Video: https://youtube.com/watch?v=dQw4w9WgXcQ and tweet: https://twitter.com/test/status/123',
    expectRemove: 'Video: and tweet:'
  },
  {
    name: 'No Twitter URL',
    input: 'Just a regular post with https://example.com',
    expectExtract: null,
    expectRemove: 'Just a regular post with https://example.com'
  }
];

// Simple test runner
console.log('🧪 Testing Twitter/X URL extraction and removal...\n');

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}: ${test.name}`);
  console.log(`Input: ${test.input}`);
  
  if (test.expectExtract !== undefined) {
    const extracted = extractTwitterUrl(test.input);
    const extractPass = extracted === test.expectExtract;
    console.log(`Extract: ${extracted} ${extractPass ? '✅' : '❌'}`);
  }
  
  const removed = removeEmbedUrls(test.input).trim();
  const removePass = removed === test.expectRemove.trim();
  console.log(`Remove: "${removed}" ${removePass ? '✅' : '❌'}`);
  console.log('');
});

console.log('Test completed! 🎉');
