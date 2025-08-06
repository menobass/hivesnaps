import React from 'react';
import { Text, Pressable, PressableProps } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface SmallButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  /** The label text to display (e.g., "VP:", "RC:") */
  label: string;
  /** The value to display (e.g., "85.2", "92.1") */
  value: string | number;
  /** The unit to display after the value (e.g., "%") */
  unit?: string;
  /** Whether to show the question mark icon */
  showIcon?: boolean;
  /** Icon name from FontAwesome */
  iconName?: string;
  /** Icon size */
  iconSize?: number;
  /** Colors object for theming */
  colors: {
    button: string;
    buttonInactive: string;
  };
  /** Custom style for the button container */
  buttonStyle?: any;
  /** Custom style for the text */
  textStyle?: any;
  /** Custom style for the icon */
  iconStyle?: any;
}

const SmallButton: React.FC<SmallButtonProps> = ({
  label,
  value,
  unit = '',
  showIcon = true,
  iconName = 'question-circle',
  iconSize = 14,
  colors,
  buttonStyle,
  textStyle,
  iconStyle,
  ...pressableProps
}) => {
  const baseButtonStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  };

  const baseTextStyle = {
    color: colors.button,
    fontSize: 12,
    fontWeight: 'bold' as const,
  };

  const baseIconStyle = {
    marginLeft: 4,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        baseButtonStyle,
        {
          backgroundColor: pressed ? colors.buttonInactive : 'transparent',
        },
        buttonStyle,
      ]}
      {...pressableProps}
    >
      <Text style={[baseTextStyle, textStyle]}>
        {label} {value}{unit}
      </Text>
      {showIcon && (
        <FontAwesome
          name={iconName as any}
          size={iconSize}
          color={colors.button}
          style={[baseIconStyle, iconStyle]}
        />
      )}
    </Pressable>
  );
};

export default SmallButton;
