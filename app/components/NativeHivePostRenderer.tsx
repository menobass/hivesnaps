/**
 * Native Hive Post Renderer
 * 
 * Uses @snapie/renderer for markdown-to-HTML conversion and react-native-render-html
 * for native rendering. Provides better performance and user authentication support
 * compared to WebView approach.
 * 
 * IMPORTANT: This is ONLY for Hive blog posts, NOT for snaps!
 * Snaps continue to use the native Snap component.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { createHiveRenderer } from '@snapie/renderer';

interface NativeHivePostRendererProps {
    /** Hive post body (markdown) */
    body: string;
    /** Theme colors */
    colors: {
        background: string;
        text: string;
        link: string;
    };
}

/**
 * Renders Hive blog post markdown as native components
 */
const NativeHivePostRenderer: React.FC<NativeHivePostRendererProps> = ({
    body,
    colors,
}) => {
    const { width } = useWindowDimensions();

    // Create renderer with Hive-specific configuration
    const renderer = useMemo(() => {
        return createHiveRenderer({
            ipfsGateway: 'https://ipfs.skatehive.app',
            ipfsFallbackGateways: [
                'https://ipfs.3speak.tv',
                'https://cloudflare-ipfs.com',
                'https://ipfs.io',
            ],
            convertHiveUrls: true,
            internalUrlPrefix: '',
            assetsWidth: width - 32, // Account for padding
        });
    }, [width]);

    // Render markdown to HTML
    const html = useMemo(() => {
        try {
            // The renderer is a function that takes markdown and returns HTML
            return typeof renderer === 'function' ? renderer(body) : '';
        } catch (error) {
            console.error('[NativeHivePostRenderer] Error rendering markdown:', error);
            return `<p style="color: red;">Error rendering post content</p>`;
        }
    }, [body, renderer]);

    // Styles for HTML tags
    const tagsStyles = {
        body: {
            color: colors.text,
            fontSize: 16,
            lineHeight: 24,
        },
        a: {
            color: colors.link,
            textDecorationLine: 'underline' as const,
        },
        p: {
            marginVertical: 8,
        },
        h1: {
            fontSize: 28,
            fontWeight: 'bold' as const,
            marginVertical: 12,
            color: colors.text,
        },
        h2: {
            fontSize: 24,
            fontWeight: 'bold' as const,
            marginVertical: 10,
            color: colors.text,
        },
        h3: {
            fontSize: 20,
            fontWeight: 'bold' as const,
            marginVertical: 8,
            color: colors.text,
        },
        h4: {
            fontSize: 18,
            fontWeight: 'bold' as const,
            marginVertical: 6,
            color: colors.text,
        },
        blockquote: {
            borderLeftWidth: 4,
            borderLeftColor: colors.link,
            paddingLeft: 12,
            marginVertical: 8,
            fontStyle: 'italic' as const,
        },
        code: {
            backgroundColor: colors.background === '#000000' ? '#1a1a1a' : '#f5f5f5',
            padding: 4,
            borderRadius: 4,
            fontFamily: 'monospace',
        },
        pre: {
            backgroundColor: colors.background === '#000000' ? '#1a1a1a' : '#f5f5f5',
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
        },
        img: {
            marginVertical: 8,
        },
        ul: {
            marginVertical: 8,
        },
        ol: {
            marginVertical: 8,
        },
        li: {
            marginVertical: 4,
        },
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
        >
            <RenderHtml
                contentWidth={width}
                source={{ html }}
                tagsStyles={tagsStyles}
                defaultTextProps={{
                    selectable: true,
                }}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
});

export default NativeHivePostRenderer;
