import Capacitor
import Security
import CryptoKit

@objc(SecureStoragePlugin)
public class SecureStoragePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SecureStoragePlugin"
    public let jsName = "SecureStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "encryptString", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decryptString", returnType: CAPPluginReturnPromise)
    ]

    private let keychainService = "com.codeyzer.ekstre.securestorage"
    private let keyAlias = "codeyzer_ekstre_key"

    @objc func encryptString(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.reject("Missing data parameter")
            return
        }

        do {
            let key = try getOrCreateKey()
            let encryptedData = try encrypt(data: data, with: key)
            call.resolve(["encryptedData": encryptedData])
        } catch {
            call.reject("Encryption failed: \(error.localizedDescription)")
        }
    }

    @objc func decryptString(_ call: CAPPluginCall) {
        guard let encryptedData = call.getString("encryptedData") else {
            call.reject("Missing encryptedData parameter")
            return
        }

        do {
            let key = try getOrCreateKey()
            let decryptedData = try decrypt(data: encryptedData, with: key)
            call.resolve(["decryptedData": decryptedData])
        } catch {
            call.reject("Decryption failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Key Management

    private func getOrCreateKey() throws -> SymmetricKey {
        // Keychain'den key'i al
        if let existingKey = retrieveKeyFromKeychain() {
            return existingKey
        }

        // Yeni key oluştur ve kaydet
        let newKey = SymmetricKey(size: .bits256)
        try storeKeyInKeychain(newKey)
        return newKey
    }

    private func retrieveKeyFromKeychain() -> SymmetricKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keyAlias,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let keyData = result as? Data else {
            return nil
        }

        return SymmetricKey(data: keyData)
    }

    private func storeKeyInKeychain(_ key: SymmetricKey) throws {
        let keyData = key.withUnsafeBytes { Data($0) }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keyAlias,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        // Önce varsa sil
        SecItemDelete(query as CFDictionary)

        // Yeni key'i ekle
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "SecureStorage", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Failed to store key in Keychain"])
        }
    }

    // MARK: - Encryption/Decryption

    private func encrypt(data: String, with key: SymmetricKey) throws -> String {
        guard let dataBytes = data.data(using: .utf8) else {
            throw NSError(domain: "SecureStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid UTF-8 string"])
        }

        // AES-GCM şifreleme (CryptoKit)
        let sealedBox = try AES.GCM.seal(dataBytes, using: key)

        guard let combined = sealedBox.combined else {
            throw NSError(domain: "SecureStorage", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to combine sealed box"])
        }

        // Base64 encode (nonce + ciphertext + tag)
        return combined.base64EncodedString()
    }

    private func decrypt(data: String, with key: SymmetricKey) throws -> String {
        guard let combined = Data(base64Encoded: data) else {
            throw NSError(domain: "SecureStorage", code: -3, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 data"])
        }

        // AES-GCM deşifreleme
        let sealedBox = try AES.GCM.SealedBox(combined: combined)
        let decryptedData = try AES.GCM.open(sealedBox, using: key)

        guard let decryptedString = String(data: decryptedData, encoding: .utf8) else {
            throw NSError(domain: "SecureStorage", code: -4, userInfo: [NSLocalizedDescriptionKey: "Failed to decode decrypted data"])
        }

        return decryptedString
    }
}
