import { requireNativeModule } from 'expo';

export type NativeAlarmInput = {
  id: string;
  hour: number;
  minute: number;
  phrase: string;
  days: number[];
};

export type NativeAlarmResult = {
  available: boolean;
  scheduled: boolean;
  permissionGranted: boolean;
  platform: string;
  reason?: string;
};

type WakeWordAlarmsNative = {
  scheduleAlarm(alarm: NativeAlarmInput): Promise<NativeAlarmResult>;
  cancelAlarm(id: string): Promise<void>;
  snoozeAlarm(id: string, phrase: string): Promise<void>;
  stopRinging(id: string): Promise<void>;
  requestAlarmPermission(): Promise<boolean>;
  openAlarmSettings(): Promise<void>;
};

let nativeModule: WakeWordAlarmsNative | null | undefined;

function getNativeModule() {
  if (nativeModule !== undefined) return nativeModule;
  try {
    nativeModule = requireNativeModule<WakeWordAlarmsNative>('WakeWordAlarms');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export async function scheduleNativeAlarm(alarm: NativeAlarmInput): Promise<NativeAlarmResult> {
  const module = getNativeModule();
  if (!module) {
    return {
      available: false,
      scheduled: false,
      permissionGranted: false,
      platform: 'unavailable',
      reason: 'Native alarm support requires an installed native app build.',
    };
  }
  return module.scheduleAlarm(alarm);
}

export async function cancelNativeAlarm(id: string) {
  const module = getNativeModule();
  if (module) await module.cancelAlarm(id);
}

export async function snoozeNativeAlarm(id: string, phrase: string) {
  const module = getNativeModule();
  if (module) await module.snoozeAlarm(id, phrase);
}

export async function stopNativeRinging(id: string) {
  const module = getNativeModule();
  if (module) await module.stopRinging(id);
}

export async function requestNativeAlarmPermission() {
  const module = getNativeModule();
  return module ? module.requestAlarmPermission() : false;
}

export async function openNativeAlarmSettings() {
  const module = getNativeModule();
  if (module) await module.openAlarmSettings();
}
