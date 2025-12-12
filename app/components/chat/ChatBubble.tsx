/**
 * ChatBubble - Floating draggable chat bubble
 * Shows unread count and opens chat when tapped
 * Can be dragged around the screen, positioned above the FAB by default
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

const BUBBLE_SIZE = 52;
const BADGE_SIZE = 20;
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

// Spacing from edges and other elements
const EDGE_PADDING = 16;
const FAB_SIZE = 56;
const FAB_BOTTOM_OFFSET = 24; // From FeedScreen FAB positioning
const GAP_ABOVE_FAB = 12;

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

  // Calculate initial position (above the FAB)
  const initialX = screenWidth - EDGE_PADDING - BUBBLE_SIZE;
  const initialY = screenHeight - insets.bottom - FAB_BOTTOM_OFFSET - FAB_SIZE - GAP_ABOVE_FAB - BUBBLE_SIZE;

  // Animated values for position
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(1);

  // Context for gesture (stores offset during drag)
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Bounds for keeping bubble on screen
  const minX = EDGE_PADDING;
  const maxX = screenWidth - EDGE_PADDING - BUBBLE_SIZE;
  const minY = insets.top + EDGE_PADDING;
  const maxY = screenHeight - insets.bottom - EDGE_PADDING - BUBBLE_SIZE;

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

  // Colors based on theme
  const colors = {
    bubble: isDark ? '#1DA1F2' : '#1DA1F2',
    bubbleShadow: isDark ? '#000' : '#1DA1F2',
    icon: '#FFFFFF',
    badge: '#FF3B30',
    badgeText: '#FFFFFF',
  };

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
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.icon} />
          
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

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default ChatBubble;
