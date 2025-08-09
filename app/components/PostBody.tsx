import React, { useMemo } from 'react';
import { View, Dimensions, Text, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import SafeRenderHtml from '../../components/SafeRenderHtml';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { renderHiveToHtml } from '../../utils/renderHive';
import {
  extractVideoInfo,
  removeVideoUrls,
} from '../../utils/extractVideoInfo';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import TwitterEmbed from './TwitterEmbed';
import YouTubeEmbed from './YouTubeEmbed';
import ThreeSpeakEmbed from './ThreeSpeakEmbed';

interface PostBodyProps {
  body: string;
  isDark: boolean;
  colors: {
    text: string;
    button: string;
    border: string;
  } & Record<string, any>;
}

const PostBody: React.FC<PostBodyProps> = ({ body, colors, isDark }) => {
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;

  // Extract video information from original body
  const videoInfo = useMemo(() => extractVideoInfo(body), [body]);

  // Use Ecency's renderHiveToHtml to process the content
  const processedHtml = useMemo(() => {
    try {
      return renderHiveToHtml(body, { breaks: true, proxifyImages: false });
    } catch (error) {
      console.warn('[PostBody] Error processing HTML:', error);
      return body; // Fallback to original body
    }
  }, [body]);

  // Smart HTML detection - check if original content has HTML tags
  const hasComplexHtml = useMemo(() => {
    return (
      body.includes('<div') ||
      body.includes('<p') ||
      body.includes('<span') ||
      body.includes('<img') ||
      body.includes('<a') ||
      body.includes('<h') ||
      body.includes('<ul') ||
      body.includes('<ol') ||
      body.includes('<li') ||
      body.includes('<br') ||
      body.includes('<hr') ||
      body.includes('<center')
    ); // Add center tag detection
  }, [body]);

  // Use HTML renderer for complex HTML, markdown for simple content
  const isHtml = hasComplexHtml;

  // Content to render - use processed HTML only if we detected HTML AND processing succeeded
  const contentToRender =
    isHtml && processedHtml && processedHtml.trim().length > 0
      ? processedHtml
      : body;

  // If HTML processing failed but we detected HTML, force markdown rendering
  const shouldUseMarkdown =
    !isHtml || !processedHtml || processedHtml.trim().length === 0;

  // Preprocess content for markdown rendering - convert HTML tags to markdown format
  const preprocessForMarkdown = (content: string) => {
    return (
      content
        // Convert HTML tags to markdown equivalents
        .replace(/<u>(.*?)<\/u>/g, '___$1___') // Convert <u> tags to markdown underlines
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**') // Convert <strong> tags to markdown bold
        .replace(/<b>(.*?)<\/b>/g, '**$1**') // Convert <b> tags to markdown bold
        .replace(/<em>(.*?)<\/em>/g, '*$1*') // Convert <em> tags to markdown italic
        .replace(/<i>(.*?)<\/i>/g, '*$1*') // Convert <i> tags to markdown italic
        // Handle line breaks
        .replace(/<br\s*\/?>/g, '\n\n') // Convert <br> tags to double newlines for markdown
        .replace(/<\/p>\s*<p>/g, '\n\n') // Convert paragraph breaks to double newlines
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n') // Convert <p> tags to content with double newlines
        // Handle headers
        .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
        .replace(/<h4>(.*?)<\/h4>/g, '#### $1\n\n')
        .replace(/<h5>(.*?)<\/h5>/g, '##### $1\n\n')
        .replace(/<h6>(.*?)<\/h6>/g, '###### $1\n\n')
        // Handle center tags (just remove them for markdown)
        .replace(/<center>(.*?)<\/center>/gs, '$1')
        // Handle images - convert HTML img tags to markdown format
        .replace(
          /<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/g,
          '![$2]($1)'
        )
        .replace(
          /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/g,
          '![$1]($2)'
        )
        .replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/g, '![]($1)')
        // Convert @usernames to clickable links
        .replace(
          /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
          '$1[**@$2**](profile://$2)'
        )
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with just 2
        .trim()
    );
  };

  console.log('[PostBody] Content type detection:', {
    isHtml,
    hasComplexHtml,
    bodyLength: body.length,
    processedHtmlLength: processedHtml ? processedHtml.length : 0,
    bodyPreview: body.substring(0, 200),
    processedHtmlPreview: processedHtml
      ? processedHtml.substring(0, 200)
      : 'EMPTY',
    contentToRenderPreview: contentToRender
      ? contentToRender.substring(0, 200)
      : 'EMPTY',
    hasMarkdownHeaders: /^#{1,6}\s/.test(body),
    hasMarkdownBold: /\*\*.*\*\*/.test(body),
    hasMarkdownItalic: /\*.*\*/.test(body),
    hasUTags: body.includes('<u>'),
    hasHTMLHeaders:
      body.includes('<h1') || body.includes('<h2') || body.includes('<h3'),
    willUseHtmlRenderer: !shouldUseMarkdown,
    willUseMarkdownRenderer: shouldUseMarkdown,
    htmlProcessingFailed:
      isHtml && (!processedHtml || processedHtml.trim().length === 0),
  });

  // Safety check - ensure we have content to render
  if (!contentToRender || contentToRender.trim().length === 0) {
    console.warn(
      '[PostBody] No content to render, falling back to original body'
    );
    return (
      <View>
        {/* Render embedded video content first */}
        {videoInfo && (
          <View style={{ marginBottom: 12 }}>
            {videoInfo.type === 'ipfs' ? (
              <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === 'twitter' ? (
              <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === 'youtube' ? (
              <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === '3speak' ? (
              <ThreeSpeakEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : null}
          </View>
        )}
        <Markdown
          style={{
            body: {
              color: colors.text,
              fontSize: 16,
              lineHeight: 24,
              fontFamily: 'System',
            },
            paragraph: { marginBottom: 16, color: colors.text },
          }}
          rules={{
            image: (node, children, parent, styles) => {
              const { src, alt } = node.attributes || {};
              if (!src) return null;
              return (
                <ExpoImage
                  key={src}
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                    marginVertical: 8,
                  }}
                  contentFit='cover'
                  transition={0}
                  cachePolicy='memory-disk'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
          }}
        >
          {preprocessForMarkdown(body)}
        </Markdown>
      </View>
    );
  }

  return (
    <View>
      {/* Render embedded video content first */}
      {videoInfo && (
        <View style={{ marginBottom: 12 }}>
          {videoInfo.type === 'ipfs' ? (
            <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === 'twitter' ? (
            <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === 'youtube' ? (
            <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === '3speak' ? (
            <ThreeSpeakEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : null}
        </View>
      )}

      {/* Content */}
      {!shouldUseMarkdown ? (
        <SafeRenderHtml
          contentWidth={windowWidth - 32}
          source={{ html: contentToRender }}
          baseStyle={{
            color: colors.text,
            fontSize: 16,
            lineHeight: 24,
          }}
          tagsStyles={{
            a: { color: colors.button },
            p: { marginBottom: 16, lineHeight: 24 },
            br: { height: 16, marginBottom: 8 },
            div: { marginBottom: 8 },
            center: { textAlign: 'center', marginBottom: 16 },
            h1: {
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              marginBottom: 16,
              marginTop: 16,
              paddingTop: 8,
              paddingBottom: 4,
              lineHeight: 32,
            },
            h2: {
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 12,
              marginTop: 12,
              paddingTop: 6,
              paddingBottom: 3,
              lineHeight: 28,
            },
            h3: {
              color: colors.text,
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 10,
              marginTop: 10,
              paddingTop: 4,
              paddingBottom: 2,
              lineHeight: 26,
            },
            u: { textDecorationLine: 'underline' },
            strong: { fontWeight: 'bold' },
            b: { fontWeight: 'bold' },
            em: { fontStyle: 'italic' },
            i: { fontStyle: 'italic' },
          }}
        />
      ) : (
        <Markdown
          style={{
            body: {
              color: colors.text,
              fontSize: 16,
              lineHeight: 24,
              fontFamily: 'System',
              overflow: 'visible',
            },
            paragraph: {
              marginBottom: 16,
              color: colors.text,
              overflow: 'visible',
            },
            heading1: {
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              lineHeight: 40,
              marginBottom: 16,
              marginTop: 24,
              paddingTop: 12,
              paddingBottom: 8,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            heading2: {
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              lineHeight: 36,
              marginBottom: 12,
              marginTop: 20,
              paddingTop: 12,
              paddingBottom: 6,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            heading3: {
              color: colors.text,
              fontSize: 18,
              fontWeight: 'bold',
              lineHeight: 34,
              marginBottom: 10,
              marginTop: 16,
              paddingTop: 10,
              paddingBottom: 5,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            heading4: {
              color: colors.text,
              fontSize: 16,
              fontWeight: 'bold',
              lineHeight: 32,
              marginBottom: 8,
              marginTop: 12,
              paddingTop: 8,
              paddingBottom: 4,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            heading5: {
              color: colors.text,
              fontSize: 14,
              fontWeight: 'bold',
              lineHeight: 30,
              marginBottom: 6,
              marginTop: 10,
              paddingTop: 6,
              paddingBottom: 3,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            heading6: {
              color: colors.text,
              fontSize: 12,
              fontWeight: 'bold',
              lineHeight: 28,
              marginBottom: 4,
              marginTop: 8,
              paddingTop: 6,
              paddingBottom: 3,
              overflow: 'visible',
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            link: {
              color: colors.button,
              textDecorationLine: 'underline',
            },
            strong: {
              fontWeight: 'bold',
              color: colors.text,
            },
            em: {
              fontStyle: 'italic',
              color: colors.text,
            },
            // Add styling for markdown underlines (___text___)
            underline: {
              textDecorationLine: 'underline',
              color: colors.text,
            },
            u: {
              textDecorationLine: 'underline',
              color: colors.text,
            },
            code_inline: {
              backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
              color: isDark ? '#E74C3C' : '#E74C3C',
              paddingHorizontal: 4,
              paddingVertical: 2,
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 14,
            },
            code_block: {
              backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
              color: isDark ? '#E74C3C' : '#E74C3C',
              padding: 12,
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 14,
              marginVertical: 8,
            },
            blockquote: {
              borderLeftWidth: 4,
              borderLeftColor: colors.button,
              paddingLeft: 16,
              marginVertical: 8,
              backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
              paddingVertical: 8,
              paddingRight: 12,
            },
            list_item: {
              marginBottom: 4,
              color: colors.text,
            },
            bullet_list: {
              marginBottom: 16,
              paddingLeft: 16,
            },
            ordered_list: {
              marginBottom: 16,
              paddingLeft: 16,
            },
            hr: {
              backgroundColor: colors.border,
              height: 1,
              marginVertical: 16,
            },
          }}
          rules={{
            heading1: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 24,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 24,
                      fontWeight: 'bold',
                      lineHeight: 32,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            heading2: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 20,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: 'bold',
                      lineHeight: 28,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            heading3: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 16,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: 'bold',
                      lineHeight: 26,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            image: (node, children, parent, styles) => {
              const { src, alt } = node.attributes || {};
              if (!src) return null;
              return (
                <ExpoImage
                  key={src}
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                    marginVertical: 8,
                  }}
                  contentFit='cover'
                  transition={0}
                  cachePolicy='memory-disk'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
            link: (node, children, parent, styles) => {
              const { href } = node.attributes;

              // Handle profile:// links for mentions
              if (href && href.startsWith('profile://')) {
                const username = href.replace('profile://', '');
                return (
                  <Pressable
                    key={node.key}
                    onPress={() =>
                      router.push(`/ProfileScreen?username=${username}` as any)
                    }
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    accessibilityRole='link'
                    accessibilityLabel={`View @${username}'s profile`}
                  >
                    <Text
                      style={{
                        color: colors.button,
                        fontWeight: 'bold',
                        transform: [{ translateY: 4 }], // hack to move down
                      }}
                    >
                      @{username}
                    </Text>
                  </Pressable>
                );
              }

              // Handle regular links
              return (
                <Pressable
                  key={node.key}
                  onPress={() => Linking.openURL(href)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  accessibilityRole='link'
                  accessibilityLabel={`Open link: ${href}`}
                >
                  <Text
                    style={{
                      color: colors.button,
                      textDecorationLine: 'underline',
                    }}
                  >
                    {children}
                  </Text>
                </Pressable>
              );
            },
          }}
        >
          {preprocessForMarkdown(contentToRender)}
        </Markdown>
      )}
    </View>
  );
};

export default PostBody;
