// moved from app/utils/extractYouTubeId.ts

// Utility to extract YouTube video ID from a string
export function extractYouTubeId(text: string): string | null {
  // Regex for YouTube URLs (youtu.be or youtube.com)
  const regex = /(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i;
  const match = text.match(regex);
  return match ? match[1] : null;
}
