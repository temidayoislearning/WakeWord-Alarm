import { requireNativeModule } from 'expo';

export type NativeAlarmInput = {
  id: string;
  hour: number;
  minute: number;
  phrase: string;
  days: number[];
  voiceMode?: string;
  recordingUri?: string;
  voiceId?: string;
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
  startAlarmAudio?(alarm: NativeAlarmInput): Promise<boolean>;
  syncAlarmAudioSettings?(alarm: NativeAlarmInput): Promise<void>;
  getOfflineVoices?(): Promise<Array<{ id: string; language: string }>>;
  snoozeAlarm(id: string, phrase: string): Promise<boolean>;
  stopRinging(id: string): Promise<void>;
  requestAlarmPermission(): Promise<boolean>;
  openAlarmSettings(): Promise<void>;
  getDismissedOneTimeAlarms?(): Promise<string[]>;
  acknowledgeDismissedOneTimeAlarms?(ids: string[]): Promise<void>;
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
  return module ? module.snoozeAlarm(id, phrase) : false;
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

export async function getDismissedOneTimeAlarms() {
  const module = getNativeModule();
  return module?.getDismissedOneTimeAlarms ? module.getDismissedOneTimeAlarms() : [];
}

export async function acknowledgeDismissedOneTimeAlarms(ids: string[]) {
  const module = getNativeModule();
  if (module?.acknowledgeDismissedOneTimeAlarms) await module.acknowledgeDismissedOneTimeAlarms(ids);
}

export async function startNativeAlarmAudio(alarm: NativeAlarmInput): Promise<boolean> {
  const module = getNativeModule();
  return module?.startAlarmAudio ? module.startAlarmAudio(alarm) : false;
}

export async function syncNativeAlarmAudioSettings(alarm: NativeAlarmInput): Promise<void> {
  const module = getNativeModule();
  if (module?.syncAlarmAudioSettings) await module.syncAlarmAudioSettings(alarm);
}

export async function getOfflineAccentVoices(): Promise<Array<{ id: string; language: string }>> {
  const module = getNativeModule();
  return module?.getOfflineVoices ? module.getOfflineVoices() : [];
}
