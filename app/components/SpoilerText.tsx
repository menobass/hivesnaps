import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

interface SpoilerTextProps {
  buttonText: string;
  children: React.ReactNode;
}

const SpoilerText: React.FC<SpoilerTextProps> = ({ buttonText, children }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={{ marginVertical: 10 }}>
      <TouchableOpacity
        onPress={() => setIsRevealed(!isRevealed)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#333' : '#f0f0f0',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isDark ? '#555' : '#ddd',
        }}
      >
        <FontAwesome6
          name={isRevealed ? 'eye-slash' : 'eye'}
          size={16}
          color={isDark ? '#fff' : '#666'}
          style={{ marginRight: 8 }}
        />
        <Text style={{ color: isDark ? '#fff' : '#333', fontWeight: '500' }}>
          {buttonText}
        </Text>
      </TouchableOpacity>
      
      {isRevealed && (
        <View style={{
          marginTop: 8,
          padding: 12,
          backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
          borderRadius: 8,
          borderLeftWidth: 3,
          borderLeftColor: isDark ? '#4a90e2' : '#007AFF',
        }}>
          <Text style={{ color: isDark ? '#fff' : '#333' }}>
            {children}
          </Text>
        </View>
      )}
    </View>
  );
};

export default SpoilerText;