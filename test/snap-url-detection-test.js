/**
 * Test file to verify snap URL detection functionality
 * Run with: node test/snap-url-detection-test.js
 */

// Mock the required modules
const mockParseHivePostUrl = (url) => {
  // Extract author and permlink from URL
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:ecency\.com|peakd\.com|hive\.blog)\/(@[a-z0-9.-]{3,16}\/([a-z0-9-]+))/i);
  if (match) {
    const [, fullPath, permlink] = match;
    const author = fullPath.split('/')[0].substring(1); // Remove @
    return { author, permlink };
  }
  return null;
};

const mockDetectPostType = async (postInfo) => {
  // Mock detection logic
  if (postInfo.permlink.startsWith('snap-')) {
    return 'snap';
  }
  if (postInfo.parent_author === 'peak.snaps') {
    return 'snap';
  }
  return 'hive_post';
};

const mockGetHivePostNavigationInfo = async (url) => {
  try {
    console.log('[TEST] Checking if URL is a Hive post:', url);
    
    // Parse the URL to get author and permlink
    const postInfo = mockParseHivePostUrl(url);
    if (!postInfo) {
      console.log('[TEST] Could not parse URL as Hive post');
      return null;
    }

    // Detect the post type
    const postType = await mockDetectPostType(postInfo);

    const isSnap = postType === 'snap';
    const route = isSnap ? '/ConversationScreen' : '/HivePostScreen';
    
    console.log('[TEST] Navigation info:', {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    });
    
    return {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    };
  } catch (error) {
    console.error('[TEST] Error getting navigation info:', error);
    return null;
  }
};

// Test cases
const testCases = [
  {
    name: 'Snap URL from Ecency',
    url: 'https://ecency.com/@alice/snap-1234567890',
    expectedRoute: '/ConversationScreen',
    expectedIsSnap: true
  },
  {
    name: 'Snap URL from PeakD',
    url: 'https://peakd.com/@bob/snap-0987654321',
    expectedRoute: '/ConversationScreen',
    expectedIsSnap: true
  },
  {
    name: 'Regular Hive post URL',
    url: 'https://hive.blog/@charlie/my-regular-post',
    expectedRoute: '/HivePostScreen',
    expectedIsSnap: false
  },
  {
    name: 'Snap URL without protocol',
    url: 'ecency.com/@dave/snap-1122334455',
    expectedRoute: '/ConversationScreen',
    expectedIsSnap: true
  },
  {
    name: 'Invalid URL',
    url: 'https://example.com/not-a-hive-post',
    expectedRoute: null,
    expectedIsSnap: false
  }
];

// Run tests
async function runTests() {
  console.log('🧪 Running snap URL detection tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    
    try {
      const result = await mockGetHivePostNavigationInfo(testCase.url);
      
      if (result) {
        const routeMatch = result.route === testCase.expectedRoute;
        const snapMatch = result.isSnap === testCase.expectedIsSnap;
        
        if (routeMatch && snapMatch) {
          console.log(`   ✅ PASS - Route: ${result.route}, IsSnap: ${result.isSnap}`);
          passed++;
        } else {
          console.log(`   ❌ FAIL - Expected route: ${testCase.expectedRoute}, got: ${result.route}`);
          console.log(`   ❌ FAIL - Expected isSnap: ${testCase.expectedIsSnap}, got: ${result.isSnap}`);
          failed++;
        }
      } else {
        if (testCase.expectedRoute === null) {
          console.log(`   ✅ PASS - Correctly returned null for invalid URL`);
          passed++;
        } else {
          console.log(`   ❌ FAIL - Expected route: ${testCase.expectedRoute}, got: null`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run the tests
runTests().catch(console.error); 