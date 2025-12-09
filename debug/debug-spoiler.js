// Debug script to test spoiler parsing
function parseSpoilerBlocks(text) {
  if (!text) return text;
  
  const spoilerRegex = />!\s*\[([^\]]+)\]\s*([^\n\r]*)/g;
  
  return text.replace(spoilerRegex, (match, buttonText, content) => {
    console.log('Match found:', { match, buttonText, content });
    return `<spoiler data-button="${buttonText.trim()}">${content.trim()}</spoiler>`;
  });
}

function convertSpoilerSyntax(text) {
  return parseSpoilerBlocks(text);
}

// Test with the actual post content
const testContent = 'Simpler test ahead\n\n>! [Push to reveal] the answer is 23';
console.log('Original:', JSON.stringify(testContent));
console.log('Converted:', JSON.stringify(convertSpoilerSyntax(testContent)));

// Test a more complex example
const complexTest = `This is a test

>! [First spoiler] First hidden content
Some text in between
>! [Second spoiler] Second hidden content

More text after`;

console.log('\nComplex test:');
console.log('Original:', JSON.stringify(complexTest));
console.log('Converted:', JSON.stringify(convertSpoilerSyntax(complexTest)));
