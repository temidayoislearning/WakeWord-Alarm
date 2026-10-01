import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  value?: string;
  onChange: (uri?: string) => void;
  colors: any;
};

export function MyVoiceRecorder({ value, onChange, colors }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(value ?? null);
  const [permissionReady, setPermissionReady] = useState(false);

  useEffect(() => {
    void AudioModule.getRecordingPermissionsAsync().then((permission) => setPermissionReady(permission.granted));
  }, []);

  const startRecording = async () => {
    let permission = await AudioModule.getRecordingPermissionsAsync();
    if (!permission.granted) permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access to create a My Voice alarm.');
      return;
    }
    setPermissionReady(true);
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  const stopRecording = async () => {
    await recorder.stop();
    if (recorder.uri) onChange(recorder.uri);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const preview = () => {
    if (!value) return;
    player.seekTo(0);
    player.play();
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={[styles.mic, { backgroundColor: colors.accent }]}><Feather name="mic" size={18} color={colors.primary} /></View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>My Voice</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>Record your own phrase and use it as the alarm.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          testID="record-my-voice"
          onPress={() => void (recorderState.isRecording ? stopRecording() : startRecording())}
          style={[styles.primary, { backgroundColor: recorderState.isRecording ? colors.destructive : colors.primary }]}
        >
          <Feather name={recorderState.isRecording ? 'square' : 'circle'} size={14} color={colors.primaryForeground} />
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{recorderState.isRecording ? 'Stop recording' : value ? 'Re-record' : 'Start recording'}</Text>
        </Pressable>
        {value ? (
          <>
            <Pressable testID="preview-my-voice" onPress={preview} style={[styles.secondary, { borderColor: colors.border }]}>
              <Feather name="play" size={14} color={colors.primary} />
              <Text style={[styles.secondaryText, { color: colors.primary }]}>Preview</Text>
            </Pressable>
            <Pressable accessibilityLabel="Remove recording" onPress={() => onChange(undefined)} style={styles.remove}>
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </Pressable>
          </>
        ) : null}
      </View>
      <Text style={[styles.status, { color: colors.mutedForeground }]}>
        {recorderState.isRecording ? `Recording… ${Math.floor(recorderState.durationMillis / 1000)}s` : value ? 'Recording ready — this alarm can use your voice.' : permissionReady ? 'Microphone ready.' : 'WakeWord will ask for microphone access when you record.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 20, padding: 14, marginTop: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mic: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  primaryText: { fontSize: 12, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  remove: { padding: 9 },
  status: { fontSize: 10, marginTop: 10 },
});
