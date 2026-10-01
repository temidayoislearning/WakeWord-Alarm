import * as Speech from 'expo-speech';

export type VoiceModeId = 'gentle' | 'focused' | 'energized' | 'urgent' | 'deep';

export type VoiceMode = {
  id: VoiceModeId;
  label: string;
  detail: string;
  rate: number;
  pitch: number;
  volume: number;
  repeatDelayMs: number;
  preferredVoiceHints: string[];
};

export const VOICE_MODES: VoiceMode[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    detail: 'Slow, soft & steady',
    rate: 0.78,
    pitch: 1.04,
    volume: 0.82,
    repeatDelayMs: 1500,
    preferredVoiceHints: ['samantha', 'ava', 'serena', 'female'],
  },
  {
    id: 'focused',
    label: 'Focused',
    detail: 'Clear & calm',
    rate: 0.96,
    pitch: 1,
    volume: 1,
    repeatDelayMs: 900,
    preferredVoiceHints: ['daniel', 'aaron', 'samantha', 'enhanced'],
  },
  {
    id: 'energized',
    label: 'Energized',
    detail: 'Bright, quick & motivating',
    rate: 1.1,
    pitch: 1.08,
    volume: 1,
    repeatDelayMs: 650,
    preferredVoiceHints: ['ava', 'samantha', 'enhanced'],
  },
  {
    id: 'urgent',
    label: 'Urgent',
    detail: 'Fast & hard to ignore',
    rate: 1.18,
    pitch: 1.02,
    volume: 1,
    repeatDelayMs: 350,
    preferredVoiceHints: ['daniel', 'aaron', 'enhanced'],
  },
  {
    id: 'deep',
    label: 'Deep',
    detail: 'Lower & deliberate',
    rate: 0.88,
    pitch: 0.82,
    volume: 1,
    repeatDelayMs: 1050,
    preferredVoiceHints: ['daniel', 'aaron', 'male'],
  },
];

export function getVoiceMode(id: VoiceModeId): VoiceMode {
  return VOICE_MODES.find((mode) => mode.id === id) ?? VOICE_MODES[1];
}

export async function resolveDeviceVoice(mode: VoiceMode): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const englishVoices = voices.filter((voice) => voice.language.toLowerCase().startsWith('en'));
    if (!englishVoices.length) return undefined;

    for (const hint of mode.preferredVoiceHints) {
      const normalizedHint = hint.toLowerCase();
      const match = englishVoices.find((voice) =>
        `${voice.name} ${voice.identifier} ${voice.quality}`.toLowerCase().includes(normalizedHint),
      );
      if (match) return match.identifier;
    }

    const enhanced = englishVoices.find((voice) =>
      String(voice.quality).toLowerCase().includes('enhanced'),
    );
    return (enhanced ?? englishVoices[0]).identifier;
  } catch {
    return undefined;
  }
}

export async function speakWithVoiceMode(
  text: string,
  modeId: VoiceModeId,
  callbacks: Pick<Speech.SpeechOptions, 'onDone' | 'onError' | 'onStopped'> = {},
) {
  const mode = getVoiceMode(modeId);
  const voice = await resolveDeviceVoice(mode);

  Speech.speak(text, {
    language: 'en-US',
    rate: mode.rate,
    pitch: mode.pitch,
    volume: mode.volume,
    ...(voice ? { voice } : {}),
    ...callbacks,
  });
}
