package it.zarletti.famiglia

import android.content.Intent
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/* Riceve i link condivisi verso «Famiglia» (per esempio dall'app Amazon:
   Condividi → Famiglia) e li passa alla parte Flutter, che li consegna
   alla pagina dei regali. */
class MainActivity : FlutterActivity() {
    private var canale: MethodChannel? = null
    private var inSospeso: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        inSospeso = testoCondiviso(intent)
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        canale = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "famiglia/condividi").also {
            it.setMethodCallHandler { call, result ->
                if (call.method == "iniziale") { result.success(inSospeso); inSospeso = null }
                else result.notImplemented()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val t = testoCondiviso(intent) ?: return
        canale?.invokeMethod("nuovo", t)
    }

    private fun testoCondiviso(i: Intent?): String? {
        if (i?.action != Intent.ACTION_SEND) return null
        val testo = i.getStringExtra(Intent.EXTRA_TEXT) ?: return null
        val titolo = i.getStringExtra(Intent.EXTRA_SUBJECT)
        return if (!titolo.isNullOrBlank() && !testo.contains(titolo)) "$titolo $testo" else testo
    }
}
