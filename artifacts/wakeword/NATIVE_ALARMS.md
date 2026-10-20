# Native alarm builds

WakeWord's custom alarm module is a local Expo module under `modules/wakeword-alarms`.
Expo Go and the static Replit preview do not include that native code; use a development
or production native build to exercise it.

From `artifacts/wakeword`, build an installable development app with:

```sh
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Android uses `AlarmManager.setAlarmClock`, restores repeating alarms after boot or
time-zone changes or exact-alarm access being granted, and posts a full-screen alarm
notification. Android 12+ requires
the user to allow exact alarms. Android 14+ may also require full-screen access, and
Android 13+ requires notifications. If full-screen access is unavailable, the alarm
remains scheduled and the system shows its available notification UI.

iOS 26+ uses AlarmKit for its lock-screen alarm, weekly repeat schedule, system alarm
sound, Stop control, and five-minute snooze. The phrase appears as the alarm title.
Apple does not let AlarmKit speak arbitrary text or play a user recording as the
native alarm sound. The saved voice or phrase loops after WakeWord is open. Earlier
iOS versions use the notification fallback.

The TypeScript app and Expo config can be checked on any platform. Native Android
and iOS behavior still needs device testing after installing these builds, including
permission denial, reboot, time-zone changes, locked screen, snooze, and stop.
