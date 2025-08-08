import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Modal from 'react-native-modal';

interface GifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  gifResults: any[];
  loading: boolean;
  colors: {
    background: string;
    text: string;
    border: string;
    icon: string;
  };
}

const GifPickerModal: React.FC<GifPickerModalProps> = ({
  visible,
  onClose,
  onSelectGif,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  gifResults,
  loading,
  colors,
}) => {
  const isDark = useColorScheme() === 'dark';

  const handleSelectGif = (gifUrl: string) => {
    onSelectGif(gifUrl);
    onClose();
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ justifyContent: 'flex-start', margin: 0 }}
      useNativeDriver
    >
      <View
        style={{
          flex: 1,
          marginTop: 60,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: colors.background,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: colors.text,
            }}
          >
            Choose a GIF
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              padding: 4,
            })}
          >
            <FontAwesome name='times' size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View
          style={{
            margin: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 25,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
            }}
          >
            <FontAwesome
              name='search'
              size={16}
              color={colors.text}
              style={{ marginRight: 12 }}
            />
            <TextInput
              placeholder='Search GIFs...'
              placeholderTextColor={colors.text + '80'}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              onSubmitEditing={() => onSearchSubmit(searchQuery)}
              style={{
                flex: 1,
                fontSize: 16,
                color: colors.text,
              }}
              returnKeyType='search'
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  onSearchQueryChange('');
                  onSearchSubmit('');
                }}
                style={{ marginLeft: 8 }}
              >
                <FontAwesome
                  name='times-circle'
                  size={16}
                  color={colors.text + '60'}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* GIF Grid */}
        <View style={{ flex: 1, padding: 16 }}>
          {loading ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size='large' color={colors.icon} />
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  marginTop: 10,
                  color: colors.text,
                }}
              >
                {searchQuery.trim() ? 'Searching GIFs...' : 'Loading...'}
              </Text>
            </View>
          ) : gifResults.length > 0 ? (
            <FlatList
              data={gifResults}
              renderItem={({ item, index }) => {
                const {
                  getBestGifUrl,
                  getGifPreviewUrl,
                } = require('../../utils/tenorApi');
                const gifUrl = getBestGifUrl(item);
                const previewUrl = getGifPreviewUrl(item);

                return (
                  <Pressable
                    onPress={() => handleSelectGif(gifUrl)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        aspectRatio: 1,
                        margin: 4,
                        borderRadius: 8,
                        overflow: 'hidden',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: previewUrl || gifUrl }}
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: isDark ? '#333' : '#f0f0f0',
                      }}
                      resizeMode='cover'
                    />
                  </Pressable>
                );
              }}
              numColumns={2}
              keyExtractor={(item, index) => index.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ justifyContent: 'space-between' }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
              }}
            >
              <FontAwesome name='search' size={48} color={colors.icon} />
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  marginTop: 10,
                  color: colors.text,
                }}
              >
                {searchQuery.trim()
                  ? 'No GIFs found. Try a different search.'
                  : 'Search for GIFs to add to your reply'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default GifPickerModal;
