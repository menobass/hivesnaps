// Test for content width calculation in conversation screen
// This test verifies that content width is properly calculated for different nesting levels

const testContentWidthCalculation = () => {
  console.log('🧪 Testing content width calculation...');
  
  // Mock the content width calculation from ConversationScreen.tsx
  const calculateContentWidth = (windowWidth, level) => {
    if (level >= 3) {
      return Math.max(windowWidth - 150, 200); // Responsive width for deep nesting
    }
    const maxVisualLevel = 2;
    const visualLevel = Math.min(level, maxVisualLevel);
    return Math.max(windowWidth - visualLevel * 18 - 32, 200);
  };
  
  // Test different screen widths
  const screenWidths = [320, 375, 414, 768]; // iPhone SE, iPhone 12, iPhone 12 Pro Max, iPad
  
  screenWidths.forEach(windowWidth => {
    console.log(`\n📱 Testing with screen width: ${windowWidth}px`);
    
    for (let level = 0; level <= 6; level++) {
      const contentWidth = calculateContentWidth(windowWidth, level);
      const visualLevel = Math.min(level, 2);
      const marginLeft = level >= 3 ? Math.min(50, windowWidth * 0.15) : visualLevel * 18;
      
      console.log(`   Level ${level}: visual=${visualLevel}, left=${marginLeft}px, content=${contentWidth}px`);
      
      // Check if content width is reasonable
      if (contentWidth < 150) {
        console.log(`   ⚠️  Warning: Content width ${contentWidth}px might be too narrow for level ${level}`);
      }
      
      // Check if content width is at least the minimum
      if (contentWidth < 200) {
        console.log(`   ❌ Error: Content width ${contentWidth}px is below minimum 200px for level ${level}`);
      }
    }
  });
  
  console.log('\n✅ Content width calculation test completed!');
};

// Run the test
if (require.main === module) {
  testContentWidthCalculation();
}

module.exports = { testContentWidthCalculation }; 