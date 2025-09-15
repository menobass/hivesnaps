// Tenor API utility for GIF search and retrieval
// Using Tenor API v2 - docs: https://developers.google.com/tenor/guides/endpoints

const TENOR_API_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY;
const TENOR_BASE_URL = 'https://tenor.googleapis.com/v2';

export interface TenorGif {
  id: string;
  title: string;
  content_description: string;
  created: number;
  hasaudio: boolean;
  tags: string[];
  url: string;
  media_formats: {
    gif: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    mediumgif: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    tinygif: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    nanogif: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    mp4: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    loopedmp4: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    tinymp4: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    nanomp4: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    webm: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    tinywebm: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
    webp_transparent: {
      url: string;
      duration: number;
      preview: string;
      dims: [number, number];
      size: number;
    };
  };
}

export interface TenorSearchResponse {
  results: TenorGif[];
  next: string;
}

// Search GIFs by query term
export const searchGifs = async (
  query: string,
  limit: number = 20,
  pos?: string // For pagination
): Promise<TenorSearchResponse> => {
  if (!TENOR_API_KEY) {
    throw new Error('Tenor API key not configured');
  }

  const params = new URLSearchParams({
    key: TENOR_API_KEY,
    q: query,
    limit: limit.toString(),
    media_filter: 'gif,mp4', // Only get formats we can display
    contentfilter: 'low', // Family-friendly content
    client_key: 'hivesnaps_app', // Recommended by Tenor for differentiation
  });

  if (pos) {
    params.append('pos', pos);
  }

  try {
    const response = await fetch(
      `${TENOR_BASE_URL}/search?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `Tenor API error: ${response.status} ${response.statusText}`
      );
    }

    const data: TenorSearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching GIFs:', error);
    throw error;
  }
};

// Get trending GIFs (for default/empty search)
export const getTrendingGifs = async (
  limit: number = 20
): Promise<TenorSearchResponse> => {
  if (!TENOR_API_KEY) {
    throw new Error('Tenor API key not configured');
  }

  const params = new URLSearchParams({
    key: TENOR_API_KEY,
    limit: limit.toString(),
    media_filter: 'gif,mp4',
    contentfilter: 'low',
    client_key: 'hivesnaps_app', // Recommended by Tenor for differentiation
  });

  try {
    const response = await fetch(
      `${TENOR_BASE_URL}/featured?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(
        `Tenor API error: ${response.status} ${response.statusText}`
      );
    }

    const data: TenorSearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting trending GIFs:', error);
    throw error;
  }
};

// Get featured GIF categories
export const getGifCategories = async (): Promise<{
  tags: { searchterm: string; path: string; image: string; name: string }[];
}> => {
  if (!TENOR_API_KEY) {
    throw new Error('Tenor API key not configured');
  }

  const params = new URLSearchParams({
    key: TENOR_API_KEY,
    type: 'featured',
  });

  try {
    const response = await fetch(
      `${TENOR_BASE_URL}/categories?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `Tenor API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching GIF categories:', error);
    throw error;
  }
};

// Utility to get the best GIF format for mobile display
export const getBestGifUrl = (gif: TenorGif): string => {
  // Prefer smaller formats for mobile to save bandwidth
  // Order of preference: nanogif -> tinygif -> mediumgif -> gif
  if (gif.media_formats.nanogif?.url) {
    return gif.media_formats.nanogif.url;
  }
  if (gif.media_formats.tinygif?.url) {
    return gif.media_formats.tinygif.url;
  }
  if (gif.media_formats.mediumgif?.url) {
    return gif.media_formats.mediumgif.url;
  }
  return gif.media_formats.gif?.url || '';
};

// Utility to get preview image URL for thumbnails
export const getGifPreviewUrl = (gif: TenorGif): string => {
  // Use the smallest format's preview for grid thumbnails
  return (
    gif.media_formats.nanogif?.preview ||
    gif.media_formats.tinygif?.preview ||
    gif.media_formats.gif?.preview ||
    ''
  );
};
