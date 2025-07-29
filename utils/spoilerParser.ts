/**
 * Simple spoiler parser for HiveSnaps
 * Converts ">! [button_text] content" syntax to structured data
 */

export interface SpoilerData {
  buttonText: string;
  content: string;
}

export interface SpoilerParserResult {
  spoilers: SpoilerData[];
  processedText: string;
}

export function convertSpoilerSyntax(text: string): SpoilerParserResult {
  // Match spoiler pattern: >! [button_text] content (multiline support)
  // Updated regex to handle multiline content better
  const spoilerRegex = />!\s*\[([^\]]+)\]\s*((?:(?!>!\s*\[)[\s\S])*?)(?=\n\n|>!\s*\[|$)/g;
  
  const spoilers: SpoilerData[] = [];
  let processedText = text;
  
  // Extract spoilers and remove them from text
  processedText = text.replace(spoilerRegex, (match, buttonText, content) => {
    const trimmedContent = content.trim();
    spoilers.push({
      buttonText: buttonText.trim(),
      content: trimmedContent
    });
    return ''; // Remove spoiler syntax from displayed text
  });
  
  // Clean up extra whitespace
  processedText = processedText.replace(/\n\n+/g, '\n\n').trim();
  
  return {
    spoilers,
    processedText
  };
}
