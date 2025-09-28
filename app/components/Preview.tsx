import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Snap from './Snap';
import { SnapData } from '../../hooks/useConversationData';

interface PreviewProps {
  visible: boolean;
  onClose: () => void;
  snapData: SnapData;
  currentUsername?: string | null;
  colors: {
    background: string;
    text: string;
    inputBorder: string;
  };
}

const Preview: React.FC<PreviewProps> = ({
  visible,
  onClose,
  snapData,
  currentUsername,
  colors,
}) => {
  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.background }
        ]}
      >
        {/* Preview Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.inputBorder }
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerButton}
          >
            <Text style={[styles.headerButtonText, { color: colors.text }]}>
              Close
            </Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Preview
          </Text>

          <View style={styles.headerButton} />
        </View>

        {/* Preview Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Snap
            snap={snapData}
            showAuthor={true}
            onUserPress={() => {}}
            onContentPress={() => {}}
            onImagePress={() => {}}
            onHashtagPress={() => {}}
            currentUsername={currentUsername}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
});

export default Preview;