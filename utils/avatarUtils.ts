import { uploadImageSmart } from './imageUploadService';

export interface AvatarSaveResult {
  url: string;
  provider: string;
  cost: number;
}

/**
 * Saves an avatar image remotely and returns the result.
 * @param fileToSave - { uri, name, type }
 * @param username - Hive username
 * @returns { url, provider, cost }
 * @throws Error if save fails
 */
export async function saveAvatarImage(
  fileToSave: { uri: string; name: string; type: string },
  username: string
): Promise<AvatarSaveResult> {
  const uploadResult = await uploadImageSmart(fileToSave, username);
  if (!uploadResult || !uploadResult.url) {
    throw new Error('No upload result or URL');
  }
  return {
    url: uploadResult.url,
    provider: uploadResult.provider,
    cost: uploadResult.cost,
  };
}

/**
 * Fetches the avatar image for a user (just returns the remote URL).
 * @param remoteUrl - The remote avatar URL
 * @returns remoteUrl
 */
export async function fetchAvatarImage(
  _username: string,
  remoteUrl: string
): Promise<string> {
  return remoteUrl;
}
