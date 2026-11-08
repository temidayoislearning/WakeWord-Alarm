import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VOICE_MODES, VoiceModeId, speakWithVoiceMode } from '@/lib/voiceModes';
import { getAccentVoices } from '@/modules/wakeword-alarms/src/WakeWordAlarms';

type Props = {
  value: VoiceModeId;
  onChange: (value: VoiceModeId) => void;
  voiceId?: string;
  onVoiceChange: (id?: string) => void;
  phrase: string;
  colors: any;
};
type VoiceChoice = { id: string; language: string; requiresNetwork?: boolean };

const ICONS: Record<VoiceModeId, keyof typeof Feather.glyphMap> = {
  gentle: 'wind', focused: 'target', energized: 'zap', urgent: 'alert-circle', deep: 'volume-1',
  coach: 'award', drill: 'activity', cheerful: 'sun', calm: 'cloud', robotic: 'cpu',
};

function accentName(language: string) {
  const tag = language.replace(/_/g, '-').toLowerCase();
  const regions: Record<string, string> = {
    'en-gb': 'British', 'en-us': 'American', 'en-ng': 'Nigerian', 'en-ke': 'Kenyan',
    'en-za': 'South African', 'en-gh': 'Ghanaian', 'en-au': 'Australian',
    'en-in': 'Indian', 'en-ca': 'Canadian', 'en-ie': 'Irish', 'en-nz': 'New Zealand',
    'en-tz': 'Tanzanian', 'en-ug': 'Ugandan', 'en-ph': 'Filipino',
  };
  return regions[tag] || (tag === 'en' ? 'English' : `English · ${language}`);
}

