/**
 * Optimized Hive Post Preview Renderer with caching and performance optimizations
 * Designed to handle frequent re-renders in FeedScreen
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { HivePostPreview } from './HivePostPreview';
import { 
  HivePostInfo, 
  fetchMultipleHivePostInfos, 
  parseHivePostUrl 
} from '../utils/extractHivePostInfo';
import { hivePostPreviewCache } from '../utils/hivePostPreviewCache';

interface OptimizedHivePostPreviewRendererProps {
  postUrls: string[];
  colors: {
    bubble: string;
    icon: string;
    text: string;
  };
  onError?: (error: string) => void;
}

export const OptimizedHivePostPreviewRenderer: React.FC<OptimizedHivePostPreviewRendererProps> = React.memo(({ 
  postUrls, 
  colors,
  onError 
}) => {
  const [postPreviews, setPostPreviews] = useState<HivePostInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const lastUrlsRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchPreviews = useCallback(async (urls: string[]) => {
    if (urls.length === 0) {
      if (isMountedRef.current) {
        setPostPreviews([]);
        setLoading(false);
      }
      return;
    }

    // Check cache first
    const cachedResults: HivePostInfo[] = [];
    const urlsToFetch: string[] = [];

    for (const url of urls) {
      const cached = hivePostPreviewCache.getCachedPostInfo(url);
      if (cached) {
        cachedResults.push(cached);
      } else if (!hivePostPreviewCache.isLoading(url)) {
        urlsToFetch.push(url);
      }
    }

    // If we have all results cached, use them immediately
    if (cachedResults.length === urls.length) {
      if (isMountedRef.current) {
        setPostPreviews(cachedResults);
        setLoading(false);
      }
      return;
    }

    // If some URLs are already loading, wait for them
    const loadingPromises = urls
      .map(url => hivePostPreviewCache.getLoadingPromise(url))
      .filter(Boolean) as Promise<HivePostInfo | null>[];

    if (loadingPromises.length > 0) {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      try {
        await Promise.all(loadingPromises);
        
        // Recheck cache after loading promises complete
        const allCachedResults = urls
          .map(url => hivePostPreviewCache.getCachedPostInfo(url))
          .filter(Boolean) as HivePostInfo[];
        
        if (isMountedRef.current) {
          setPostPreviews(allCachedResults);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error waiting for loading promises:', error);
        if (isMountedRef.current) {
          setLoading(false);
          onError?.('Failed to load some post previews');
        }
      }
      return;
    }

    // Fetch new URLs
    if (urlsToFetch.length > 0) {
      if (isMountedRef.current) {
        setLoading(true);
      }

      try {
        const fetchPromise = fetchMultipleHivePostInfos(urlsToFetch);
        
        // Mark URLs as loading in cache
        urlsToFetch.forEach(url => {
          const parsed = parseHivePostUrl(url);
          if (parsed) {
            hivePostPreviewCache.setLoading(url, 
              fetchPromise.then(results => 
                results.find(r => r.author === parsed.author && r.permlink === parsed.permlink) || null
              )
            );
          }
        });

        const newResults = await fetchPromise;
        
        // Cache the results
        urlsToFetch.forEach(url => {
          const parsed = parseHivePostUrl(url);
          if (parsed) {
            const result = newResults.find(r => 
              r.author === parsed.author && r.permlink === parsed.permlink
            );
            hivePostPreviewCache.setCachedPostInfo(url, result || null);
          }
        });

        if (isMountedRef.current) {
          // Combine cached and new results in the original order
          const allResults = urls
            .map(url => {
              const cached = hivePostPreviewCache.getCachedPostInfo(url);
              return cached;
            })
            .filter(Boolean) as HivePostInfo[];

          setPostPreviews(allResults);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching Hive post previews:', error);
        
        // Cache the error state
        urlsToFetch.forEach(url => {
          hivePostPreviewCache.setCachedPostInfo(url, null, error instanceof Error ? error.message : 'Unknown error');
        });

        if (isMountedRef.current) {
          setLoading(false);
          onError?.(error instanceof Error ? error.message : 'Failed to load post previews');
        }
      }
    } else if (cachedResults.length > 0) {
      // We have some cached results, use them
      if (isMountedRef.current) {
        setPostPreviews(cachedResults);
        setLoading(false);
      }
    }
  }, [onError]);

  useEffect(() => {
    // Only fetch if URLs actually changed
    const urlsString = postUrls.sort().join(',');
    if (urlsString === lastUrlsRef.current) {
      return;
    }
    
    lastUrlsRef.current = urlsString;
    isMountedRef.current = true;
    
    fetchPreviews(postUrls);
  }, [postUrls, fetchPreviews]);

  if (postUrls.length === 0) return null;

  if (loading && postPreviews.length === 0) {
    return (
      <View style={{ 
        marginBottom: 8, 
        alignItems: 'center', 
        paddingVertical: 12,
        backgroundColor: colors.bubble,
        borderRadius: 8,
      }}>
        <ActivityIndicator size="small" color={colors.icon} />
        <Text style={{ 
          color: colors.text, 
          fontSize: 12, 
          marginTop: 4 
        }}>
          Loading post preview...
        </Text>
      </View>
    );
  }

  if (postPreviews.length === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      {postPreviews.map((postInfo, index) => (
        <HivePostPreview 
          key={`${postInfo.author}-${postInfo.permlink}`} 
          postInfo={postInfo}
          style={{ marginBottom: index < postPreviews.length - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if URLs actually changed
  const prevUrls = prevProps.postUrls.sort().join(',');
  const nextUrls = nextProps.postUrls.sort().join(',');
  return prevUrls === nextUrls;
});

OptimizedHivePostPreviewRenderer.displayName = 'OptimizedHivePostPreviewRenderer';
