package expo.modules.lynxtones

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Bips de resultado del escáner con ToneGenerator: sin archivos de sonido ni
// dependencias. Suena por el canal de notificaciones, así que sigue el
// volumen de notificaciones y no suena con el teléfono en silencio o en
// vibración (además se chequea el modo de timbre explícitamente).
class LynxTonesModule : Module() {
  private var generator: ToneGenerator? = null

  override fun definition() = ModuleDefinition {
    Name("LynxTones")

    // No bloquea: startTone vuelve enseguida y un tono nuevo corta al anterior.
    Function("play") { kind: String ->
      val context = appContext.reactContext ?: return@Function false
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (audio?.ringerMode != AudioManager.RINGER_MODE_NORMAL) return@Function false
      val (tone, durationMs) = when (kind) {
        "success" -> ToneGenerator.TONE_PROP_BEEP to 120
        "error" -> ToneGenerator.TONE_PROP_NACK to 350
        else -> return@Function false
      }
      try {
        val g = generator ?: ToneGenerator(AudioManager.STREAM_NOTIFICATION, ToneGenerator.MAX_VOLUME).also { generator = it }
        g.startTone(tone, durationMs)
      } catch (e: RuntimeException) {
        // Sin recursos de audio disponibles: el escaneo sigue sin sonido.
        generator?.release()
        generator = null
        false
      }
    }

    OnDestroy {
      generator?.release()
      generator = null
    }
  }
}
