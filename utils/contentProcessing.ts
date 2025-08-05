import { extractImageUrls } from './extractImageUrls';
import {
  extractVideoInfo,
  removeVideoUrls,
  removeTwitterUrls,
  removeEmbedUrls,
} from './extractVideoInfo';
import { extractHivePostUrls } from './extractHivePostInfo';
import { convertSpoilerSyntax } from './spoilerParser';

/**
 * Strips image tags from text content
 */
export const stripImageTags = (text: string): string => {
  return text.replace(/!\[.*?\]\(.*?\)/g, '').replace(/<img.*?>/g, '');
};

/**
 * Preserves paragraph spacing in markdown content
 */
export const preserveParagraphSpacing = (text: string): string => {
  return text.replace(/\n\n/g, '\n&nbsp;\n');
};

/**
 * Linkifies URLs in text content
 */
export const linkifyUrls = (text: string): string => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '[$1]($1)');
};

/**
 * Linkifies mentions (@username) in text content
 */
export const linkifyMentions = (text: string): string => {
  const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
  return text.replace(mentionRegex, '[@$1](https://peakd.com/@$1)');
};

/**
 * Linkifies hashtags (#tag) in text content
 */
export const linkifyHashtags = (text: string): string => {
  const hashtagRegex = /#([a-zA-Z0-9]+)/g;
  return text.replace(hashtagRegex, '[$&](https://peakd.com/trending/$1)');
};

/**
 * Checks if a string contains HTML content
 */
export const containsHtml = (str: string): boolean => {
  const htmlRegex = /<[^>]*>/;
  return htmlRegex.test(str);
};

/**
 * Processes content body by applying all necessary transformations
 */
export const processContent = (body: string) => {
  const videoInfo = extractVideoInfo(body);
  const imageUrls = extractImageUrls(body);
  const hivePostUrls = extractHivePostUrls(body);

  let textBody = body;

  // Remove video and embed URLs if present
  if (videoInfo || hivePostUrls.length > 0) {
    textBody = removeEmbedUrls(textBody);
  }

  // Strip image tags
  textBody = stripImageTags(textBody);

  // Process spoiler syntax
  const spoilerData = convertSpoilerSyntax(textBody);
  textBody = spoilerData.processedText;

  // Apply text transformations
  textBody = preserveParagraphSpacing(textBody);
  textBody = linkifyUrls(textBody);
  textBody = linkifyMentions(textBody);
  textBody = linkifyHashtags(textBody);

  return {
    textBody,
    videoInfo,
    imageUrls,
    hivePostUrls,
    spoilerData,
    isHtml: containsHtml(textBody),
  };
};
