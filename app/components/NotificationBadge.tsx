import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  textColor?: string;
  visible?: boolean;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  size = 'medium',
  color = '#FF3B30',
  textColor = '#FFFFFF',
  visible = true,
}) => {
  if (!visible || count <= 0) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const sizeStyles = {
    small: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
    },
    medium: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
    },
    large: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 8,
    },
  };

  const textSizes = {
    small: 10,
    medium: 12,
    large: 14,
  };

  return (
    <View style={[styles.badge, sizeStyles[size], { backgroundColor: color }]}>
      <Text
        style={[
          styles.badgeText,
          {
            color: textColor,
            fontSize: textSizes[size],
          },
        ]}
        numberOfLines={1}
      >
        {displayCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
  },
  badgeText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBadge;
