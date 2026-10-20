package expo.modules.wakewordalarms

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationManagerCompat

class WakeWordAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("alarmId") ?: return
    val phrase = intent.getStringExtra("phrase") ?: "Wake up"
    val hour = intent.getIntExtra("hour", -1)
    val minute = intent.getIntExtra("minute", -1)
    val day = intent.getIntExtra("day", -1)
    if (day >= 0 && hour >= 0 && minute >= 0) scheduleNextWeekly(context, id, phrase, hour, minute, day)
    postAlarmNotification(context, id, phrase)
  }

  private fun scheduleNextWeekly(context: Context, id: String, phrase: String, hour: Int, minute: Int, day: Int) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) return
    val triggerAt = nextOccurrenceFor(System.currentTimeMillis(), hour, minute, day)
    val requestCode = stableRequestCodeFor(id, day)
    val fire = Intent(context, WakeWordAlarmReceiver::class.java).apply {
      action = "${context.packageName}.WAKEWORD_ALARM"
      data = Uri.parse("wakeword-alarm://$id/$day")
      putExtra("alarmId", id)
      putExtra("phrase", phrase)
      putExtra("hour", hour)
      putExtra("minute", minute)
      putExtra("day", day)
    }
    val pending = PendingIntent.getBroadcast(context, requestCode, fire, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val show = PendingIntent.getActivity(context, requestCode + 1, ringIntentFor(context, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), pending)
  }

  private fun postAlarmNotification(context: Context, id: String, phrase: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = "wakeword-native-alarms"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, "WakeWord alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Native alarm alerts"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(false)
        setSound(android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
      }
      manager.createNotificationChannel(channel)
    }
    val open = PendingIntent.getActivity(context, id.hashCode(), ringIntentFor(context, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, channelId)
    } else {
      Notification.Builder(context)
        .setPriority(Notification.PRIORITY_MAX)
        .setSound(android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI)
    }
    val notification = builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("WakeWord alarm")
      .setContentText(phrase)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(false)
      .setOngoing(true)
      .setFullScreenIntent(open, true)
      .setContentIntent(open)
      .setVibrate(longArrayOf(0, 450, 180, 450))
      .build()
    try {
      if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
        manager.notify(id.hashCode(), notification)
      }
    } catch (_: SecurityException) {
      // Android 13+ may revoke notification access after an alarm has already been set.
    }
  }
}

class WakeWordAlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in setOf(
      Intent.ACTION_BOOT_COMPLETED,
      "android.intent.action.MY_PACKAGE_REPLACED",
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED
    )) return
    val prefs = context.getSharedPreferences("wakeword-native-alarms", Context.MODE_PRIVATE)
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) return
    for ((id, raw) in prefs.all) {
      if (raw !is String) continue
      runCatching {
        val item = org.json.JSONObject(raw)
        val days = item.optJSONArray("days")
        val records = if (days == null || days.length() == 0) listOf(-1) else (0 until days.length()).map { days.getInt(it) }
        for (day in records) {
          val code = stableRequestCodeFor(id, day)
          val fire = Intent(context, WakeWordAlarmReceiver::class.java).apply {
            action = "${context.packageName}.WAKEWORD_ALARM"
            data = Uri.parse("wakeword-alarm://$id/$day")
            putExtra("alarmId", id)
            putExtra("phrase", item.optString("phrase", "Wake up"))
            putExtra("hour", item.optInt("hour"))
            putExtra("minute", item.optInt("minute"))
            putExtra("day", day)
          }
          val pending = PendingIntent.getBroadcast(context, code, fire, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
          val show = PendingIntent.getActivity(context, code + 1, ringIntentFor(context, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
          manager.setAlarmClock(AlarmManager.AlarmClockInfo(nextOccurrenceFor(System.currentTimeMillis(), item.optInt("hour"), item.optInt("minute"), day), show), pending)
        }
      }
    }
  }
}
