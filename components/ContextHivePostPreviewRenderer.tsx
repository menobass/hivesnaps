/**
 * Context-aware Hive Post Preview Renderer
 * Works with FlatList and handles constant remounting
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { HivePostPreview } from './HivePostPreview';
import {
  HivePostInfo,
  extractHivePostUrls,
} from '../utils/extractHivePostInfo';
import { useHivePostPreview } from '../context/HivePostPreviewContext';

interface ContextHivePostPreviewRendererProps {
  text: string;
  colors: {
    bubble: string;
    icon: string;
    text: string;
  };
}

export const ContextHivePostPreviewRenderer: React.FC<ContextHivePostPreviewRendererProps> =
  React.memo(
    ({ text, colors }) => {
      const [postPreviews, setPostPreviews] = useState<HivePostInfo[]>([]);
      const [loading, setLoading] = useState(false);
      const { getPostPreviews } = useHivePostPreview();

      useEffect(() => {
        const loadPreviews = async () => {
          const urls = extractHivePostUrls(text);
          if (urls.length === 0) {
            setPostPreviews([]);
            return;
          }

          setLoading(true);
          try {
            const previews = await getPostPreviews(urls);
            setPostPreviews(previews);
          } catch (error) {
            console.error('Error loading post previews:', error);
            setPostPreviews([]);
          } finally {
            setLoading(false);
          }
        };

        loadPreviews();
      }, [text, getPostPreviews]);

      const urls = extractHivePostUrls(text);
      if (urls.length === 0) return null;

      if (loading && postPreviews.length === 0) {
        return (
          <View
            style={{
              marginBottom: 8,
              alignItems: 'center',
              paddingVertical: 8,
              backgroundColor: colors.bubble,
              borderRadius: 8,
            }}
          >
            <ActivityIndicator size='small' color={colors.icon} />
            <Text style={{ color: colors.text, fontSize: 11, marginTop: 2 }}>
              Loading preview...
            </Text>
          </View>
        );
      }

      if (postPreviews.length === 0) return null;

      return (
        <View style={{ marginBottom: 8 }}>
          {postPreviews.map((postInfo, index) => (
            <HivePostPreview
              key={`${postInfo.author}-${postInfo.permlink}-${index}`}
              postInfo={postInfo}
              style={{ marginBottom: index < postPreviews.length - 1 ? 8 : 0 }}
            />
          ))}
        </View>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison function - only re-render if text actually changed
      return prevProps.text === nextProps.text;
    }
  );
