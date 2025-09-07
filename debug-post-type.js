/**
 * Debug script to test post type detection for the two problematic posts
 */

const { Client } = require('@hiveio/dhive');

const client = new Client([
  'https://api.hive.blog',
  'https://api.hivekings.com',
  'https://anyx.io',
]);

async function debugPost(author, permlink, description) {
  console.log(`\n=== DEBUGGING: ${description} ===`);
  console.log(`URL: https://peakd.com/hive-186392/@${author}/${permlink}`);
  
  try {
    const post = await client.database.call('get_content', [author, permlink]);
    
    if (!post) {
      console.log('❌ Post not found');
      return;
    }

    // Basic post info
    console.log('📝 Basic Info:');
    console.log(`  Author: ${post.author}`);
    console.log(`  Permlink: ${post.permlink} (${post.permlink.length} chars)`);
    console.log(`  Title: "${post.title}" (${post.title?.length || 0} chars)`);
    console.log(`  Body length: ${post.body?.length || 0} chars`);
    console.log(`  Parent author: "${post.parent_author}"`);
    console.log(`  Parent permlink: "${post.parent_permlink}"`);
    
    // Analyze snap indicators
    console.log('\n🔍 Snap Indicators Analysis:');
    const snapIndicators = [];
    
    // Check for short content
    if (post.body && post.body.length < 500) {
      snapIndicators.push('short_content');
      console.log(`  ✅ Short content: ${post.body.length} < 500 chars`);
    } else {
      console.log(`  ❌ Not short content: ${post.body?.length || 0} chars`);
    }
    
    // Check for no title
    if (!post.title || post.title.trim().length === 0) {
      snapIndicators.push('no_title');
      console.log(`  ✅ No title`);
    } else {
      console.log(`  ❌ Has title: "${post.title}"`);
    }
    
    // Check for no parent
    if (!post.parent_author || post.parent_author === '') {
      snapIndicators.push('no_parent');
      console.log(`  ✅ No parent`);
    } else {
      console.log(`  ❌ Has parent: ${post.parent_author}`);
    }
    
    // Check for snap permlink
    if (post.permlink && post.permlink.startsWith('snap-')) {
      snapIndicators.push('snap_permlink');
      console.log(`  ✅ Snap permlink pattern`);
    } else {
      console.log(`  ❌ Not snap permlink pattern`);
    }
    
    // Check metadata
    if (post.json_metadata) {
      try {
        const metadata = JSON.parse(post.json_metadata);
        console.log(`  📋 Metadata app: "${metadata.app}"`);
        console.log(`  📋 Metadata tags: [${metadata.tags?.join(', ') || 'none'}]`);
        
        if (metadata.app && metadata.app.includes('hivesnaps')) {
          snapIndicators.push('hivesnaps_app');
          console.log(`  ✅ HiveSnaps app`);
        } else {
          console.log(`  ❌ Not HiveSnaps app`);
        }
        
        // Updated logic: Only consider hivesnaps tag if there are other strong indicators
        const hasStrongSnapIndicators = 
          post.permlink?.startsWith('snap-') || 
          post.parent_author === 'peak.snaps' || 
          (metadata.app && metadata.app.includes('hivesnaps'));
          
        if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.includes('hivesnaps') && hasStrongSnapIndicators) {
          snapIndicators.push('hivesnaps_tag');
          console.log(`  ✅ HiveSnaps tag (with strong indicators)`);
        } else if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.includes('hivesnaps')) {
          console.log(`  ❌ HiveSnaps tag present but no strong indicators - ignoring`);
        } else {
          console.log(`  ❌ No HiveSnaps tag`);
        }
      } catch (e) {
        console.log(`  ❌ Invalid JSON metadata`);
      }
    } else {
      console.log(`  📋 No metadata`);
    }
    
    console.log(`\n🎯 Total snap indicators: ${snapIndicators.length} [${snapIndicators.join(', ')}]`);
    console.log(`🎯 Would be classified as: ${snapIndicators.length >= 2 ? 'SNAP (ConversationScreen)' : 'REGULAR POST (HivePostScreen)'}`);
    
  } catch (error) {
    console.error('❌ Error fetching post:', error.message);
  }
}

async function main() {
  console.log('🔍 Debugging post type detection for two similar posts...\n');
  
  // Test the first post (goes to ConversationScreen - incorrect)
  await debugPost('meno', 'pull-requests-patience-and-our-dance-with-apple', 'First Post (incorrect routing)');
  
  // Test the second post (goes to HivePostScreen - correct) 
  await debugPost('meno', 'hiveauth-little-battles-that-count', 'Second Post (correct routing)');
  
  console.log('\n✅ Debug complete!');
}

main().catch(console.error);
