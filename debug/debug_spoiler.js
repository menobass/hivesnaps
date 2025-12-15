// Quick debug script to test spoiler parsing
const { convertSpoilerSyntax } = require('./utils/spoilerParser');

const testCases = [
  ">! [Push to reveal] the answer is 23",
  ">! [Show Answer] This is the hidden content",
  "Regular text with >! [Hidden] secret content in the middle",
  ">! [First] Content 1\n\nRegular text\n\n>! [Second] Content 2"
];

console.log("=== SPOILER PARSER DEBUG ===");
testCases.forEach((test, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log("Input:", test);
  const result = convertSpoilerSyntax(test);
  console.log("Output:", result);
  console.log("---");
});
