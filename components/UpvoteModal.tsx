import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Modal from 'react-native-modal';

interface UpvoteModalProps {
  visible: boolean;
  voteWeight: number;
  voteValue: { hbd: string; usd: string } | null;
  voteWeightLoading: boolean;
  upvoteLoading: boolean;
  upvoteSuccess: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onVoteWeightChange: (weight: number) => void;
  colors: {
    background: string;
    text: string;
    button: string;
    buttonText: string;
    buttonInactive: string;
    icon: string;
  };
}

const UpvoteModal: React.FC<UpvoteModalProps> = ({
  visible,
  voteWeight,
  voteValue,
  voteWeightLoading,
  upvoteLoading,
  upvoteSuccess,
  onClose,
  onConfirm,
  onVoteWeightChange,
  colors,
}) => {
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ justifyContent: 'center', alignItems: 'center', margin: 0 }}
      useNativeDriver
    >
      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: 16,
          padding: 24,
          width: '85%',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 12,
          }}
        >
          Upvote Snap
        </Text>
        <Text style={{ color: colors.text, fontSize: 15, marginBottom: 16 }}>
          Vote Weight: {voteWeight}%
        </Text>

        {voteWeightLoading ? (
          <ActivityIndicator
            size='small'
            color={colors.button}
            style={{ marginVertical: 16 }}
          />
        ) : (
          <>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={voteWeight}
              onValueChange={onVoteWeightChange}
              minimumTrackTintColor={colors.button}
              maximumTrackTintColor={colors.buttonInactive}
              thumbTintColor={colors.button}
            />
            {voteValue !== null && (
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginTop: 12,
                }}
              >
                ${voteValue.usd} USD
              </Text>
            )}
          </>
        )}

        {upvoteLoading ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <FontAwesome name='hourglass-half' size={32} color={colors.icon} />
            <Text style={{ color: colors.text, marginTop: 8 }}>
              Submitting vote...
            </Text>
          </View>
        ) : upvoteSuccess ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <FontAwesome name='check-circle' size={32} color={colors.button} />
            <Text style={{ color: colors.text, marginTop: 8 }}>
              Upvote successful!
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', marginTop: 24 }}>
            <Pressable
              style={{
                flex: 1,
                marginRight: 8,
                backgroundColor: colors.buttonInactive,
                borderRadius: 8,
                padding: 12,
                alignItems: 'center',
              }}
              onPress={onClose}
              disabled={upvoteLoading}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                marginLeft: 8,
                backgroundColor: colors.button,
                borderRadius: 8,
                padding: 12,
                alignItems: 'center',
              }}
              onPress={onConfirm}
              disabled={upvoteLoading}
            >
              <Text style={{ color: colors.buttonText, fontWeight: '600' }}>
                Confirm
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default UpvoteModal;
