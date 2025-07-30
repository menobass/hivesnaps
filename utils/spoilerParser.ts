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
  // Regex breakdown:
  // - >!\s*: Matches the spoiler syntax prefix ">!" followed by optional whitespace.
  // - \[([^\]]+)\]: Captures the button text inside square brackets. [^\]]+ matches one or more characters that are not "]".
  // - \s*: Matches optional whitespace after the button text.
  // - ((?:(?!>!\s*\[)[\s\S])*?): Captures the spoiler content. 
  //     - [\s\S] matches any character, including newlines (multiline support).
  //     - (?!>!\s*\[) ensures that the content does not include another spoiler start sequence.
  //     - The non-greedy quantifier *? ensures minimal matching up to the next spoiler or end of content.
  // - (?=\n\n|>!\s*\[|$): A lookahead assertion that ensures the match ends at:
  //     - A double newline (\n\n), indicating a paragraph break.
  //     - Another spoiler start sequence (>! [).
  //     - The end of the string ($).
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
