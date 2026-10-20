package expo.modules.wakewordalarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class WakeWordAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WakeWordAlarms")

    AsyncFunction("scheduleAlarm") { input: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw Exception("App context is unavailable")
      val id = input["id"] as? String ?: throw Exception("Alarm ID is required")
      val hour = (input["hour"] as? Number)?.toInt() ?: throw Exception("Alarm hour is required")
      val minute = (input["minute"] as? Number)?.toInt() ?: throw Exception("Alarm minute is required")
      val phrase = input["phrase"] as? String ?: "Wake up"
      val days = (input["days"] as? List<*>)?.mapNotNull { (it as? Number)?.toInt() } ?: emptyList()
      val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val normalizedDays = days.distinct().filter { it in 0..6 }.sorted()
      cancelStored(context, id)
      persist(context, id, hour, minute, phrase, normalizedDays)
      val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
      if (!allowed) {
        return@AsyncFunction mapOf(
          "available" to true,
          "scheduled" to false,
          "permissionGranted" to false,
          "platform" to "android",
          "reason" to "Allow alarms and reminders in Android Settings to schedule an exact alarm."
        )
      }

      val records = if (normalizedDays.isEmpty()) listOf(-1) else normalizedDays
      val now = System.currentTimeMillis()
      for (day in records) {
        val triggerAt = nextOccurrence(now, hour, minute, day)
        val requestCode = stableRequestCode(id, day)
        val fire = Intent(context, WakeWordAlarmReceiver::class.java).apply {
          action = "${context.packageName}.WAKEWORD_ALARM"
          data = Uri.parse("wakeword-alarm://$id/$day")
          putExtra("alarmId", id)
          putExtra("phrase", phrase)
          putExtra("hour", hour)
          putExtra("minute", minute)
          putExtra("day", day)
        }
        val pending = PendingIntent.getBroadcast(
          context,
          requestCode,
          fire,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val show = PendingIntent.getActivity(
          context,
          requestCode + 1,
          ringIntent(context, id),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), pending)
      }
      val fullScreenAllowed = Build.VERSION.SDK_INT < 34 ||
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).canUseFullScreenIntent()
      mapOf(
        "available" to true,
        "scheduled" to true,
        "permissionGranted" to true,
        "platform" to "android",
        "reason" to if (fullScreenAllowed) null else "The alarm is scheduled, but Android full-screen access is off. Enable it for WakeWord to open its spoken alarm over the lock screen."
      )
    }

    AsyncFunction("cancelAlarm") { id: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      cancelStored(context, id)
    }

    AsyncFunction("snoozeAlarm") { id: String, phrase: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) return@AsyncFunction false
      val snoozeId = "$id-snooze"
      val requestCode = stableRequestCode(snoozeId, -1)
      val fire = Intent(context, WakeWordAlarmReceiver::class.java).apply {
        action = "${context.packageName}.WAKEWORD_SNOOZE"
        data = Uri.parse("wakeword-snooze://$id")
        putExtra("alarmId", id)
        putExtra("phrase", phrase)
        putExtra("day", -1)
      }
      val pending = PendingIntent.getBroadcast(context, requestCode, fire, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val show = PendingIntent.getActivity(context, requestCode + 1, ringIntent(context, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(System.currentTimeMillis() + 5 * 60 * 1000, show), pending)
      true
    }

    AsyncFunction("stopRinging") { id: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
      manager.cancel(id.hashCode())
    }

    AsyncFunction("requestAlarmPermission") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (!manager.canScheduleExactAlarms()) {
          context.startActivity(Intent(AlarmManager.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          })
          return@AsyncFunction false
        }
      }
      true
    }

    AsyncFunction("openAlarmSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val action = when {
          !manager.canScheduleExactAlarms() -> AlarmManager.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
          Build.VERSION.SDK_INT >= 34 && !notifications.canUseFullScreenIntent() -> "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT"
          !NotificationManagerCompat.from(context).areNotificationsEnabled() -> "android.settings.APP_NOTIFICATION_SETTINGS"
          else -> "android.settings.APPLICATION_DETAILS_SETTINGS"
        }
        context.startActivity(Intent(action).apply {
          if (action == "android.settings.APP_NOTIFICATION_SETTINGS") {
            putExtra("android.provider.extra.APP_PACKAGE", context.packageName)
          } else {
            data = Uri.parse("package:${context.packageName}")
          }
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
      }
    }
  }

  private fun nextOccurrence(now: Long, hour: Int, minute: Int, weekdayMondayFirst: Int): Long {
    val cal = Calendar.getInstance().apply { timeInMillis = now }
    cal.set(Calendar.HOUR_OF_DAY, hour.coerceIn(0, 23))
    cal.set(Calendar.MINUTE, minute.coerceIn(0, 59))
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    if (weekdayMondayFirst < 0) {
      if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
      return cal.timeInMillis
    }
    val targetAndroidDay = (weekdayMondayFirst + 1) % 7 + 1 // Monday-first 0..6 to Calendar.SUNDAY=1
    while (cal.get(Calendar.DAY_OF_WEEK) != targetAndroidDay || cal.timeInMillis <= now) {
      cal.add(Calendar.DAY_OF_YEAR, 1)
    }
    return cal.timeInMillis
  }

  private fun stableRequestCode(id: String, day: Int) = 31 * id.hashCode() + day + 1

  private fun ringIntent(context: Context, id: String): Intent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(context, Class.forName("${context.packageName}.MainActivity"))
    return launch.apply {
    action = Intent.ACTION_VIEW
    data = Uri.parse("wakeword:///?alarmId=${Uri.encode(id)}")
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
  }

  private fun persist(context: Context, id: String, hour: Int, minute: Int, phrase: String, days: List<Int>) {
    val prefs = context.getSharedPreferences("wakeword-native-alarms", Context.MODE_PRIVATE)
    val item = org.json.JSONObject().put("hour", hour).put("minute", minute).put("phrase", phrase)
      .put("days", org.json.JSONArray(days))
    prefs.edit().putString(id, item.toString()).apply()
  }

  private fun cancelStored(context: Context, id: String) {
    val prefs = context.getSharedPreferences("wakeword-native-alarms", Context.MODE_PRIVATE)
    val raw = prefs.getString(id, null) ?: return
    val item = org.json.JSONObject(raw)
    val days = item.optJSONArray("days")
    val records = if (days == null || days.length() == 0) listOf(-1) else (0 until days.length()).map { days.getInt(it) }
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (day in records) {
      val requestCode = stableRequestCode(id, day)
      val fire = Intent(context, WakeWordAlarmReceiver::class.java).apply {
        action = "${context.packageName}.WAKEWORD_ALARM"
        data = Uri.parse("wakeword-alarm://$id/$day")
      }
      PendingIntent.getBroadcast(context, requestCode, fire, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)?.let(manager::cancel)
    }
    prefs.edit().remove(id).apply()
  }
}

internal fun stableRequestCodeFor(id: String, day: Int) = 31 * id.hashCode() + day + 1

internal fun nextOccurrenceFor(now: Long, hour: Int, minute: Int, weekdayMondayFirst: Int): Long {
  val cal = Calendar.getInstance().apply {
    timeInMillis = now
    set(Calendar.HOUR_OF_DAY, hour.coerceIn(0, 23))
    set(Calendar.MINUTE, minute.coerceIn(0, 59))
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }
  if (weekdayMondayFirst < 0) {
    if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
    return cal.timeInMillis
  }
  val target = (weekdayMondayFirst + 1) % 7 + 1
  while (cal.get(Calendar.DAY_OF_WEEK) != target || cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
  return cal.timeInMillis
}

internal fun ringIntentFor(context: Context, id: String): Intent {
  val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    ?: Intent(context, Class.forName("${context.packageName}.MainActivity"))
  return launch.apply {
    action = Intent.ACTION_VIEW
    data = Uri.parse("wakeword:///?alarmId=${Uri.encode(id)}")
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
  }
}
