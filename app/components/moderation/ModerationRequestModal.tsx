import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAppColors, type AppColors } from '../../styles/colors';

export type ModerationReason = 'violence' | 'harmful' | 'scam' | 'spam' | 'other';

export interface ModerationRequestPayload {
  reason: ModerationReason;
  details?: string;
}

interface ModerationRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: ModerationRequestPayload) => void;
  colors?: AppColors;
  title?: string;
}

//

const REASONS: { key: ModerationReason; label: string }[] = [
  { key: 'violence', label: 'Content incites violence' },
  { key: 'harmful', label: 'Harmful Content' },
  { key: 'scam', label: 'Scam / Impersonation' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Other' },
];

const ModerationRequestModal: React.FC<ModerationRequestModalProps> = ({
  visible,
  onClose,
  onSubmit,
  colors,
  title = 'Request for Moderation',
}) => {
  const appColors = useAppColors();
  const palette = colors || appColors;
  const [selectedReason, setSelectedReason] = useState<ModerationReason | null>(null);
  const [otherDetails, setOtherDetails] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset state whenever the modal opens
      setSelectedReason(null);
      setOtherDetails('');
    }
  }, [visible]);

  const canSubmit = useMemo(() => {
    if (!selectedReason) return false;
    if (selectedReason === 'other') return otherDetails.trim().length > 0;
    return true;
  }, [selectedReason, otherDetails]);

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit({
      reason: selectedReason,
      details: selectedReason === 'other' ? otherDetails.trim() : undefined,
    });
  };

  const { width } = Dimensions.get('window');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.card, { backgroundColor: palette.bubble, borderColor: palette.border, width: width * 0.92 }]}> 
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingVertical: 6 }}>
            {REASONS.map(item => {
              const selected = selectedReason === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.reasonRow}
                  onPress={() => setSelectedReason(item.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <FontAwesome name={selected ? 'dot-circle-o' : 'circle-o'} size={18} color={selected ? palette.icon : palette.text} />
                  <Text style={[styles.reasonText, { color: palette.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
            {selectedReason === 'other' && (
              <View style={{ marginTop: 8 }}>
                <TextInput
                  style={[styles.otherInput, { color: palette.text, borderColor: palette.border }]}
                  placeholder="Please explain in detail."
                  placeholderTextColor={palette.placeholderText}
                  multiline
                  numberOfLines={4}
                  value={otherDetails}
                  onChangeText={setOtherDetails}
                />
              </View>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: palette.border }]} accessibilityRole="button" accessibilityLabel="Cancel moderation request">
              <Text style={[styles.cancelText, { color: palette.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit} style={[styles.submitBtn, { backgroundColor: canSubmit ? palette.icon : '#94a3b8' }]} accessibilityRole="button" accessibilityLabel="Submit moderation request">
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  reasonText: {
    marginLeft: 10,
    fontSize: 15,
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
  },
  cancelText: {
    fontSize: 15,
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default ModerationRequestModal;
