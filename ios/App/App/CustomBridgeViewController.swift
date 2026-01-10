import UIKit
import Capacitor

class CustomBridgeViewController: CAPBridgeViewController {

    private var lastBounds: CGRect = .zero

    override func viewDidLoad() {
        super.viewDidLoad()

        // WebView tam ekran, safe area CSS ile yönetilecek
        view.backgroundColor = UIColor.systemBackground

        // WebView'ı tam ekran yap (safe area dahil)
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()

        // Layout döngüsünü önlemek için bounds değişmemişse çık
        guard view.bounds != lastBounds else { return }
        lastBounds = view.bounds

        // WebView'ı tam ekran yap
        webView?.frame = view.bounds
    }

    override open func capacitorDidLoad() {
        // Bridge hazır olduğunda plugin'leri register et
        bridge?.registerPluginInstance(SecureStoragePlugin())
        bridge?.registerPluginInstance(GoogleAuthPlugin())
        bridge?.registerPluginInstance(PdfParserPlugin())
        bridge?.registerPluginInstance(OcrPlugin())

        print("[CustomBridgeViewController] All plugins registered")
    }
}
