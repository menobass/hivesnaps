import React, { useMemo } from 'react';
import { View, Dimensions, Image as RNImage } from 'react-native';
import Markdown from 'react-native-markdown-display';
import SafeRenderHtml from '../../components/SafeRenderHtml';
import { defaultHTMLElementModels, HTMLContentModel } from 'react-native-render-html';
import { renderHiveToHtml } from '../../utils/renderHive';
import { extractVideoInfo, removeVideoUrls } from '../../utils/extractVideoInfo';
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
  } & Record<string, any>;
}

const PostBody: React.FC<PostBodyProps> = ({ body, colors, isDark }) => {
  const windowWidth = Dimensions.get('window').width;

  // Extract video information first
  const videoInfo = useMemo(() => extractVideoInfo(body), [body]);

  // Remove video URLs from body to avoid duplication
  const processedBody = useMemo(() => {
    return videoInfo ? removeVideoUrls(body) : body;
  }, [body, videoInfo]);

  // Convert everything to HTML using Ecency's renderPostBody
  const processedHtml = useMemo(() => {
    const html = renderHiveToHtml(processedBody, { breaks: true, proxifyImages: false });
    console.log('====PROCESSED HTML START======');
    console.log('Ecency HTML output:\n', html);
    console.log('====PROCESSED HTML END======');
    return html;
  }, [processedBody]);

  const isHtmlContent = processedHtml && processedHtml.trim().length > 0;

  return (
    <View>
      {/* Render embedded video content first */}
      {videoInfo && (
        <View style={{ marginBottom: 12 }}>
          {videoInfo.type === 'ipfs' ? (
            <IPFSVideoPlayer
              ipfsUrl={videoInfo.embedUrl}
              isDark={isDark}
            />
          ) : videoInfo.type === 'twitter' ? (
            <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === 'youtube' ? (
            <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === '3speak' ? (
            <ThreeSpeakEmbed
              embedUrl={videoInfo.embedUrl}
              isDark={isDark}
            />
          ) : null}
        </View>
      )}

      {/* Render HTML content */}
      {isHtmlContent ? (
        <SafeRenderHtml
          contentWidth={windowWidth - 32}
          source={{ html: processedHtml }}
          baseStyle={{ color: colors.text, fontSize: 16, lineHeight: 24 }}
          enableExperimentalMarginCollapsing={false}
          tagsStyles={{
            a: { color: colors.button },
            p: { marginBottom: 16, lineHeight: 24 },
            br: { 
              height: 16,
              marginVertical: 4,
            },
            div: { marginBottom: 8 },
            h1: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
            h2: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
            h3: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
            h4: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
            h5: { color: colors.text, fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
            h6: { color: colors.text, fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
            u: { textDecorationLine: 'underline' },
            strong: { fontWeight: 'bold' },
            b: { fontWeight: 'bold' },
            em: { fontStyle: 'italic' },
            i: { fontStyle: 'italic' },
            blockquote: {
              backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
              borderLeftColor: colors.button,
              borderLeftWidth: 4,
              paddingLeft: 12,
              paddingVertical: 8,
              marginBottom: 16,
            },
            ul: { marginBottom: 16 },
            ol: { marginBottom: 16 },
            li: { marginBottom: 8 },
            CENTER: { textAlign: 'center', alignSelf: 'center' },
            center: { textAlign: 'center', alignSelf: 'center' },
          }}
          customHTMLElementModels={{
            center: defaultHTMLElementModels.div.extend({ contentModel: HTMLContentModel.block }),
          }}
          renderers={{
            img: ({ TDefaultRenderer, ...props }: any) => {
              const { src, alt } = props.tnode.attributes || {};
              if (!src) return <TDefaultRenderer {...props} />;
              
              return (
                <RNImage
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: '#eee',
                    marginVertical: 8,
                  }}
                  resizeMode='cover'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
          }}
        />
      ) : (
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 16, lineHeight: 24 },
            link: { color: colors.button },
            heading1: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
            heading2: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
            heading3: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
            paragraph: { marginBottom: 12 },
          }}
          rules={{
            image: (node: any) => {
              const { src, alt } = node.attributes || {};
              if (!src) return null;
              return (
                <RNImage
                  key={src}
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: '#eee',
                    marginVertical: 8,
                  }}
                  resizeMode='cover'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
          }}
        >
          {processedBody}
        </Markdown>
      )}
    </View>
  );
};

export default PostBody;


