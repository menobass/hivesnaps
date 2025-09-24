import { makeAuthenticatedRequest } from '../services/AuthenticatedRequest';

/**
 * Determines the MIME type of a file based on its URI/filename extension,
 * and returns the filename as well.
 * Specifically designed for video files but can be extended for other media types.
 * 
 * @param uri - The file URI or filename
 * @returns An object containing the MIME type string (e.g., 'video/mp4') and the filename
 */
export function getMimeTypeFromUri(uri: string): { mimeType: string; filename: string } {
  // Extract the file extension from the URI
  const extension = uri.split('.').pop()?.toLowerCase();

  // Extract the filename from the URI (after last '/')
  const filename = uri.split('/').pop() || uri;

  if (!extension) {
    console.warn('[getMimeTypeFromUri] No file extension found, defaulting to video/mp4');
    return { mimeType: 'video/mp4', filename };
  }

  // Map file extensions to MIME types
  const mimeTypeMap: Record<string, string> = {
    // Video formats
    'mp4': 'video/mp4',
    'm4v': 'video/mp4',
    'mov': 'video/quicktime',
    'qt': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'mts': 'video/mp2t',
    'm2ts': 'video/mp2t',
    'ts': 'video/mp2t',

    // Image formats (for future use)
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'svg': 'image/svg+xml',

    // Audio formats (for future use)
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
  };

  const mimeType = mimeTypeMap[extension];

  if (!mimeType) {
    console.warn(`[getMimeTypeFromUri] Unknown extension: ${extension}, defaulting to video/mp4`);
    return { mimeType: 'video/mp4', filename };
  }

  console.log(`[getMimeTypeFromUri] Mapped .${extension} -> ${mimeType}, filename: ${filename}`);
  return { mimeType, filename };
}

/**
 * Validates if a MIME type is a supported video format
 * @param mimeType - The MIME type to validate
 * @returns true if it's a supported video format
 */
export function isValidVideoMimeType(mimeType: string): boolean {
  const supportedVideoTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
    'video/3gpp2',
    'video/mp2t',
    'video/x-flv'
  ];
  
  return supportedVideoTypes.includes(mimeType);
}

/**
 * Requests a presigned S3 upload URL from the backend for a video file.
 * @param filename The name of the video file (e.g. myvideo.mp4)
 * @param contentType The MIME type (e.g. 'video/mp4')
 * @returns An object containing the presigned URL and the S3 key
 */
export async function getPresignedVideoUrl(
  filename: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const endpointPath = '/videos/presign';
  console.log('[getPresignedVideoUrl] Requesting presigned URL for', filename, contentType);
  const res = await makeAuthenticatedRequest({
    path: endpointPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: { filename, filetype: contentType },
  });
  const data = res.body;
  // Expecting { url: string, key: string }
  console.log('[getPresignedVideoUrl] response data:', data);
  if (!data.url) throw new Error('No presigned URL returned');
  if (!data.key) throw new Error('No key returned from presign endpoint');
  
  return { url: data.url, key: data.key };
}
