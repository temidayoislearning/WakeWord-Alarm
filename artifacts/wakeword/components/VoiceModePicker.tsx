import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VOICE_MODES, VoiceModeId, speakWithVoiceMode } from '@/lib/voiceModes';

type Props = {
  value: VoiceModeId;
  onChange: (value: VoiceModeId) => void;
  phrase: string;
  colors: any;
};

const ICONS: Record<VoiceModeId, keyof typeof Feather.glyphMap> = {
  gentle: 'wind', focused: 'target', energized: 'zap', urgent: 'alert-circle', deep: 'volume-1',
  coach: 'award', drill: 'activity', cheerful: 'sun', calm: 'cloud', robotic: 'cpu',
};

export function VoiceModePicker({ value, onChange, phrase, colors }: Props) {
  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Voice personality</Text>
        <Pressable
          accessibilityLabel="Preview chosen voice"
          onPress={() => void speakWithVoiceMode(phrase.trim() || 'Good morning. It is time to wake up.', value)}
          style={styles.preview}
        >
          <Feather name="play" size={13} color={colors.primary} />
          <Text style={[styles.previewText, { color: colors.primary }]}>Preview</Text>
        </Pressable>
      </View>
      <Text style={[styles.help, { color: colors.mutedForeground }]}>Pick the energy WakeWord should use when it keeps calling you up.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {VOICE_MODES.map((mode) => {
          const selected = value === mode.id;
          return (
            <Pressable
              key={mode.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`voice-${mode.id}`}
              onPress={() => {
                onChange(mode.id);
                void Haptics.selectionAsync().catch(() => undefined);
              }}
              style={[
                styles.card,
                { backgroundColor: selected ? colors.accent : colors.card, borderColor: selected ? colors.primary : colors.border },
              ]}
            >
              <View style={styles.cardTop}>
                <Feather name={ICONS[mode.id]} size={18} color={selected ? colors.primary : colors.mutedForeground} />
                {selected ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
              </View>
              <Text style={[styles.name, { color: colors.foreground }]}>{mode.label}</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{mode.detail}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700' },
  help: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 8 },
  previewText: { fontSize: 12, fontWeight: '700' },
  row: { gap: 10, paddingRight: 16 },
  card: { width: 132, minHeight: 108, borderWidth: 1, borderRadius: 18, padding: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  name: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 15, marginTop: 4 },
});
