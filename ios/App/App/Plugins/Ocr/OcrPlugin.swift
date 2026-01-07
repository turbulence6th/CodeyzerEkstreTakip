import Capacitor
import Vision
import UIKit

@objc(OcrPlugin)
public class OcrPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "OcrPlugin"
    public let jsName = "Ocr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let imageSource = call.getString("imageSource") else {
            call.reject("Missing imageSource parameter")
            return
        }

        let sourceType = call.getString("sourceType") ?? "path"

        // Görüntüyü yükle
        loadImage(from: imageSource, sourceType: sourceType) { [weak self] result in
            switch result {
            case .success(let image):
                self?.performOCR(on: image, call: call)
            case .failure(let error):
                call.resolve([
                    "success": false,
                    "text": "",
                    "error": error.localizedDescription
                ])
            }
        }
    }

    private func loadImage(from source: String, sourceType: String, completion: @escaping (Result<UIImage, Error>) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            if sourceType == "base64" {
                // Base64'ten yükle (URL-safe base64 desteği)
                var cleanBase64 = source
                    .replacingOccurrences(of: "-", with: "+")
                    .replacingOccurrences(of: "_", with: "/")

                // Padding ekle
                let remainder = cleanBase64.count % 4
                if remainder > 0 {
                    cleanBase64 += String(repeating: "=", count: 4 - remainder)
                }

                guard let imageData = Data(base64Encoded: cleanBase64),
                      let image = UIImage(data: imageData) else {
                    DispatchQueue.main.async {
                        completion(.failure(NSError(domain: "OcrPlugin", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 image data"])))
                    }
                    return
                }
                DispatchQueue.main.async {
                    completion(.success(image))
                }
            } else {
                // File path'ten yükle
                var imageToReturn: UIImage?

                if source.hasPrefix("file://") {
                    if let url = URL(string: source),
                       let imageData = try? Data(contentsOf: url),
                       let image = UIImage(data: imageData) {
                        imageToReturn = image
                    }
                } else if source.hasPrefix("content://") {
                    // Android content URI - iOS'ta geçersiz
                    DispatchQueue.main.async {
                        completion(.failure(NSError(domain: "OcrPlugin", code: -2, userInfo: [NSLocalizedDescriptionKey: "Android content URI not supported on iOS"])))
                    }
                    return
                } else if source.hasPrefix("/") {
                    // Absolute file path
                    if let image = UIImage(contentsOfFile: source) {
                        imageToReturn = image
                    }
                } else if source.hasPrefix("http://") || source.hasPrefix("https://") {
                    // URL'den yükle
                    if let url = URL(string: source),
                       let imageData = try? Data(contentsOf: url),
                       let image = UIImage(data: imageData) {
                        imageToReturn = image
                    }
                }

                DispatchQueue.main.async {
                    if let image = imageToReturn {
                        completion(.success(image))
                    } else {
                        completion(.failure(NSError(domain: "OcrPlugin", code: -3, userInfo: [NSLocalizedDescriptionKey: "Failed to load image from path: \(source)"])))
                    }
                }
            }
        }
    }

    private func performOCR(on image: UIImage, call: CAPPluginCall) {
        guard let cgImage = image.cgImage else {
            call.resolve([
                "success": false,
                "text": "",
                "error": "Failed to convert image to CGImage"
            ])
            return
        }

        let request = VNRecognizeTextRequest { [weak self] request, error in
            self?.handleOCRResult(request: request, error: error, call: call)
        }

        // OCR ayarları
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["tr-TR", "en-US"]
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async {
                    call.resolve([
                        "success": false,
                        "text": "",
                        "error": "OCR failed: \(error.localizedDescription)"
                    ])
                }
            }
        }
    }

    private func handleOCRResult(request: VNRequest, error: Error?, call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let error = error {
                call.resolve([
                    "success": false,
                    "text": "",
                    "error": error.localizedDescription
                ])
                return
            }

            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve([
                    "success": false,
                    "text": "",
                    "error": "No text observations found"
                ])
                return
            }

            if observations.isEmpty {
                call.resolve([
                    "success": true,
                    "text": "",
                    "metadata": [
                        "blocks": [],
                        "blockCount": 0
                    ]
                ])
                return
            }

            var fullText = ""
            var blocks: [[String: Any]] = []

            for observation in observations {
                guard let topCandidate = observation.topCandidates(1).first else { continue }

                fullText += topCandidate.string + "\n"

                // Bounding box bilgisi (Vision framework koordinatları normalize edilmiş)
                let boundingBox = observation.boundingBox
                blocks.append([
                    "text": topCandidate.string,
                    "confidence": topCandidate.confidence,
                    "boundingBox": [
                        "left": boundingBox.origin.x,
                        "top": 1 - boundingBox.origin.y - boundingBox.height,  // Y koordinatı dönüşümü
                        "width": boundingBox.width,
                        "height": boundingBox.height
                    ]
                ])
            }

            call.resolve([
                "success": true,
                "text": fullText.trimmingCharacters(in: .whitespacesAndNewlines),
                "metadata": [
                    "blocks": blocks,
                    "blockCount": blocks.count
                ]
            ])
        }
    }
}
