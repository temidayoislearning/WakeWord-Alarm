import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelNativeAlarm, scheduleNativeAlarm } from '@/modules/wakeword-alarms/src/WakeWordAlarms';

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
  nativeAlarmAvailable: boolean;
  nativeAlarmScheduled: boolean;
  nativeAlarmReason?: string;
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
  const androidNotificationPermissions = Platform.OS === 'android'
    ? await ensureAlarmNotificationsAllowed()
    : null;
  const native = await scheduleNativeAlarm(alarm).catch(() => ({
    available: false,
    scheduled: false,
    permissionGranted: false,
    platform: 'unavailable',
    reason: 'Native alarm setup failed in this build.',
  }));
  if (native.scheduled) {
    const permissionReason = androidNotificationPermissions && !androidNotificationPermissions.notificationsAllowed
      ? 'Notifications are off. Enable notifications so Android can display the full-screen alarm alert.'
      : native.reason;
    return {
      notificationIds: [],
      notificationsAllowed: androidNotificationPermissions?.notificationsAllowed ?? true,
      nativeAlarmAvailable: true,
      nativeAlarmScheduled: true,
      nativeAlarmReason: permissionReason,
    } satisfies AlarmScheduleResult;
  }

  const permissions = androidNotificationPermissions ?? await ensureAlarmNotificationsAllowed();
  if (!permissions.notificationsAllowed) {
    return {
      notificationIds: [],
      ...permissions,
      nativeAlarmAvailable: native.available,
      nativeAlarmScheduled: false,
      nativeAlarmReason: native.reason,
    } satisfies AlarmScheduleResult;
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

    return { notificationIds: [id], ...permissions, nativeAlarmAvailable: native.available, nativeAlarmScheduled: false, nativeAlarmReason: native.reason } satisfies AlarmScheduleResult;
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
  return { notificationIds, ...permissions, nativeAlarmAvailable: native.available, nativeAlarmScheduled: false, nativeAlarmReason: native.reason } satisfies AlarmScheduleResult;
}

export async function cancelWakeAlarmNotifications(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function cancelWakeAlarmNative(id: string) {
  await cancelNativeAlarm(id).catch(() => undefined);
}
