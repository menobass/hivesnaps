// Simple test for spoiler parser
const fs = require('fs');
const path = require('path');

// Read the TypeScript file and eval it manually for testing
const spoilerParserContent = fs.readFileSync(path.join(__dirname, 'utils/spoilerParser.ts'), 'utf8');

// Extract the convertSpoilerSyntax function manually
const convertSpoilerSyntax = (text) => {
  const spoilerRegex = />!\s*\[([^\]]+)\]\s*([^\n\r]*)/g;
  
  return text.replace(spoilerRegex, (match, buttonText, content) => {
    return `<spoiler data-button="${buttonText.trim()}">${content.trim()}</spoiler>`;
  });
};

// Test cases
const tests = [
  '>! [Show Answer] The answer is 42 moves',
  '>! [Solution] Queen takes rook, checkmate in 2 moves',
  'Normal text >! [Spoiler] This is hidden content more text',
  'Multiple spoilers >! [First] Content 1 and >! [Second] Content 2'
];

console.log('=== Spoiler Parser Test ===');
tests.forEach((test, i) => {
  console.log(`\nTest ${i + 1}:`);
  console.log('Input:', test);
  console.log('Output:', convertSpoilerSyntax(test));
});
