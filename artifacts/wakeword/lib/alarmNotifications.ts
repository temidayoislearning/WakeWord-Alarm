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

export type AlarmScheduleResult = {
  notificationIds: string[];
  notificationsAllowed: boolean;
};

function toNotificationWeekday(day: number) {
  return ((day + 1) % 7) + 1;
}

export async function ensureAlarmNotificationsAllowed() {
  if (Platform.OS === 'web') return { notificationsAllowed: false };

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
  const requested = current.granted ? current : await Notifications.requestPermissionsAsync();
  return { notificationsAllowed: requested.granted };
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
  const permissions = await ensureAlarmNotificationsAllowed();
  if (!permissions.notificationsAllowed) {
    return { notificationIds: [], ...permissions } satisfies AlarmScheduleResult;
  }

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
            }
          : {}),
      },
    });

    return { notificationIds: [id], ...permissions } satisfies AlarmScheduleResult;
  }

  const notificationIds = await Promise.all(
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
  return { notificationIds, ...permissions } satisfies AlarmScheduleResult;
}

export async function cancelWakeAlarmNotifications(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
