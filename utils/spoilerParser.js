/**
 * Utility to process spoiler markdown syntax and convert it to custom syntax
 *
 * Spoiler syntax: >! [button_text] content_to_hide
 *
 * Examples:
 * >! [Show Answer] The answer is 42
 * >! [Solution] Queen takes rook, checkmate in 2 moves
 * >! [Spoiler] This is hidden content
 */
/**
 * Parse spoiler blocks from text
 */
export function parseSpoilerBlocks(text) {
  const spoilerBlocks = [];
  // Regex to match: >! [button_text] content
  // The content continues until the end of the line or paragraph
  const spoilerRegex = />!\s*\[([^\]]+)\]\s*([\s\S]*?)(?=\n|$)/g;
  let match;
  while ((match = spoilerRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const buttonText = match[1].trim();
    const content = match[2].trim();
    spoilerBlocks.push({
      buttonText,
      content,
      fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }
  return spoilerBlocks;
}
/**
 * Convert spoiler syntax to custom HTML-like tags that we can handle in markdown rules
 */
export function convertSpoilerSyntax(text) {
  const spoilerBlocks = parseSpoilerBlocks(text);
  let processedText = text;
  if (spoilerBlocks.length > 0) {
    // Process in reverse order to maintain correct indices
    for (let i = spoilerBlocks.length - 1; i >= 0; i--) {
      const block = spoilerBlocks[i];
      // Replace with custom HTML-like syntax
      const replacement = `<spoiler data-button="${block.buttonText}">${block.content}</spoiler>`;
      processedText =
        processedText.slice(0, block.startIndex) +
        replacement +
        processedText.slice(block.endIndex);
    }
  }
  return {
    spoilers: spoilerBlocks,
    processedText,
  };
}
/**
 * Test function to verify spoiler parsing
 */
export function testSpoilerParsing() {
  const testCases = [
    '>! [Show Answer] The answer is 42',
    '>! [Solution] Queen takes rook, checkmate in 2 moves',
    '>! [Spoiler] This is hidden content\nThis is normal text',
    'Normal text >! [Chess Move] Nxe7+ and more text',
    '>! [Testing] do I need this in the snap app?\n> i see people using it sparsely, but they do use it',
  ];
  console.log('=== SPOILER PARSING TESTS ===');
  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}:`);
    console.log('Input:', testCase);
    console.log('Blocks:', parseSpoilerBlocks(testCase));
    console.log('Output:', convertSpoilerSyntax(testCase));
  });
}
