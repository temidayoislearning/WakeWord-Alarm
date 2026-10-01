import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type VoiceMode = 'gentle' | 'focused' | 'energized';

type WakeAlarm = {
  id: string;
  hour: number;
  minute: number;
  phrase: string;
  voiceMode: VoiceMode;
  days: number[];
  enabled: boolean;
  notificationIds: string[];
};

const STORAGE_KEY = 'wakeword.alarms.v1';
const WEEKDAYS = [
  { short: 'M', name: 'Monday', day: 0 },
  { short: 'T', name: 'Tuesday', day: 1 },
  { short: 'W', name: 'Wednesday', day: 2 },
  { short: 'T', name: 'Thursday', day: 3 },
  { short: 'F', name: 'Friday', day: 4 },
  { short: 'S', name: 'Saturday', day: 5 },
  { short: 'S', name: 'Sunday', day: 6 },
];

const VOICES: {
  id: VoiceMode;
  label: string;
  detail: string;
  icon: keyof typeof Feather.glyphMap;
  rate: number;
  pitch: number;
}[] = [
  { id: 'gentle', label: 'Gentle', detail: 'Soft & steady', icon: 'wind', rate: 0.82, pitch: 0.96 },
  { id: 'focused', label: 'Focused', detail: 'Clear & calm', icon: 'target', rate: 0.96, pitch: 1 },
  { id: 'energized', label: 'Energized', detail: 'Bright & quick', icon: 'zap', rate: 1.08, pitch: 1.08 },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatClock(hour: number, minute: number) {
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')}`;
}

function formatDays(days: number[]) {
  if (days.length === 0) return 'One time';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [0, 1, 2, 3, 4].every((day) => days.includes(day))) {
    return 'Weekdays';
  }
  if (days.length === 2 && days.includes(5) && days.includes(6)) {
    return 'Weekends';
  }
  return WEEKDAYS.filter(({ day }) => days.includes(day))
    .map(({ short }) => short)
    .join(' · ');
}

function toNotificationWeekday(day: number) {
  // JavaScript's Sunday-first day index is used by calendar notifications.
  return ((day + 1) % 7) + 1;
}

async function ensureNotificationsAllowed() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wakeword-alarms', {
      name: 'WakeWord alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 180, 350],
      sound: 'default',
      lightColor: '#E66B4E',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function scheduleAlarmNotifications(alarm: WakeAlarm) {
  const granted = await ensureNotificationsAllowed();
  if (!granted) return [];

  const content: Notifications.NotificationContentInput = {
    title: 'WakeWord alarm',
    body: alarm.phrase,
    sound: 'default',
    data: { alarmId: alarm.id },
    ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
  };

  if (alarm.days.length === 0) {
    const next = new Date();
    next.setHours(alarm.hour, alarm.minute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: next,
        ...(Platform.OS === 'android' ? { channelId: 'wakeword-alarms' } : {}),
      },
    });
    return [id];
  }

  return Promise.all(
    alarm.days.map((day) =>
      Notifications.scheduleNotificationAsync({
        content,
        trigger:
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: toNotificationWeekday(day),
                hour: alarm.hour,
                minute: alarm.minute,
                channelId: 'wakeword-alarms',
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                weekday: toNotificationWeekday(day),
                hour: alarm.hour,
                minute: alarm.minute,
                repeats: true,
              },
      }),
    ),
  );
}

async function cancelNotifications(ids: string[]) {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
}

function PulseMark({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseHalo,
          {
            borderColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.7] }) }],
          },
        ]}
      />
      <View style={[styles.pulseCore, { backgroundColor: color }]}>
        <Ionicons name="volume-high" size={28} color="#17211F" />
      </View>
    </View>
  );
}