export function VoiceModePicker({ value, onChange, voiceId, onVoiceChange, phrase, colors }: Props) {
  const [voices, setVoices] = useState<VoiceChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [activeAccent, setActiveAccent] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState<'all' | 'offline' | 'online'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const found = Platform.OS === 'android'
        ? await getAccentVoices()
        : (await Speech.getAvailableVoicesAsync())
            .filter((voice) => voice.language.toLowerCase().startsWith('en'))
            .map((voice) => ({ id: voice.identifier, language: voice.language }));
      setVoices(found);
    } catch {
      setVoices([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filteredVoices = useMemo(() => voices.filter((voice) => connectionFilter === 'all' || (connectionFilter === 'online' ? voice.requiresNetwork === true : voice.requiresNetwork === false)), [voices, connectionFilter]);
  const accents = useMemo(() => Array.from(new Set(filteredVoices.map((voice) => voice.language))).sort(), [filteredVoices]);
  const selected = voices.find((voice) => voice.id === voiceId);
  const shownAccent = activeAccent && accents.includes(activeAccent) ? activeAccent : (selected && accents.includes(selected.language) ? selected.language : accents[0]);
  const shownVoices = filteredVoices.filter((voice) => voice.language === shownAccent);
  const selectedIndex = selected ? voices.filter((voice) => voice.language === selected.language).findIndex((voice) => voice.id === selected.id) + 1 : 0;

  const preview = async () => {
    const showError = () => Alert.alert('Voice unavailable', selected?.requiresNetwork
      ? 'Check your internet connection or try another voice.'
      : 'Try another voice or check your phone’s text-to-speech settings.');
    try {
      await Speech.stop();
      await speakWithVoiceMode(phrase.trim() || 'Good morning. It is time to wake up.', value, { onError: showError }, selected?.id, selected?.language);
    } catch {
      showError();
    }
  };

  const openVoiceSettings = async () => {
    if (Platform.OS === 'android') {
      try { await Linking.sendIntent('com.android.settings.TTS_SETTINGS'); return; } catch {}
    }
    await Linking.openSettings();
  };

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Choose your voice</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Preview chosen voice" onPress={() => void preview()} style={[styles.preview, { backgroundColor: colors.accent }]}>
          <Feather name="play" size={14} color={colors.primary} />
          <Text style={[styles.previewText, { color: colors.primary }]}>Listen</Text>
        </Pressable>
      </View>
      <Text style={[styles.help, { color: colors.mutedForeground }]}>Choose an accent, then set the energy of your alarm.</Text>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}
        style={[styles.accentButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="globe" size={18} color={colors.primary} /></View>
        <View style={styles.accentCopy}>
          <Text style={[styles.accentLabel, { color: colors.foreground }]}>Accent & voice</Text>
          <Text style={[styles.accentDetail, { color: colors.mutedForeground }]}>
            {loading ? 'Finding your voices…' : selected ? `${accentName(selected.language)} · Voice ${selectedIndex} · ${selected.requiresNetwork ? 'Online' : selected.requiresNetwork === false ? 'Offline' : 'Device voice'}` : voiceId ? 'Saved voice unavailable · using default' : 'US English default'}
          </Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.mutedForeground} />
      </Pressable>

      {expanded ? (
        <View style={[styles.accentPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>Available accents</Text>
          <Text style={[styles.panelHelp, { color: colors.mutedForeground }]}>
            {Platform.OS === 'android' ? 'Online voices need internet. If speech fails, your alarm uses a fallback tone.' : 'Voices available on your device.'}
          </Text>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: !voiceId }} onPress={() => onVoiceChange(undefined)}
            style={[styles.voiceRow, { borderColor: colors.border }]}>
            <Text style={[styles.voiceName, { color: colors.foreground }]}>US English default</Text>
            {!voiceId ? <Feather name="check-circle" size={18} color={colors.primary} /> : null}
          </Pressable>
          {Platform.OS === 'android' && voices.length ? (
            <View style={styles.filters} accessibilityLabel="Filter by connection">
              {(['all', 'offline', 'online'] as const).map((filter) => (
                <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: connectionFilter === filter }}
                  onPress={() => { setConnectionFilter(filter); setActiveAccent(null); setShowAll(false); }}
                  style={[styles.filterChip, { backgroundColor: connectionFilter === filter ? colors.accent : colors.secondary, borderColor: connectionFilter === filter ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{filter === 'all' ? 'All' : filter === 'online' ? 'Online' : 'Offline'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {accents.length ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accentChips}>
                {accents.map((accent) => (
                  <Pressable key={accent} accessibilityRole="button" onPress={() => { setActiveAccent(accent); setShowAll(false); }}
                    style={[styles.chip, { backgroundColor: shownAccent === accent ? colors.accent : colors.secondary, borderColor: shownAccent === accent ? colors.primary : colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{accentName(accent)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {shownVoices.slice(0, showAll ? undefined : 6).map((voice) => (
                <Pressable key={voice.id} accessibilityRole="radio" accessibilityState={{ selected: voiceId === voice.id }}
                  onPress={() => { onVoiceChange(voice.id); void Haptics.selectionAsync().catch(() => undefined); }}
                  style={[styles.voiceRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingVertical: 7 }}>
                    <Text style={[styles.voiceName, { color: colors.foreground }]}>{accentName(voice.language)} · Voice {voices.filter((item) => item.language === voice.language).findIndex((item) => item.id === voice.id) + 1}</Text>
                    <Text style={[styles.voiceConnection, { color: colors.mutedForeground }]}>{voice.requiresNetwork === true ? 'Online · internet required' : voice.requiresNetwork === false ? 'Offline' : 'Device voice'}</Text>
                  </View>
                  {voiceId === voice.id ? <Feather name="check-circle" size={18} color={colors.primary} /> : <Feather name="circle" size={18} color={colors.mutedForeground} />}
                </Pressable>
              ))}
              {shownVoices.length > 6 ? (
                <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)} style={{ paddingVertical: 10 }}>
                  <Text style={[styles.actionText, { color: colors.primary }]}>{showAll ? 'Show fewer voices' : `Show all ${shownVoices.length} voices`}</Text>
                </Pressable>
              ) : null}
            </>
          ) : !loading ? <Text style={[styles.panelHelp, { color: colors.mutedForeground }]}>No voices found for this filter. Add voices in your phone’s text-to-speech settings, then refresh.</Text> : null}
          <View style={styles.panelActions}>
            <Pressable accessibilityRole="button" onPress={() => void openVoiceSettings()}><Text style={[styles.actionText, { color: colors.primary }]}>Voice settings</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={[styles.actionText, { color: colors.primary }]}>Refresh voices</Text></Pressable>
          </View>
        </View>
      ) : null}

      <Text style={[styles.energyLabel, { color: colors.foreground }]}>Energy</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {VOICE_MODES.map((mode) => {
          const selectedMode = value === mode.id;
          return (
            <Pressable key={mode.id} accessibilityRole="radio" accessibilityState={{ selected: selectedMode }} testID={`voice-${mode.id}`}
              onPress={() => { onChange(mode.id); void Haptics.selectionAsync().catch(() => undefined); }}
              style={[styles.card, { backgroundColor: selectedMode ? colors.accent : colors.card, borderColor: selectedMode ? colors.primary : colors.border }]}>
              <View style={styles.cardTop}>
                <Feather name={ICONS[mode.id]} size={18} color={selectedMode ? colors.primary : colors.mutedForeground} />
                {selectedMode ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
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
  help: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  previewText: { fontSize: 12, fontWeight: '700' },
  accentButton: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 13, minHeight: 68 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  accentCopy: { flex: 1 },
  accentLabel: { fontSize: 14, fontWeight: '700' },
  accentDetail: { fontSize: 12, marginTop: 3 },
  accentPanel: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 8 },
  panelTitle: { fontSize: 14, fontWeight: '700' },
  panelHelp: { fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 7 },
  accentChips: { flexDirection: 'row', gap: 7, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 7, paddingTop: 12 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  voiceConnection: { fontSize: 11, marginTop: 2 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '600' },
  voiceRow: { minHeight: 44, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  voiceName: { fontSize: 13, fontWeight: '600', flex: 1 },
  panelActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  actionText: { fontSize: 12, fontWeight: '700', paddingVertical: 6 },
  energyLabel: { fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 9 },
  row: { gap: 10, paddingRight: 16 },
  card: { width: 122, minHeight: 100, borderWidth: 1, borderRadius: 16, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  name: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 15, marginTop: 4 },
});
