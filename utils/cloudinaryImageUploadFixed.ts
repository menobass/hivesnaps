// Cloudinary upload utility for React Native Expo
// Usage: const url = await uploadImageToCloudinaryFixed({ uri, name, type });

// Replace with your Cloudinary details:
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dx570veug/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'unsigned-preset';

export interface CloudinaryUploadFile {
  uri: string;
  name: string;
  type: string;
}

export async function uploadImageToCloudinaryFixed(
  file: CloudinaryUploadFile
): Promise<string> {
  const data = new FormData();
  data.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
  data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_URL, {
    method: 'POST',
    body: data,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Cloudinary upload failed: ' + errText);
  }
  const json = await res.json();
  if (!json.secure_url)
    throw new Error('No secure_url returned from Cloudinary');
  return json.secure_url;
}
