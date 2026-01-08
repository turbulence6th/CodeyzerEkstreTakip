import Capacitor

/// SmsReaderPlugin - iOS Implementation
///
/// IMPORTANT: iOS does not provide an API to read SMS messages.
/// This is a platform limitation enforced by Apple for privacy and security reasons.
///
/// This plugin implementation returns appropriate errors to inform the TypeScript
/// layer that SMS reading is not available on iOS.
///
/// Alternative approaches for iOS users:
/// 1. Use Gmail integration for bank notifications
/// 2. Manual entry of statement information
/// 3. Screenshot OCR feature
@objc(SmsReaderPlugin)
public class SmsReaderPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SmsReaderPlugin"
    public let jsName = "SmsReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMessages", returnType: CAPPluginReturnPromise)
    ]

    private let platformNotSupportedMessage = "SMS reading is not available on iOS. Apple does not provide an API to read SMS messages for privacy and security reasons. Please use email notifications or manual entry."
    private let platformNotSupportedCode = "PLATFORM_NOT_SUPPORTED"

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        // iOS'ta SMS izni kavramı yok - her zaman "denied" döner
        call.resolve([
            "readSms": "denied",
            "platform": "ios",
            "message": platformNotSupportedMessage
        ])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        // iOS'ta SMS izni istenemez
        call.reject(
            platformNotSupportedMessage,
            platformNotSupportedCode,
            nil,
            [
                "platform": "ios",
                "suggestion": "Use Gmail integration for bank notifications or enter statement information manually."
            ]
        )
    }

    @objc func getMessages(_ call: CAPPluginCall) {
        // iOS'ta SMS mesajları okunamaz
        call.reject(
            platformNotSupportedMessage,
            platformNotSupportedCode,
            nil,
            [
                "platform": "ios",
                "suggestion": "Use Gmail integration for bank notifications or enter statement information manually."
            ]
        )
    }
}
