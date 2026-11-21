// Famiglia — l'app Android è una finestra a tutto schermo sulla webapp
// https://johannes1979i.github.io/famiglia/ : i dati, le sezioni e gli
// aggiornamenti restano quelli del sito, l'app non va ricompilata quando
// la webapp cambia.
//
// La chiave della famiglia NON sta nel codice: si passa alla compilazione
//   flutter build apk --release --dart-define=CHIAVE=<chiave>
// Senza chiave l'app si apre sulla pagina di benvenuto, dove si incolla il link.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String base = 'https://johannes1979i.github.io/famiglia/';
const String chiave = String.fromEnvironment('CHIAVE');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(0xFF24495B),
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const AppFamiglia());
}

class AppFamiglia extends StatelessWidget {
  const AppFamiglia({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Famiglia',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFF2F5D73), useMaterial3: true),
        home: const Pagina(),
      );
}

class Pagina extends StatefulWidget {
  const Pagina({super.key});
  @override
  State<Pagina> createState() => _PaginaState();
}

class _PaginaState extends State<Pagina> {
  late final WebViewController c;
  bool caricando = true;
  bool senzaRete = false;

  Uri get inizio => Uri.parse('${base}index.html${chiave.isEmpty ? '' : '#k=$chiave'}');

  bool interna(Uri u) =>
      u.host == 'johannes1979i.github.io' && u.path.startsWith('/famiglia');

  @override
  void initState() {
    super.initState();
    c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF5F1EA))
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (req) {
          final u = Uri.tryParse(req.url);
          if (u == null) return NavigationDecision.prevent;
          if (interna(u) || u.scheme == 'about' || u.scheme == 'data') {
            return NavigationDecision.navigate;
          }
          // link delle proposte, WhatsApp, Telegram, telefono, email, mappe:
          // si aprono nell'app giusta del telefono
          if (u.scheme != 'blob') {
            launchUrl(u, mode: LaunchMode.externalApplication);
          }
          return NavigationDecision.prevent;
        },
        onPageStarted: (_) => setState(() => caricando = true),
        onPageFinished: (_) => setState(() => caricando = false),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? false) setState(() => senzaRete = true);
        },
      ))
      ..loadRequest(inizio);
  }

  Future<void> riprova() async {
    setState(() => senzaRete = false);
    await c.loadRequest(inizio);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (giaChiuso, _) async {
        if (giaChiuso) return;
        if (await c.canGoBack()) {
          await c.goBack();
        } else {
          await SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF24495B),
        body: SafeArea(
          bottom: false,
          child: Stack(children: [
            WebViewWidget(controller: c),
            if (caricando)
              const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 3)),
            if (senzaRete)
              Positioned.fill(
                child: Container(
                  color: const Color(0xFFF5F1EA),
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Text('🏡', style: TextStyle(fontSize: 56)),
                    const SizedBox(height: 16),
                    const Text('Niente connessione', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    const Text('Controlla la rete e riprova.', textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    FilledButton(onPressed: riprova, child: const Text('Riprova')),
                  ]),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}
