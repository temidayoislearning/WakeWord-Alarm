import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const ALARM_CHANNEL_ID = 'wakeword-alarms';

export type SchedulableWakeAlarm = {
  id: string;
  hour: number;
  minute: number;
  phrase: string;
  days: number[];
};

function toNotificationWeekday(day: number) {
  return ((day + 1) % 7) + 1;
}

export async function ensureAlarmNotificationsAllowed() {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'WakeWord alarms',
      description: 'Time-critical WakeWord alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 180, 350],
      sound: 'default',
      lightColor: '#E66B4E',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function notificationContent(alarm: SchedulableWakeAlarm): Notifications.NotificationContentInput {
  return {
    title: 'WakeWord alarm',
    body: alarm.phrase,
    sound: 'default',
    data: { alarmId: alarm.id, source: 'wakeword-alarm' },
    ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
  };
}

export async function scheduleWakeAlarm(alarm: SchedulableWakeAlarm) {
  const allowed = await ensureAlarmNotificationsAllowed();
  if (!allowed) return [];

  const content = notificationContent(alarm);

  if (alarm.days.length === 0) {
    const next = new Date();
    next.setHours(alarm.hour, alarm.minute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: next,
        ...(Platform.OS === 'android'
          ? {
              channelId: ALARM_CHANNEL_ID,
              delivery: 'alarmClock' as const,
            }
          : {}),
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
                channelId: ALARM_CHANNEL_ID,
                delivery: 'alarmClock' as const,
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

export async function cancelWakeAlarmNotifications(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
