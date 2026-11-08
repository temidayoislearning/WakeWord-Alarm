package expo.modules.wakewordalarms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

class WakeWordAlarmAudioService : Service() {
  companion object {
    @Volatile var currentAlarmId: String? = null
  }

  private val handler = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var player: MediaPlayer? = null
  private var active = false
  private var phrase = ""
  private var delayMs = 900L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val id = intent?.getStringExtra("alarmId") ?: run { stopSelf(); return START_NOT_STICKY }
    if (active && currentAlarmId == id) return START_NOT_STICKY
    stopAudio()
    currentAlarmId = id
    active = true
    phrase = intent.getStringExtra("phrase") ?: "Wake up"
    val mode = intent.getStringExtra("voiceMode") ?: "focused"
    val uri = intent.getStringExtra("recordingUri")
    val voiceId = intent.getStringExtra("voiceId")
    val channelId = "wakeword-voice-alarm"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(NotificationChannel(channelId, "Spoken alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Shows the controls for a sounding WakeWord alarm"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null)
      })
    }
    val open = PendingIntent.getActivity(this, id.hashCode(), ringIntentFor(this, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, channelId) else Notification.Builder(this)
    val notification = builder.setSmallIcon(applicationInfo.icon)
      .setContentTitle("WakeWord alarm")
      .setContentText(phrase)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .build()
    startForeground(id.hashCode().let { if (it == 0) 1 else it }, notification)

    if (!uri.isNullOrBlank() && playRecording(uri)) return START_NOT_STICKY
    startSpeech(mode, voiceId)
    return START_NOT_STICKY
  }

  private fun playRecording(uri: String): Boolean {
    return try {
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        setDataSource(this@WakeWordAlarmAudioService, Uri.parse(uri))
        isLooping = true
        prepare()
        start()
      }
      true
    } catch (_: Exception) {
      player?.release()
      player = null
      false
    }
  }

  private fun startSpeech(mode: String, voiceId: String?) {
    val (rate, pitch, delay) = when (mode) {
      "gentle" -> Triple(0.78f, 1.04f, 1500L)
      "energized" -> Triple(1.10f, 1.08f, 650L)
      "urgent" -> Triple(1.18f, 1.02f, 350L)
      "deep" -> Triple(0.88f, 0.82f, 1050L)
      "coach" -> Triple(1.04f, 0.94f, 550L)
      "drill" -> Triple(1.20f, 0.90f, 250L)
      "cheerful" -> Triple(1.02f, 1.14f, 800L)
      "calm" -> Triple(0.82f, 0.94f, 1350L)
      "robotic" -> Triple(0.92f, 0.72f, 700L)
      else -> Triple(0.96f, 1.00f, 900L)
    }
    delayMs = delay
    tts = TextToSpeech(this) { status ->
      if (!active) return@TextToSpeech
      if (status != TextToSpeech.SUCCESS) { playFallback(); return@TextToSpeech }
      tts?.apply {
        language = Locale.US
        // Use only local voices so a wake-up alarm does not depend on connectivity.
        if (!voiceId.isNullOrBlank()) {
          val selected = voices?.firstOrNull { it.name == voiceId && !it.isNetworkConnectionRequired && it.features?.contains("notInstalled") != true }
          if (selected != null) voice = selected
        }
        setSpeechRate(rate)
        setPitch(pitch)
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) {}
          override fun onDone(utteranceId: String?) { handler.postDelayed({ speakAgain() }, delayMs) }
          @Deprecated("Deprecated in Java")
          override fun onError(utteranceId: String?) { handler.post { playFallback() } }
        })
      }
      speakAgain()
    }
  }

  private fun speakAgain() {
    if (active) tts?.speak(phrase, TextToSpeech.QUEUE_FLUSH, null, "wakeword-alarm")
  }

  private fun playFallback() {
    if (!active || player != null) return
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(this@WakeWordAlarmAudioService, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI)
        isLooping = true
        prepare()
        start()
      }
    } catch (_: Exception) {}
  }

  private fun stopAudio() {
    active = false
    handler.removeCallbacksAndMessages(null)
    tts?.stop()
    tts?.shutdown()
    tts = null
    player?.runCatching { stop(); release() }
    player = null
  }

  override fun onDestroy() {
    stopAudio()
    currentAlarmId = null
    super.onDestroy()
  }
}

internal fun startWakeWordAudio(context: Context, id: String, phrase: String, voiceMode: String?, recordingUri: String?, voiceId: String?) {
  val intent = Intent(context, WakeWordAlarmAudioService::class.java).apply {
    putExtra("alarmId", id)
    putExtra("phrase", phrase)
    putExtra("voiceMode", voiceMode)
    putExtra("recordingUri", recordingUri)
    putExtra("voiceId", voiceId)
  }
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
}
