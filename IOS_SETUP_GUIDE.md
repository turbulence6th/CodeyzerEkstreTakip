# iOS Manuel Kurulum Rehberi

Bu rehber, iOS entegrasyonunu tamamlamak için yapılması gereken manuel adımları detaylı olarak açıklamaktadır.

---

## Gereksinimler

- macOS bilgisayar
- Xcode 15 veya üzeri (App Store'dan indirin)
- Apple Developer hesabı (https://developer.apple.com)
- Google Cloud Console hesabı (https://console.cloud.google.com)
- Firebase Console hesabı (https://console.firebase.google.com)
- CocoaPods kurulu olmalı (`sudo gem install cocoapods`)

---

## Adım 1: Firebase iOS Uygulaması Oluşturma

### 1.1 Firebase Console'a Gidin
1. https://console.firebase.google.com adresine gidin
2. Mevcut projenizi seçin (Android için kullandığınız aynı proje)

### 1.2 iOS Uygulaması Ekleyin
1. Proje genel bakış sayfasında **"Uygulama ekle"** butonuna tıklayın
2. **iOS** simgesini seçin

### 1.3 iOS Uygulama Bilgilerini Girin
```
Apple paket kimliği: com.codeyzer.ekstre
Uygulama takma adı: Codeyzer Ekstre Takip (isteğe bağlı)
App Store Kimliği: (boş bırakın, henüz yayınlanmadı)
```

### 1.4 GoogleService-Info.plist Dosyasını İndirin
1. **"Yapılandırma dosyasını indir"** butonuna tıklayın
2. `GoogleService-Info.plist` dosyası indirilecek
3. Bu dosyayı **şu klasöre kopyalayın**:
   ```
   /Users/turbu/Projeler/CodeyzerEkstreTakip/ios/App/App/GoogleService-Info.plist
   ```

### 1.5 Firebase SDK Kurulumunu Atlayın
- Firebase SDK zaten Podfile'da tanımlı
- **"İleri"** butonuna tıklayarak devam edin
- **"Konsola devam et"** butonuna tıklayın

---

## Adım 2: Google Cloud Console - iOS OAuth Client ID Oluşturma

### 2.1 Google Cloud Console'a Gidin
1. https://console.cloud.google.com adresine gidin
2. Üst menüden mevcut projenizi seçin (Firebase ile aynı proje)

### 2.2 APIs & Services > Credentials Bölümüne Gidin
1. Sol menüden **"APIs & Services"** > **"Credentials"** seçin
2. Veya doğrudan: https://console.cloud.google.com/apis/credentials

### 2.3 OAuth 2.0 Client ID Oluşturun
1. **"+ CREATE CREDENTIALS"** butonuna tıklayın
2. **"OAuth client ID"** seçin

### 2.4 Uygulama Türünü Seçin
1. Application type: **iOS** seçin

### 2.5 iOS Client ID Bilgilerini Doldurun
```
Name: Codeyzer Ekstre Takip iOS
Bundle ID: com.codeyzer.ekstre
App Store ID: (boş bırakın)
Team ID: (Adım 3'te bulacaksınız, şimdilik boş bırakabilirsiniz)
```

### 2.6 Client ID'yi Kaydedin
1. **"CREATE"** butonuna tıklayın
2. Açılan pencerede **iOS Client ID** değerini kopyalayın
   - Format: `XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`
3. Bu değeri not edin, Adım 4'te kullanacaksınız

---

## Adım 3: Apple Developer - Team ID Bulma

### 3.1 Apple Developer Hesabına Gidin
1. https://developer.apple.com/account adresine gidin
2. Apple ID ile giriş yapın

### 3.2 Membership Sayfasına Gidin
1. Sol menüden **"Membership details"** seçin
2. Veya: https://developer.apple.com/account/#!/membership

### 3.3 Team ID'yi Kopyalayın
1. **"Team ID"** değerini bulun (10 karakterli alfanumerik kod)
   - Örnek: `ABCD1234EF`
2. Bu değeri not edin

### 3.4 Google Cloud Console'da Team ID Ekleyin (Opsiyonel)
1. Google Cloud Console'a geri dönün
2. Oluşturduğunuz iOS OAuth Client ID'yi düzenleyin
3. Team ID alanına değeri yapıştırın
4. Kaydedin

---

## Adım 4: Info.plist - URL Scheme Güncelleme

### 4.1 Info.plist Dosyasını Açın
Dosya konumu:
```
/Users/turbu/Projeler/CodeyzerEkstreTakip/ios/App/App/Info.plist
```

### 4.2 Google Sign-In URL Scheme'i Güncelleyin
Dosyada şu satırı bulun:
```xml
<string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
```

Bu satırı, Google Cloud Console'dan aldığınız iOS Client ID ile değiştirin:
```xml
<string>com.googleusercontent.apps.XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</string>
```

**Örnek:**
```xml
<!-- Önceki (placeholder) -->
<string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>

<!-- Sonraki (gerçek değer) -->
<string>com.googleusercontent.apps.1008857567754-abcdef123456789abcdef123456789ab</string>
```

### 4.3 Dosyayı Kaydedin

---

## Adım 5: Xcode'da Proje Açma ve Yapılandırma

### 5.1 Xcode'da Projeyi Açın
Terminal'de şu komutu çalıştırın:
```bash
cd /Users/turbu/Projeler/CodeyzerEkstreTakip
npx cap open ios
```

Veya Finder'dan açın:
```
/Users/turbu/Projeler/CodeyzerEkstreTakip/ios/App/App.xcworkspace
```

> **ÖNEMLİ:** `.xcodeproj` değil, `.xcworkspace` dosyasını açın!

### 5.2 GoogleService-Info.plist Dosyasını Projeye Ekleyin
1. Xcode'da sol panelde **"App"** klasörüne sağ tıklayın
2. **"Add Files to 'App'..."** seçin
3. `GoogleService-Info.plist` dosyasını seçin
4. Seçenekleri kontrol edin:
   - [x] Copy items if needed
   - [x] Create folder references
   - Target Membership: [x] App
5. **"Add"** butonuna tıklayın

### 5.3 Signing & Capabilities Ayarları
1. Sol panelde **"App"** projesine tıklayın (mavi ikon)
2. Ortada **"Signing & Capabilities"** sekmesini seçin
3. **TARGETS** altında **"App"** seçili olmalı

#### Team Seçimi
1. **Team** dropdown'ından Apple Developer hesabınızı seçin
2. Eğer hesabınız listede yoksa:
   - Xcode > Settings > Accounts
   - **"+"** butonuna tıklayın
   - Apple ID ile giriş yapın

#### Bundle Identifier Kontrolü
```
Bundle Identifier: com.codeyzer.ekstre
```
Bu değerin doğru olduğundan emin olun.

#### Automatically manage signing
- [x] **Automatically manage signing** seçeneği işaretli olmalı

### 5.4 Provisioning Profile Oluşturulması
Xcode otomatik olarak provisioning profile oluşturacaktır. Eğer hata alırsanız:
1. **"Try Again"** butonuna tıklayın
2. Veya Team'i değiştirip tekrar seçin

---

## Adım 6: Plugin Dosyalarını Xcode Projesine Ekleme

### 6.1 Plugin Klasörünü Projeye Dahil Edin
1. Xcode'da sol panelde **"App"** klasörüne sağ tıklayın
2. **"Add Files to 'App'..."** seçin
3. Şu klasörü seçin:
   ```
   ios/App/App/Plugins
   ```
4. Seçenekleri kontrol edin:
   - [x] Copy items if needed (işaretli DEĞİL olmalı - dosyalar zaten yerinde)
   - [x] Create groups
   - Target Membership: [x] App
5. **"Add"** butonuna tıklayın

### 6.2 Plugin Dosyalarının Görünür Olduğunu Doğrulayın
Sol panelde şu yapıyı görmelisiniz:
```
App/
├── Plugins/
│   ├── GoogleAuth/
│   │   ├── GoogleAuthPlugin.swift
│   │   ├── GoogleAuthPlugin.m
│   │   ├── GmailHandler.swift
│   │   └── CalendarHandler.swift
│   ├── Ocr/
│   │   ├── OcrPlugin.swift
│   │   └── OcrPlugin.m
│   ├── PdfParser/
│   │   ├── PdfParserPlugin.swift
│   │   └── PdfParserPlugin.m
│   ├── SecureStorage/
│   │   ├── SecureStoragePlugin.swift
│   │   └── SecureStoragePlugin.m
│   └── SmsReader/
│       ├── SmsReaderPlugin.swift
│       └── SmsReaderPlugin.m
```

---

## Adım 7: Build ve Test

### 7.1 Simulator'da Test
1. Xcode'da üst menüden bir simulator seçin:
   - **iPhone 15 Pro** veya benzeri
2. **Play (▶)** butonuna tıklayın veya `Cmd + R` tuşlarına basın
3. Build işleminin tamamlanmasını bekleyin

### 7.2 Olası Build Hataları ve Çözümleri

#### Hata: "No such module 'GoogleSignIn'"
**Çözüm:**
```bash
cd /Users/turbu/Projeler/CodeyzerEkstreTakip/ios/App
pod install --repo-update
```
Xcode'u kapatıp `.xcworkspace` dosyasını tekrar açın.

#### Hata: "Signing certificate issues"
**Çözüm:**
1. Xcode > Settings > Accounts
2. Apple ID'nizi seçin
3. **"Manage Certificates..."** butonuna tıklayın
4. **"+"** > **"Apple Development"** seçin

#### Hata: "Firebase configuration not found"
**Çözüm:**
`GoogleService-Info.plist` dosyasının:
- Doğru konumda olduğunu kontrol edin
- Xcode projesine eklendiğini kontrol edin (sol panelde görünmeli)

### 7.3 Gerçek Cihazda Test
1. iPhone'unuzu Mac'e USB ile bağlayın
2. iPhone'da **"Bu Bilgisayara Güven"** seçeneğini onaylayın
3. Xcode'da cihazınızı seçin (üst menüde simulator yerine)
4. **Play (▶)** butonuna tıklayın

> **Not:** Gerçek cihazda test için ücretli Apple Developer hesabı gerekebilir.

---

## Adım 8: Google Sign-In Testi

### 8.1 Uygulamayı Başlatın
1. Uygulama açıldığında login sayfasını görmelisiniz

### 8.2 Google ile Giriş Yapın
1. **"Google ile Giriş Yap"** butonuna tıklayın
2. Google hesabı seçim ekranı açılmalı
3. Bir hesap seçin
4. İzinleri onaylayın (Gmail ve Calendar erişimi)

### 8.3 Başarılı Giriş Kontrolü
- Kullanıcı bilgileri görüntülenmeli
- E-posta ekstreleri çekilebilmeli
- Takvim etkinlikleri oluşturulabilmeli

---

## Adım 9: App Store Hazırlığı (İsteğe Bağlı)

### 9.1 App Icons
1. 1024x1024 boyutunda uygulama ikonu hazırlayın
2. https://appicon.co sitesinde tüm boyutları oluşturun
3. Xcode'da Assets.xcassets > AppIcon'a sürükleyin

### 9.2 Launch Screen
1. `ios/App/App/Base.lproj/LaunchScreen.storyboard` dosyasını düzenleyin
2. Logo ve arka plan ekleyin

### 9.3 App Store Connect
1. https://appstoreconnect.apple.com adresine gidin
2. Yeni uygulama oluşturun
3. Bundle ID: `com.codeyzer.ekstre`
4. Uygulama bilgilerini doldurun

### 9.4 TestFlight
1. Xcode'da **Product > Archive** seçin
2. Organizer'da oluşan archive'ı seçin
3. **"Distribute App"** > **"App Store Connect"** seçin
4. Upload tamamlandıktan sonra TestFlight'ta test edin

---

## Sorun Giderme

### Pod Install Hataları
```bash
cd /Users/turbu/Projeler/CodeyzerEkstreTakip/ios/App
rm -rf Pods Podfile.lock
pod cache clean --all
pod install --repo-update
```

### Xcode Cache Temizleme
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```
Xcode'u yeniden başlatın.

### Capacitor Sync
```bash
cd /Users/turbu/Projeler/CodeyzerEkstreTakip
npm run build
npx cap sync ios
```

### Google Sign-In Çalışmıyor
1. `GoogleService-Info.plist` dosyasının doğru konumda olduğunu kontrol edin
2. Info.plist'teki URL scheme'in doğru olduğunu kontrol edin
3. Bundle ID'nin Google Cloud Console'daki ile eşleştiğini kontrol edin

---

## Özet Kontrol Listesi

- [ ] Firebase Console'da iOS uygulaması oluşturuldu
- [ ] `GoogleService-Info.plist` indirildi ve kopyalandı
- [ ] Google Cloud Console'da iOS OAuth Client ID oluşturuldu
- [ ] Info.plist'te URL scheme güncellendi
- [ ] Xcode'da proje açıldı (`.xcworkspace`)
- [ ] `GoogleService-Info.plist` Xcode projesine eklendi
- [ ] Signing & Capabilities yapılandırıldı
- [ ] Plugin klasörü Xcode projesine eklendi
- [ ] Build başarılı
- [ ] Simulator'da test edildi
- [ ] Google Sign-In çalışıyor

---

## Dosya Konumları Özeti

| Dosya | Konum |
|-------|-------|
| GoogleService-Info.plist | `ios/App/App/GoogleService-Info.plist` |
| Info.plist | `ios/App/App/Info.plist` |
| Xcode Workspace | `ios/App/App.xcworkspace` |
| Podfile | `ios/App/Podfile` |
| Plugin'ler | `ios/App/App/Plugins/` |

---

*Bu rehber Codeyzer Ekstre Takip uygulamasının iOS entegrasyonu için hazırlanmıştır.*
