import Capacitor
import PDFKit

@objc(PdfParserPlugin)
public class PdfParserPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PdfParserPlugin"
    public let jsName = "PdfParser"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "parsePdfText", returnType: CAPPluginReturnPromise)
    ]

    @objc func parsePdfText(_ call: CAPPluginCall) {
        guard let base64Data = call.getString("base64Data") else {
            call.reject("Missing base64Data parameter")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            // Base64 decode (URL-safe base64 desteği)
            var cleanBase64 = base64Data
                .replacingOccurrences(of: "-", with: "+")
                .replacingOccurrences(of: "_", with: "/")

            // Padding ekle
            let remainder = cleanBase64.count % 4
            if remainder > 0 {
                cleanBase64 += String(repeating: "=", count: 4 - remainder)
            }

            guard let pdfData = Data(base64Encoded: cleanBase64) else {
                DispatchQueue.main.async {
                    call.resolve(["error": "Invalid base64 data"])
                }
                return
            }

            // PDFDocument oluştur
            guard let pdfDocument = PDFDocument(data: pdfData) else {
                DispatchQueue.main.async {
                    call.resolve(["error": "Failed to load PDF document"])
                }
                return
            }

            // Şifreli PDF kontrolü
            if pdfDocument.isEncrypted && pdfDocument.isLocked {
                DispatchQueue.main.async {
                    call.resolve(["error": "PDF is encrypted and cannot be processed"])
                }
                return
            }

            // Tüm sayfalardan metin çıkar
            var fullText = ""
            for pageIndex in 0..<pdfDocument.pageCount {
                if let page = pdfDocument.page(at: pageIndex),
                   let pageContent = page.string {
                    fullText += pageContent + "\n"
                }
            }

            DispatchQueue.main.async {
                if fullText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    // Metin çıkarılamadı - muhtemelen taranmış PDF
                    // OCR gerekebilir
                    call.resolve(["error": "No text could be extracted from PDF. The PDF might be scanned/image-based."])
                } else {
                    call.resolve(["text": fullText])
                }
            }
        }
    }
}
