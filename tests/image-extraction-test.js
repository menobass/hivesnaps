/**
 * Test file to verify image extraction functionality
 * Run with: node test/image-extraction-test.js
 */

// Mock the utility functions
const extractImageInfo = (content) => {
  const images = [];
  
  // Extract markdown images
  const markdownImageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
  let match;
  while ((match = markdownImageRegex.exec(content)) !== null) {
    const [, altText, url] = match;
    images.push({
      url: url.trim(),
      altText: altText.trim(),
      markdown: match[0],
      type: 'markdown',
    });
  }
  
  // Extract HTML images
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const url = match[1];
    
    const altMatch = fullMatch.match(/alt=["']([^"']+)["']/i);
    const altText = altMatch ? altMatch[1] : '';

    images.push({
      url: url.trim(),
      altText: altText.trim(),
      markdown: fullMatch,
      type: 'html',
    });
  }
  
  return images;
};

const stripImageTags = (content) => {
  let cleaned = content.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');
  cleaned = cleaned.replace(/<img[^>]+src=["'][^"'>]+["'][^>]*>/g, '');
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').trim();
  return cleaned;
};

const getFirstImageUrl = (content) => {
  const images = extractImageInfo(content);
  return images.length > 0 ? images[0].url : null;
};

// Test cases
const testCases = [
  {
    name: 'Markdown image with alt text',
    content: 'Hello world! ![My Image](https://example.com/image.jpg) This is some text.',
    expectedImages: 1,
    expectedUrl: 'https://example.com/image.jpg',
    expectedAltText: 'My Image',
    expectedType: 'markdown'
  },
  {
    name: 'HTML image with alt text',
    content: 'Hello world! <img src="https://example.com/image.jpg" alt="My Image" /> This is some text.',
    expectedImages: 1,
    expectedUrl: 'https://example.com/image.jpg',
    expectedAltText: 'My Image',
    expectedType: 'html'
  },
  {
    name: 'Multiple images',
    content: '![First](https://example.com/first.jpg) ![Second](https://example.com/second.jpg)',
    expectedImages: 2,
    expectedUrl: 'https://example.com/first.jpg',
    expectedAltText: 'First',
    expectedType: 'markdown'
  },
  {
    name: 'No images',
    content: 'Just plain text without any images.',
    expectedImages: 0,
    expectedUrl: null,
    expectedAltText: null,
    expectedType: null
  },
  {
    name: 'Mixed content with images',
    content: 'Some text ![Image](https://example.com/image.jpg) more text <img src="https://example.com/html.jpg" alt="HTML Image" /> final text',
    expectedImages: 2,
    expectedUrl: 'https://example.com/image.jpg',
    expectedAltText: 'Image',
    expectedType: 'markdown'
  }
];

// Run tests
function runTests() {
  console.log('🧪 Running image extraction tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   Content: "${testCase.content}"`);
    
    try {
      const images = extractImageInfo(testCase.content);
      const firstImageUrl = getFirstImageUrl(testCase.content);
      const strippedContent = stripImageTags(testCase.content);
      
      // Test image count
      const countMatch = images.length === testCase.expectedImages;
      if (!countMatch) {
        console.log(`   ❌ FAIL - Expected ${testCase.expectedImages} images, got ${images.length}`);
        failed++;
        continue;
      }
      
      // Test first image URL
      const urlMatch = firstImageUrl === testCase.expectedUrl;
      if (!urlMatch) {
        console.log(`   ❌ FAIL - Expected URL: ${testCase.expectedUrl}, got: ${firstImageUrl}`);
        failed++;
        continue;
      }
      
      // Test first image details if images exist
      if (images.length > 0) {
        const firstImage = images[0];
        const altMatch = firstImage.altText === testCase.expectedAltText;
        const typeMatch = firstImage.type === testCase.expectedType;
        
        if (!altMatch || !typeMatch) {
          console.log(`   ❌ FAIL - Alt text or type mismatch`);
          console.log(`      Expected alt: "${testCase.expectedAltText}", got: "${firstImage.altText}"`);
          console.log(`      Expected type: "${testCase.expectedType}", got: "${firstImage.type}"`);
          failed++;
          continue;
        }
      }
      
      // Test that stripped content doesn't contain image tags
      const hasImageTags = /!\[.*\]\(.*\)|<img.*src.*>/i.test(strippedContent);
      if (hasImageTags) {
        console.log(`   ❌ FAIL - Stripped content still contains image tags`);
        console.log(`      Stripped: "${strippedContent}"`);
        failed++;
        continue;
      }
      
      console.log(`   ✅ PASS - Found ${images.length} images, first URL: ${firstImageUrl}`);
      console.log(`   ✅ PASS - Stripped content: "${strippedContent}"`);
      passed++;
      
    } catch (error) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Image extraction is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run the tests
runTests().catch(console.error); 