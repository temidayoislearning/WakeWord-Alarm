import * as Speech from 'expo-speech';

export type VoiceModeId =
  | 'gentle'
  | 'focused'
  | 'energized'
  | 'urgent'
  | 'deep'
  | 'coach'
  | 'drill'
  | 'cheerful'
  | 'calm'
  | 'robotic';

export type VoiceMode = {
  id: VoiceModeId;
  label: string;
  detail: string;
  personality: string;
  rate: number;
  pitch: number;
  volume: number;
  repeatDelayMs: number;
  preferredVoiceHints: string[];
};

export const VOICE_MODES: VoiceMode[] = [
  {
    id: 'gentle', label: 'Gentle', detail: 'Slow, soft & steady',
    personality: 'A soft wake-up that eases you into the task.',
    rate: 0.78, pitch: 1.04, volume: 0.82, repeatDelayMs: 1500,
    preferredVoiceHints: ['samantha', 'ava', 'serena', 'female'],
  },
  {
    id: 'focused', label: 'Focused', detail: 'Clear & calm',
    personality: 'Neutral and distraction-free for study or work alarms.',
    rate: 0.96, pitch: 1, volume: 1, repeatDelayMs: 900,
    preferredVoiceHints: ['daniel', 'aaron', 'samantha', 'enhanced'],
  },
  {
    id: 'energized', label: 'Energized', detail: 'Bright, quick & motivating',
    personality: 'Upbeat delivery for workouts, mornings, and momentum.',
    rate: 1.1, pitch: 1.08, volume: 1, repeatDelayMs: 650,
    preferredVoiceHints: ['ava', 'samantha', 'enhanced'],
  },
  {
    id: 'urgent', label: 'Urgent', detail: 'Fast & hard to ignore',
    personality: 'Maximum-attention delivery for alarms you cannot miss.',
    rate: 1.18, pitch: 1.02, volume: 1, repeatDelayMs: 350,
    preferredVoiceHints: ['daniel', 'aaron', 'enhanced'],
  },
  {
    id: 'deep', label: 'Deep', detail: 'Lower & deliberate',
    personality: 'Slower and weightier, with a lower-pitched delivery.',
    rate: 0.88, pitch: 0.82, volume: 1, repeatDelayMs: 1050,
    preferredVoiceHints: ['daniel', 'aaron', 'male'],
  },
  {
    id: 'coach', label: 'Coach', detail: 'Firm & motivating',
    personality: 'A confident push that feels like a coach keeping you accountable.',
    rate: 1.04, pitch: 0.94, volume: 1, repeatDelayMs: 550,
    preferredVoiceHints: ['daniel', 'aaron', 'enhanced'],
  },
  {
    id: 'drill', label: 'Drill', detail: 'Sharp & commanding',
    personality: 'Short pauses and forceful pacing when you need zero negotiation.',
    rate: 1.2, pitch: 0.9, volume: 1, repeatDelayMs: 250,
    preferredVoiceHints: ['aaron', 'daniel', 'male'],
  },
  {
    id: 'cheerful', label: 'Cheerful', detail: 'Friendly & upbeat',
    personality: 'A lighter personality that makes routine reminders feel positive.',
    rate: 1.02, pitch: 1.14, volume: 0.96, repeatDelayMs: 800,
    preferredVoiceHints: ['ava', 'samantha', 'serena', 'female'],
  },
  {
    id: 'calm', label: 'Calm', detail: 'Relaxed & reassuring',
    personality: 'Measured pacing for reminders that should not feel stressful.',
    rate: 0.82, pitch: 0.94, volume: 0.88, repeatDelayMs: 1350,
    preferredVoiceHints: ['serena', 'samantha', 'daniel', 'enhanced'],
  },
  {
    id: 'robotic', label: 'Robotic', detail: 'Synthetic & precise',
    personality: 'A deliberately machine-like delivery that fits the WakeWord identity.',
    rate: 0.92, pitch: 0.72, volume: 1, repeatDelayMs: 700,
    preferredVoiceHints: ['compact', 'default', 'english'],
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
