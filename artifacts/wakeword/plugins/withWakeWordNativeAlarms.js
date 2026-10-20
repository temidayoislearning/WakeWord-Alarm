const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const withWakeWordAndroidAlarmManifest = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const permissions = manifest.manifest['uses-permission'] ?? [];
    const requiredPermissions = [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
    ];
    for (const name of requiredPermissions) {
      if (!permissions.some((item) => item.$['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name } });
      }
    }
    manifest.manifest['uses-permission'] = permissions;

    const application = manifest.manifest.application?.[0];
    if (!application) return mod;
    application.receiver = application.receiver ?? [];
    const receivers = [
      {
        name: 'expo.modules.wakewordalarms.WakeWordAlarmReceiver',
        exported: 'false',
      },
      {
        name: 'expo.modules.wakewordalarms.WakeWordAlarmBootReceiver',
        exported: 'false',
        filter: [{ action: [
          { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
          { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
          { $: { 'android:name': 'android.intent.action.TIME_SET' } },
          { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } },
        ] }],
      },
    ];
    for (const item of receivers) {
      const existing = application.receiver.find((receiver) => receiver.$?.['android:name'] === item.name);
      if (!existing) {
        const { filter, ...attributes } = item;
        const receiver = {
          $: { 'android:name': attributes.name, 'android:exported': attributes.exported },
        };
        if (filter) receiver['intent-filter'] = filter;
        application.receiver.push(receiver);
      }
    }
    return mod;
  });

const withWakeWordIOSAlarmUsage = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.NSAlarmKitUsageDescription =
      'WakeWord uses AlarmKit to show reliable alarms on your Lock Screen.';
    mod.modResults.NSSupportsLiveActivities = true;
    return mod;
  });

module.exports = function withWakeWordNativeAlarms(config) {
  return withWakeWordIOSAlarmUsage(withWakeWordAndroidAlarmManifest(config));
};