export default function WakeWordHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [alarms, setAlarms] = useState<WakeAlarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  const [hour12, setHour12] = useState(7);
  const [minute, setMinute] = useState(0);
  const [isPM, setIsPM] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('focused');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<WakeAlarm | null>(null);

  const alarmsRef = useRef(alarms);
  const ringingRef = useRef(ringingAlarm);
  const speechLoopRef = useRef<() => void>(() => undefined);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeNotificationRef = useRef<string | null>(null);
  const lastRungMinuteRef = useRef<Record<string, string>>({});

  alarmsRef.current = alarms;
  ringingRef.current = ringingAlarm;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAlarms = useCallback(async () => {
    setLoadError(false);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) throw new Error('Saved alarm data is invalid.');
      const valid = parsed.filter(
        (item): item is WakeAlarm =>
          !!item &&
          typeof item.id === 'string' &&
          Number.isInteger(item.hour) &&
          Number.isInteger(item.minute) &&
          typeof item.phrase === 'string' &&
          Array.isArray(item.days) &&
          Array.isArray(item.notificationIds),
      );
      setAlarms(valid);
      setLoaded(true);
    } catch {
      setLoadError(true);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadAlarms();
  }, [loadAlarms]);

  const persistAlarms = useCallback(async (next: WakeAlarm[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAlarms(next);
  }, []);

  const startRinging = useCallback((alarm: WakeAlarm) => {
    if (!alarm.enabled || ringingRef.current?.id === alarm.id) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setRingingAlarm(alarm);
  }, []);

  useEffect(() => {
    if (!loaded || Platform.OS === 'web') return;

    const ringFromNotification = (notification: Notifications.Notification) => {
      const alarmId = notification.request.content.data?.alarmId;
      if (typeof alarmId !== 'string') return;
      const alarm = alarmsRef.current.find((item) => item.id === alarmId && item.enabled);
      if (alarm) startRinging(alarm);
    };

    const received = Notifications.addNotificationReceivedListener((notification) => {
      ringFromNotification(notification);
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      ringFromNotification(event.notification);
    });
    void Notifications.getLastNotificationResponseAsync().then((event) => {
      if (event) ringFromNotification(event.notification);
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [loaded, startRinging]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && ringingRef.current) {
        void Speech.isSpeakingAsync().then((speaking) => {
          if (!speaking) speechLoopRef.current();
        });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ringingAlarm) {
      speechLoopRef.current = () => undefined;
      Speech.stop();
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      return;
    }

    const selectedVoice = VOICES.find((voice) => voice.id === ringingAlarm.voiceMode) ?? VOICES[1];
    const speakAgain = () => {
      if (ringingRef.current?.id !== ringingAlarm.id) return;
      Speech.speak(ringingAlarm.phrase, {
        language: 'en-US',
        rate: selectedVoice.rate,
        pitch: selectedVoice.pitch,
        volume: 1,
        onDone: () => {
          if (ringingRef.current?.id === ringingAlarm.id) {
            speechTimeoutRef.current = setTimeout(speakAgain, 900);
          }
        },
      });
    };
    speechLoopRef.current = speakAgain;
    speakAgain();

    return () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      Speech.stop();
    };
  }, [ringingAlarm]);

  useEffect(() => {
    if (!loaded) return;
    const check = () => {
      const date = new Date();
      const day = (date.getDay() + 6) % 7;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      for (const alarm of alarmsRef.current) {
        if (!alarm.enabled || ringingRef.current?.id === alarm.id) continue;
        if (alarm.hour !== date.getHours() || alarm.minute !== date.getMinutes()) continue;
        if (alarm.days.length > 0 && !alarm.days.includes(day)) continue;
        if (lastRungMinuteRef.current[alarm.id] === key) continue;
        lastRungMinuteRef.current[alarm.id] = key;
        startRinging(alarm);
        break;
      }
    };
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [loaded, startRinging]);

  const chooseDay = (day: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    );
  };

  const setAllDays = (nextDays: number[]) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setDays(nextDays);
  };

  const cancelAlarmReminders = async (alarm: WakeAlarm) => {
    if (alarm.notificationIds.length) await cancelNotifications(alarm.notificationIds);
  };

  const saveAlarm = async () => {
    const cleanPhrase = phrase.trim();
    if (!cleanPhrase) {
      Alert.alert('Add a wake-up phrase', 'Type the words you want WakeWord to say.');
      return;
    }
    setSaving(true);
    try {
      const id = editingId ?? makeId();
      const previous = alarms.find((alarm) => alarm.id === id);
      if (previous) await cancelAlarmReminders(previous);

      const alarm: WakeAlarm = {
        id,
        hour: (hour12 % 12) + (isPM ? 12 : 0),
        minute,
        phrase: cleanPhrase,
        voiceMode,
        days: [...days].sort(),
        enabled: true,
        notificationIds: [],
      };

      let notificationIds: string[] = [];
      let notificationsReady = false;
      try {
        notificationIds = await scheduleAlarmNotifications(alarm);
        notificationsReady = notificationIds.length > 0;
      } catch {
        notificationsReady = false;
      }

      const savedAlarm = { ...alarm, notificationIds };
      const next = previous
        ? alarms.map((item) => (item.id === id ? savedAlarm : item))
        : [...alarms, savedAlarm];
      await persistAlarms(next);
      setEditingId(null);
      setPhrase('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (!notificationsReady && Platform.OS !== 'web') {
        Alert.alert(
          'Alarm saved',
          'WakeWord can speak this phrase while the app is open. Allow notifications in Settings for a reminder when it is closed.',
        );
      }
    } catch {
      Alert.alert('Couldn’t save alarm', 'Your alarm was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const editAlarm = (alarm: WakeAlarm) => {
    setEditingId(alarm.id);
    setHour12(alarm.hour % 12 || 12);
    setMinute(alarm.minute);
    setIsPM(alarm.hour >= 12);
    setPhrase(alarm.phrase);
    setVoiceMode(alarm.voiceMode);
    setDays([...alarm.days]);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const toggleAlarm = async (alarm: WakeAlarm, enabled: boolean) => {
    try {
      let notificationIds: string[] = [];
      if (enabled) {
        notificationIds = await scheduleAlarmNotifications({ ...alarm, enabled: true });
      } else {
        await cancelAlarmReminders(alarm);
      }
      const next = alarms.map((item) =>
        item.id === alarm.id ? { ...item, enabled, notificationIds } : item,
      );
      await persistAlarms(next);
    } catch {
      Alert.alert('Couldn’t update alarm', 'Please try switching it again.');
    }
  };

  const removeAlarm = (alarm: WakeAlarm) => {
    Alert.alert('Delete this alarm?', `“${alarm.phrase}” will be removed.`, [
      { text: 'Keep alarm', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cancelAlarmReminders(alarm);
              const next = alarms.filter((item) => item.id !== alarm.id);
              await persistAlarms(next);
              if (editingId === alarm.id) {
                setEditingId(null);
                setPhrase('');
              }
            } catch {
              Alert.alert('Couldn’t delete alarm', 'Please try again.');
            }
          })();
        },
      },
    ]);
  };

  const stopAlarm = async () => {
    const alarm = ringingRef.current;
    if (!alarm) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Speech.stop();
    if (snoozeTimeoutRef.current) clearTimeout(snoozeTimeoutRef.current);
    if (snoozeNotificationRef.current) {
      await Notifications.cancelScheduledNotificationAsync(snoozeNotificationRef.current).catch(() => undefined);
      snoozeNotificationRef.current = null;
    }
    if (alarm.days.length === 0) {
      await cancelAlarmReminders(alarm).catch(() => undefined);
      const next = alarmsRef.current.map((item) =>
        item.id === alarm.id ? { ...item, enabled: false, notificationIds: [] } : item,
      );
      await persistAlarms(next).catch(() => undefined);
    }
    setRingingAlarm(null);
  };

  const snoozeAlarm = async () => {
    const alarm = ringingRef.current;
    if (!alarm) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Speech.stop();
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    if (snoozeTimeoutRef.current) clearTimeout(snoozeTimeoutRef.current);
    setRingingAlarm(null);

    const wakeAt = Date.now() + 5 * 60 * 1000;
    try {
      const allowed = await ensureNotificationsAllowed();
      if (allowed) {
        snoozeNotificationRef.current = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time to get up',
            body: alarm.phrase,
            sound: 'default',
            data: { alarmId: alarm.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(wakeAt),
            ...(Platform.OS === 'android' ? { channelId: 'wakeword-alarms' } : {}),
          },
        });
      }
    } catch {
      // The foreground timer below still handles snooze if notification access is unavailable.
    }

    snoozeTimeoutRef.current = setTimeout(() => {
      const latest = alarmsRef.current.find((item) => item.id === alarm.id);
      if (latest?.enabled) startRinging(latest);
    }, wakeAt - Date.now());
  };

  const selectedVoice = VOICES.find((voice) => voice.id === voiceMode) ?? VOICES[1];
  const activeAlarms = alarms.filter((alarm) => alarm.enabled);
  const greeting = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const headerTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : 0;
  const footerInset = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.app, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {loadError ? (
          <View style={[styles.loadError, { paddingTop: headerTop + 28 }]}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.destructive} />
            <Text style={[styles.loadErrorText, { color: colors.foreground }]}>
              Your saved alarms couldn’t be loaded.
            </Text>
            <Pressable onPress={() => void loadAlarms()} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingTop: headerTop + 14, paddingBottom: footerInset + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandRow}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
                <Ionicons name="volume-high" size={17} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>wakeword</Text>
              <View style={styles.brandTag}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.brandTagText, { color: colors.mutedForeground }]}>YOUR MORNING, YOURS</Text>
              </View>
            </View>

            <View style={styles.intro}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>A BETTER WAY TO BEGIN</Text>
              <Text style={[styles.heading, { color: colors.foreground }]}>Say it, then{'\n'}make it happen.</Text>
              <Text style={[styles.dateLine, { color: colors.mutedForeground }]}>{greeting}</Text>
            </View>

            <View style={[styles.timeCard, { backgroundColor: colors.clockFace }]}>
              <View style={styles.timeCardTop}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: colors.clockMuted }]}>SET YOUR ALARM</Text>
                  <Text style={[styles.timeHint, { color: colors.clockMuted }]}>Tomorrow starts here</Text>
                </View>
                <View style={[styles.timeIcon, { backgroundColor: colors.clockIconBg }]}>
                  <Feather name="sunrise" size={18} color={colors.primary} />
                </View>
              </View>

              <View style={styles.timePicker}>
                <View style={styles.timeUnit}>
                  <Pressable
                    accessibilityLabel="Increase hour"
                    testID="hour-increment"
                    onPress={() => setHour12((value) => (value % 12) + 1)}
                    style={styles.stepButton}
                  >
                    <Feather name="chevron-up" size={19} color={colors.clockMuted} />
                  </Pressable>
                  <Text style={[styles.clockDigit, { color: colors.clockText }]}>{String(hour12).padStart(2, '0')}</Text>
                  <Pressable
                    accessibilityLabel="Decrease hour"
                    testID="hour-decrement"
                    onPress={() => setHour12((value) => ((value + 10) % 12) + 1)}
                    style={styles.stepButton}
                  >
                    <Feather name="chevron-down" size={19} color={colors.clockMuted} />
                  </Pressable>
                </View>
                <Text style={[styles.clockColon, { color: colors.clockText }]}>:</Text>
                <View style={styles.timeUnit}>
                  <Pressable
                    accessibilityLabel="Increase minute"
                    testID="minute-increment"
                    onPress={() => setMinute((value) => (value + 1) % 60)}
                    style={styles.stepButton}
                  >
                    <Feather name="chevron-up" size={19} color={colors.clockMuted} />
                  </Pressable>
                  <Text style={[styles.clockDigit, { color: colors.clockText }]}>{String(minute).padStart(2, '0')}</Text>
                  <Pressable
                    accessibilityLabel="Decrease minute"
                    testID="minute-decrement"
                    onPress={() => setMinute((value) => (value + 59) % 60)}
                    style={styles.stepButton}
                  >
                    <Feather name="chevron-down" size={19} color={colors.clockMuted} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityLabel={`Switch to ${isPM ? 'AM' : 'PM'}`}
                  accessibilityRole="button"
                  testID="am-pm-toggle"
                  onPress={() => setIsPM((value) => !value)}
                  style={[styles.periodButton, { backgroundColor: colors.clockIconBg }]}
                >
                  <Text style={[styles.periodText, { color: colors.primary }]}>{isPM ? 'PM' : 'AM'}</Text>
                  <Feather name="chevron-down" size={13} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={[styles.pickerHint, { color: colors.clockMuted }]}>Tap the arrows to adjust</Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.fieldHeading}>
                <View style={[styles.smallIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="message-circle" size={15} color={colors.primary} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Your wake-up phrase</Text>
                <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>{phrase.length}/60</Text>
              </View>
              <TextInput
                accessibilityLabel="Your wake-up phrase"
                testID="phrase-input"
                value={phrase}
                onChangeText={(value) => setPhrase(value.slice(0, 60))}
                placeholder="e.g. Calculus homework"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                maxLength={60}
                style={[
                  styles.phraseInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              <Text style={[styles.fieldHelp, { color: colors.mutedForeground }]}>
                Make it personal, specific, and hard to ignore.
              </Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.fieldHeading}>
                <View style={[styles.smallIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="mic" size={15} color={colors.primary} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Voice mode</Text>
                <Pressable
                  accessibilityLabel="Preview chosen voice"
                  testID="preview-voice"
                  onPress={() =>
                    Speech.speak(phrase.trim() || 'Good morning. It is time to wake up.', {
                      language: 'en-US',
                      rate: selectedVoice.rate,
                      pitch: selectedVoice.pitch,
                      volume: 1,
                    })
                  }
                  style={styles.previewButton}
                >
                  <Feather name="play" size={13} color={colors.primary} />
                  <Text style={[styles.previewText, { color: colors.primary }]}>Preview</Text>
                </Pressable>
              </View>
              <View style={styles.voiceOptions}>
                {VOICES.map((voice) => {
                  const selected = voiceMode === voice.id;
                  return (
                    <Pressable
                      key={voice.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      testID={`voice-${voice.id}`}
                      onPress={() => {
                        setVoiceMode(voice.id);
                        void Haptics.selectionAsync().catch(() => undefined);
                      }}
                      style={[
                        styles.voiceOption,
                        {
                          backgroundColor: selected ? colors.accent : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={voice.icon}
                        size={17}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.voiceName, { color: colors.foreground }]}>{voice.label}</Text>
                      <Text style={[styles.voiceDetail, { color: colors.mutedForeground }]}>{voice.detail}</Text>
                      {selected ? (
                        <View style={[styles.voiceCheck, { backgroundColor: colors.primary }]}>
                          <Feather name="check" size={10} color={colors.primaryForeground} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.fieldHeading}>
                <View style={[styles.smallIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="calendar" size={15} color={colors.primary} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Repeat</Text>
                <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>
                  {days.length === 0 ? 'Once' : `${days.length} ${days.length === 1 ? 'day' : 'days'}`}
                </Text>
              </View>
              <View style={styles.dayQuickActions}>
                <Pressable
                  accessibilityRole="button"
                  testID="weekdays"
                  onPress={() => setAllDays([0, 1, 2, 3, 4])}
                  style={[
                    styles.quickDayButton,
                    { backgroundColor: days.length === 5 && [0, 1, 2, 3, 4].every((day) => days.includes(day)) ? colors.accent : colors.card },
                  ]}
                >
                  <Text style={[styles.quickDayText, { color: colors.foreground }]}>Weekdays</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="every-day"
                  onPress={() => setAllDays([0, 1, 2, 3, 4, 5, 6])}
                  style={[
                    styles.quickDayButton,
                    { backgroundColor: days.length === 7 ? colors.accent : colors.card },
                  ]}
                >
                  <Text style={[styles.quickDayText, { color: colors.foreground }]}>Every day</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="once"
                  onPress={() => setAllDays([])}
                  style={[
                    styles.quickDayButton,
                    { backgroundColor: days.length === 0 ? colors.accent : colors.card },
                  ]}
                >
                  <Text style={[styles.quickDayText, { color: colors.foreground }]}>Once</Text>
                </Pressable>
              </View>
              <View style={styles.dayRow}>
                {WEEKDAYS.map(({ short, name, day }) => {
                  const selected = days.includes(day);
                  return (
                    <Pressable
                      key={name}
                      accessibilityLabel={name}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      testID={`day-${day}`}
                      onPress={() => chooseDay(day)}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: selected ? colors.primary : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.dayLetter, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
                        {short}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              testID="set-alarm"
              disabled={saving || phrase.trim().length === 0}
              onPress={() => void saveAlarm()}
              style={({ pressed }) => [
                styles.setAlarmButton,
                {
                  backgroundColor: colors.primary,
                  opacity: saving || phrase.trim().length === 0 ? 0.55 : pressed ? 0.88 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name={editingId ? 'checkmark-circle-outline' : 'alarm-outline'} size={20} color={colors.primaryForeground} />
                  <Text style={[styles.setAlarmText, { color: colors.primaryForeground }]}>
                    {editingId ? 'Update alarm' : 'Set alarm'}
                  </Text>
                  <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
                </>
              )}
            </Pressable>
            {editingId ? (
              <Pressable
                testID="cancel-edit"
                onPress={() => {
                  setEditingId(null);
                  setPhrase('');
                  setDays([0, 1, 2, 3, 4]);
                  setHour12(7);
                  setMinute(0);
                  setIsPM(false);
                  setVoiceMode('focused');
                }}
                style={styles.cancelEdit}
              >
                <Text style={[styles.cancelEditText, { color: colors.mutedForeground }]}>Cancel editing</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.deliveryNote, { color: colors.mutedForeground }]}>
              Spoken alarms need WakeWord open. Notifications can remind you when it’s closed.
            </Text>

            <View style={styles.alarmsHeading}>
              <View>
                <Text style={[styles.alarmsTitle, { color: colors.foreground }]}>Your alarms</Text>
                <Text style={[styles.alarmsSubtitle, { color: colors.mutedForeground }]}>
                  {activeAlarms.length === 0
                    ? 'A small nudge, right when you need it'
                    : `${activeAlarms.length} active ${activeAlarms.length === 1 ? 'alarm' : 'alarms'}`}
                </Text>
              </View>
              <View style={[styles.alarmCount, { backgroundColor: colors.accent }]}>
                <Text style={[styles.alarmCountText, { color: colors.primary }]}>{activeAlarms.length}</Text>
              </View>
            </View>

            {alarms.length === 0 ? (
              <View style={[styles.emptyAlarms, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="sun" size={19} color={colors.primary} />
                </View>
                <View style={styles.emptyCopy}>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>A clean slate</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Set your first alarm above and give tomorrow a voice.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.alarmList}>
                {alarms
                  .slice()
                  .sort((first, second) => first.hour * 60 + first.minute - (second.hour * 60 + second.minute))
                  .map((alarm) => (
                    <View
                      key={alarm.id}
                      style={[
                        styles.alarmCard,
                        { backgroundColor: colors.card, borderColor: colors.border, opacity: alarm.enabled ? 1 : 0.72 },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit alarm ${formatClock(alarm.hour, alarm.minute)} for ${alarm.phrase}`}
                        testID={`edit-alarm-${alarm.id}`}
                        onPress={() => editAlarm(alarm)}
                        style={styles.alarmDetails}
                      >
                        <View style={styles.alarmTimeRow}>
                          <Text style={[styles.alarmTime, { color: colors.foreground }]}>{formatClock(alarm.hour, alarm.minute)}</Text>
                          <Text style={[styles.alarmPeriod, { color: colors.mutedForeground }]}>{alarm.hour >= 12 ? 'PM' : 'AM'}</Text>
                          <View style={[styles.alarmStatus, { backgroundColor: alarm.enabled ? colors.accent : colors.secondary }]}>
                            <Text style={[styles.alarmStatusText, { color: alarm.enabled ? colors.primary : colors.mutedForeground }]}>
                              {alarm.enabled ? 'ON' : 'OFF'}
                            </Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={[styles.alarmPhrase, { color: colors.foreground }]}>
                          “{alarm.phrase}”
                        </Text>
                        <View style={styles.alarmMeta}>
                          <Feather name="repeat" size={12} color={colors.mutedForeground} />
                          <Text style={[styles.alarmRepeat, { color: colors.mutedForeground }]}>{formatDays(alarm.days)}</Text>
                          <View style={styles.metaDot} />
                          <Text style={[styles.alarmRepeat, { color: colors.mutedForeground }]}>
                            {VOICES.find((voice) => voice.id === alarm.voiceMode)?.label ?? 'Focused'} voice
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.alarmActions}>
                        <Switch
                          accessibilityLabel={`Turn ${alarm.enabled ? 'off' : 'on'} alarm for ${alarm.phrase}`}
                          testID={`toggle-alarm-${alarm.id}`}
                          value={alarm.enabled}
                          onValueChange={(value) => void toggleAlarm(alarm, value)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor={colors.card}
                        />
                        <Pressable
                          accessibilityLabel={`Delete alarm for ${alarm.phrase}`}
                          testID={`delete-alarm-${alarm.id}`}
                          onPress={() => removeAlarm(alarm)}
                          style={styles.deleteButton}
                        >
                          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
              </View>
            )}
            <View style={styles.footer}>
              <Feather name="shield" size={13} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Your phrases stay on this device.</Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {ringingAlarm ? (
        <View style={[styles.ringingScreen, { backgroundColor: colors.ringBackground, paddingTop: headerTop + 20, paddingBottom: footerInset + 20 }]}>
          <View style={styles.ringTop}>
            <View style={[styles.ringBrandMark, { backgroundColor: colors.ringSurface }]}>
              <Ionicons name="volume-high" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.ringBrand, { color: colors.ringMuted }]}>WAKEWORD</Text>
            <View style={styles.ringLive}>
              <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.ringLiveText, { color: colors.ringMuted }]}>ALARM</Text>
            </View>
          </View>
          <View style={styles.ringCenter}>
            <PulseMark color={colors.primary} />
            <Text style={[styles.ringKicker, { color: colors.ringMuted }]}>TIME TO GET UP</Text>
            <Text style={[styles.ringTime, { color: colors.ringText }]}>
              {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <View style={[styles.ringPhraseCard, { backgroundColor: colors.ringSurface }]}>
              <Text style={[styles.ringPhraseLabel, { color: colors.ringMuted }]}>YOUR WAKE-UP PHRASE</Text>
              <Text style={[styles.ringPhrase, { color: colors.ringText }]}>{ringingAlarm.phrase}</Text>
              <View style={styles.speakingLine}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.speakingText, { color: colors.ringMuted }]}>
                  {VOICES.find((voice) => voice.id === ringingAlarm.voiceMode)?.label ?? 'Focused'} voice · repeating
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.ringActions}>
            <Pressable
              accessibilityRole="button"
              testID="snooze-alarm"
              onPress={() => void snoozeAlarm()}
              style={({ pressed }) => [
                styles.snoozeButton,
                { borderColor: colors.ringOutline, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Feather name="clock" size={18} color={colors.ringText} />
              <Text style={[styles.snoozeText, { color: colors.ringText }]}>Snooze 5 min</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="stop-alarm"
              onPress={() => void stopAlarm()}
              style={({ pressed }) => [
                styles.stopButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Feather name="check" size={19} color={colors.primaryForeground} />
              <Text style={[styles.stopText, { color: colors.primaryForeground }]}>I’m up — stop</Text>
            </Pressable>
            <Text style={[styles.ringFootnote, { color: colors.ringMuted }]}>
              Your phrase will keep playing until you’re ready.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22 },
  loadError: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  loadErrorText: { fontFamily: 'Inter_600SemiBold', fontSize: 17, textAlign: 'center' },
  retryButton: { borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13 },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 30 },
  brandMark: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.5 },
  brandTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  brandTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.8 },
  intro: { marginBottom: 22 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.25, marginBottom: 9 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 31, letterSpacing: -1.1, lineHeight: 37 },
  dateLine: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 8 },
  timeCard: { borderRadius: 25, padding: 21, marginBottom: 25, overflow: 'hidden' },
  timeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  timeHint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  timeIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  timeUnit: { alignItems: 'center', width: 94 },
  stepButton: { width: 36, height: 24, alignItems: 'center', justifyContent: 'center' },
  clockDigit: { fontFamily: 'Inter_700Bold', fontSize: 57, lineHeight: 68, letterSpacing: -2.8, fontVariant: ['tabular-nums'] },
  clockColon: { fontFamily: 'Inter_500Medium', fontSize: 45, marginHorizontal: -3, marginTop: -2 },
  periodButton: { alignItems: 'center', flexDirection: 'row', gap: 2, paddingHorizontal: 9, height: 32, borderRadius: 10, marginLeft: 10, marginTop: 7 },
  periodText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  pickerHint: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 5 },
  formSection: { marginBottom: 22 },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  smallIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: -0.2 },
  optionalText: { fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 'auto' },
  phraseInput: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 14, minHeight: 51, fontFamily: 'Inter_500Medium', fontSize: 14 },
  fieldHelp: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 7, marginLeft: 2 },
  previewButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, padding: 5 },
  previewText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  voiceOptions: { flexDirection: 'row', gap: 8 },
  voiceOption: { flex: 1, minHeight: 90, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, position: 'relative' },
  voiceName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  voiceDetail: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 4 },
  voiceCheck: { position: 'absolute', right: 8, top: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayQuickActions: { flexDirection: 'row', gap: 7, marginBottom: 11 },
  quickDayButton: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  quickDayText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  dayButton: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  setAlarmButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 55, borderRadius: 17, marginTop: 2 },
  setAlarmText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cancelEdit: { padding: 10, alignItems: 'center' },
  cancelEditText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  deliveryNote: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 11, marginHorizontal: 12 },
  alarmsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 13 },
  alarmsTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.45 },
  alarmsSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  alarmCount: { minWidth: 29, height: 29, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alarmCountText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  emptyAlarms: { borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  emptyIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
  alarmList: { gap: 10 },
  alarmCard: { borderWidth: 1, borderRadius: 17, paddingLeft: 15, paddingRight: 10, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alarmDetails: { flex: 1, minWidth: 0, paddingRight: 8 },
  alarmTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  alarmTime: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  alarmPeriod: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  alarmStatus: { borderRadius: 6, marginLeft: 3, paddingHorizontal: 6, paddingVertical: 3 },
  alarmStatusText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.6 },
  alarmPhrase: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 1 },
  alarmMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  alarmRepeat: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  metaDot: { width: 3, height: 3, borderRadius: 2, marginHorizontal: 1, backgroundColor: '#A4AAA4' },
  alarmActions: { alignItems: 'center', gap: 2, marginLeft: 4 },
  deleteButton: { paddingHorizontal: 12, paddingVertical: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  ringingScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, paddingHorizontal: 25, justifyContent: 'space-between' },
  ringTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ringBrandMark: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ringBrand: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  ringLive: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  ringLiveText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  ringCenter: { alignItems: 'center', paddingTop: 22, paddingBottom: 20 },
  pulseWrap: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center', marginBottom: 35 },
  pulseHalo: { position: 'absolute', width: 78, height: 78, borderRadius: 39, borderWidth: 1 },
  pulseCore: { width: 65, height: 65, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  ringKicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8 },
  ringTime: { fontFamily: 'Inter_700Bold', fontSize: 53, letterSpacing: -2.5, marginTop: 6, fontVariant: ['tabular-nums'] },
  ringPhraseCard: { width: '100%', borderRadius: 23, alignItems: 'center', paddingVertical: 21, paddingHorizontal: 20, marginTop: 24 },
  ringPhraseLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.15 },
  ringPhrase: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 31, textAlign: 'center', marginTop: 12 },
  speakingLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  speakingText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  ringActions: { alignItems: 'center', gap: 11 },
  snoozeButton: { width: '100%', height: 53, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16 },
  snoozeText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  stopButton: { width: '100%', height: 57, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  stopText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  ringFootnote: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4, marginBottom: 6 },
});