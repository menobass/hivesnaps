/**
 * ChatBubble - Floating draggable chat bubble
 * Shows unread count and opens chat when tapped
 * Can be dragged around the screen, positioned above the FAB by default
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  createChatBubbleStyles,
  getChatColors,
  CHAT_BUBBLE_SIZE,
  CHAT_EDGE_PADDING,
  CHAT_FAB_SIZE,
  CHAT_FAB_BOTTOM_OFFSET,
  CHAT_GAP_ABOVE_FAB,
} from '../../../styles/ChatStyles';

// ============================================================================
// Types
// ============================================================================

interface ChatBubbleProps {
  /** Total unread message count */
  unreadCount: number;
  /** Callback when bubble is tapped */
  onPress: () => void;
  /** Whether the user is logged in (bubble hidden if not) */
  isLoggedIn: boolean;
  /** Whether chat is currently open (bubble hidden if so) */
  isChatOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

// ============================================================================
// Component
// ============================================================================

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  unreadCount,
  onPress,
  isLoggedIn,
  isChatOpen = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Memoize styles and colors
  const styles = useMemo(() => createChatBubbleStyles(), []);
  const colors = useMemo(() => getChatColors(isDark), [isDark]);

  // Calculate initial position (above the FAB)
  const initialX = screenWidth - CHAT_EDGE_PADDING - CHAT_BUBBLE_SIZE;
  const initialY = screenHeight - insets.bottom - CHAT_FAB_BOTTOM_OFFSET - CHAT_FAB_SIZE - CHAT_GAP_ABOVE_FAB - CHAT_BUBBLE_SIZE;

  // Animated values for position
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(1);

  // Context for gesture (stores offset during drag)
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Bounds for keeping bubble on screen
  const minX = CHAT_EDGE_PADDING;
  const maxX = screenWidth - CHAT_EDGE_PADDING - CHAT_BUBBLE_SIZE;
  const minY = insets.top + CHAT_EDGE_PADDING;
  const maxY = screenHeight - insets.bottom - CHAT_EDGE_PADDING - CHAT_BUBBLE_SIZE;

  // Snap to nearest edge when drag ends
  const snapToEdge = useCallback(() => {
    'worklet';
    const currentX = translateX.value;
    const midpoint = screenWidth / 2;
    
    // Snap to left or right edge
    const targetX = currentX < midpoint ? minX : maxX;
    translateX.value = withSpring(targetX, SPRING_CONFIG);
  }, [screenWidth, minX, maxX]);

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      scale.value = withSpring(1.1, SPRING_CONFIG);
    })
    .onUpdate((event) => {
      // Calculate new position with bounds checking
      let newX = contextX.value + event.translationX;
      let newY = contextY.value + event.translationY;

      // Clamp to screen bounds
      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));

      translateX.value = newX;
      translateY.value = newY;
    })
    .onEnd(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
      snapToEdge();
    });

  // Tap gesture for opening chat
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onPress)();
    });

  // Combine gestures - pan takes precedence but tap still works
  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Don't render if not logged in or chat is open
  if (!isLoggedIn || isChatOpen) {
    return null;
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.bubble,
              shadowColor: colors.bubbleShadow,
            },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.bubbleIcon} />
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.badge }]}>
              <Text style={[styles.badgeText, { color: colors.badgeText }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default ChatBubble;
