import UIKit
import Capacitor

class CustomBridgeViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        // Bridge hazır olduğunda plugin'leri register et
        bridge?.registerPluginInstance(SecureStoragePlugin())
        bridge?.registerPluginInstance(GoogleAuthPlugin())
        bridge?.registerPluginInstance(PdfParserPlugin())
        bridge?.registerPluginInstance(OcrPlugin())
        bridge?.registerPluginInstance(SmsReaderPlugin())

        print("[CustomBridgeViewController] All plugins registered")
    }
}
