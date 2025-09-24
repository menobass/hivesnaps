import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { makeAuthenticatedRequest } from '../services/AuthenticatedRequest';

export interface VideoUploadResult {
    url: string;
    key?: string;
}

export interface UseVideoUpload {
    uploadVideoToBackend: (videoUri: string, presignedUrl: string, contentType: string) => Promise<VideoUploadResult>;
    error: string | null;
    notifyUploadSuccess: (key: string) => Promise<string>;
}

/**
 * useVideoUpload - Custom hook for uploading videos to backend (e.g., S3 via presigned URL)
 *
 * Usage:
 *   const { uploadVideoToBackend, uploading, error } = useVideoUpload();
 *   const result = await uploadVideoToBackend(videoUri, presignedUrl);
 */
export function useVideoUpload(): UseVideoUpload {
    const [error, setError] = useState<string | null>(null);

    // Uploads a video file to a presigned S3 URL using fetch and Blob
    const uploadVideoToBackend = async (
        videoUri: string,
        presignedUrl: string,
        contentType: string
    ): Promise<VideoUploadResult> => {
        console.log('[uploadVideoToBackend] Uploading video to presigned URL:', presignedUrl);
        console.log('[uploadVideoToBackend] Video URI:', videoUri, 'Content-Type:', contentType);
        setError(null);
        try {
            // Fetch the file data from the local URI
            const fileResponse = await fetch(videoUri);
            if (!fileResponse.ok) {
                throw new Error('Failed to read video file');
            }

            // Get the file data as a blob
            const blob = await fileResponse.blob();

            // Upload using fetch
            const response = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                },
                body: blob,
            });

            console.log('[uploadVideoToBackend] Upload response status:', response);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('S3 error body:', errorText);
                throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
            }

            // The presignedUrl is the upload endpoint, but the public URL may differ
            // You may need to construct the public URL based on your backend/S3 config
            return { url: presignedUrl.split('?')[0] };
        } catch (err: any) {
            setError(err.message || 'Video upload failed');
            Alert.alert('Upload Failed', err.message || 'Video upload failed');
            throw err;
        }
    };

    // Notifies backend that upload succeeded and retrieves the final video URL
    const notifyUploadSuccess = async (key: string): Promise<string> => {
        try {
            const response = await makeAuthenticatedRequest({
                path: '/videos/upload/success',
                method: 'POST',
                body: { key },
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('[notifyUploadSuccess] Backend response:', response);
            if (!response.body || !response.body.url) {
                throw new Error('No URL returned from backend');
            }
            return response.body.url;
        } catch (err: any) {
            setError(err.message || 'Failed to notify backend of upload success');
            Alert.alert('Notification Failed', err.message || 'Failed to notify backend');
            throw err;
        }
    };

    return { uploadVideoToBackend, notifyUploadSuccess, error };
}
