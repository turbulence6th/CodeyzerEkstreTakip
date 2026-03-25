# Proje Genel Bakışı

Bu proje, banka ekstre e-postalarını ve ekran görüntülerini okuyarak kredi kartı son ödeme tarihlerini ve kredi ilk ödeme tarihlerini listeleyen, React/Ionic/Capacitor ile oluşturulmuş bir **Android ve iOS** uygulamasıdır. Önemli ödeme tarihlerini takip etmelerine yardımcı olmak amacıyla Google Takvim ile isteğe bağlı entegrasyon sunar ve finansal takibi otomatikleştirmeyi, manuel veri girişini azaltmayı hedefler.

## Temel Özellikler:
*   **Otomatik Veri Ayrıştırma:** Belirli bankalardan gelen e-postaları (Gmail) (Yapı Kredi, Ziraat Bankası, İş Bankası, Garanti BBVA Bonus, Kuveyt Türk, Akbank, QNB Finansbank) işler. Son ödeme tarihlerini, kredi ödeme tarihlerini ve diğer ilgili finansal bilgileri çıkarır. E-posta ekleri (örn. PDF) ayrıştırılabilir. **Son 2 ay içindeki e-postaları** otomatik olarak tarar (performans ve veri yönetimi için).
*   **OCR ile Ekran Görüntüsü Ayrıştırma:** Banka mobil uygulamalarından alınan ekran görüntülerini okuyarak otomatik ekstre kaydı oluşturur. Android'de Google ML Kit, iOS'te Vision framework kullanılır. Akbank (Akbank, Axess, Wings) kart markaları desteklenir. OCR ile kart numarası, son ödeme tarihi ve ekstre tutarı çıkarılır.
*   **Manuel Giriş:** Otomatik olarak algılanmayan ödeme kayıtlarını manuel olarak eklemeye olanak tanır. Ekran görüntüsünden otomatik form doldurma desteklenir. Desteklenen kayıt türleri: Borç, Harcama, Kredi ve KMH (Kredili Mevduat Hesabı).
*   **KMH Takibi:** Kredili Mevduat Hesabı borçları ayrı bir kayıt türü (`kmh`) olarak takip edilir. KMH kayıtları toplam borç hesaplamasına dahildir. Swipe ile tutar güncellenebilir ve takvim etkinliği otomatik güncellenir.
*   **Birleşik Liste Görünümü:** E-posta, screenshot ve manuel kayıtları tek, düzenli bir listede görüntüler. Swipe ile tutar düzenleme (tutar bilgisi olmayan ekstreler ve KMH kayıtları için), kredi taksit tarihlerini güncelleme, ödendi işaretleme ve silme özellikleri sunar.
*   **Kredi Yönetimi:** Krediler taksitlere bölünür ve `LoanManagementPage` sayfasında detaylı takip edilir. Ödeme ilerleme çubuğu, ödenen/kalan taksit sayısı ve kalan bakiye gösterilir.
*   **Google Entegrasyonu:** Güvenli Google oturum açma (OAuth 2.0 + Firebase Auth) ve ödeme etkinliklerini eklemek/güncellemek için Google Takvim API ile entegrasyon. Gmail API aracılığıyla e-posta ekleri alınabilir ve işlenebilir. Takvim etkinlikleri için benzersiz bir AppID sistemi kullanılır. Tutar güncellendiğinde takvim etkinliği de otomatik güncellenir (`updateCalendarEvent`).
*   **Durum Yönetimi:** Uygulama durumunu (oturum, veriler) yönetmek ve kalıcı hale getirmek için Redux Toolkit ve Redux Persist kullanır. Android'de hassas veriler (`auth`, `data` slice'ları) `redux-persist-transform-encrypt` ile şifrelenir ve anahtar yönetimi native `SecureStorage` ile sağlanır. iOS'te App Sandbox güvenliği yeterli olduğundan şifreleme devre dışıdır. Android otomatik yedekleme devre dışı bırakılmıştır.
*   **Veri İşleme Mantığı:** Krediler taksitlere bölünür ve sadece 1 aylık zaman aralığındaki taksitler ana listede gösterilir. Ödenen kalemler takip edilebilir ve toplam borç hesaplamasına dahil edilmez. Kalemler `'debt'`, `'expense'`, `'loan'` veya `'kmh'` olarak sınıflandırılabilir. Toplam borç hesaplamasında sadece `'debt'` ve `'kmh'` türleri sayılır. Tutar bilgisi olmayan ekstreler için kullanıcı elle tutar girebilir (`userAmount`); toplam borç hesaplamasında `userAmount ?? amount` önceliği uygulanır. Kredi taksitlerinin ödeme tarihleri güncellenebilir. Manuel girişler ile e-posta kayıtları arasında otomatik deduplikasyon yapılır.
*   **Veri Aktarımı:** Ayarlar sayfasından JSON formatında veri dışa aktarma (paylaşma) ve içe aktarma (birleştirme veya değiştirme) desteklenir.
*   **Platform:** Capacitor kullanarak Android ve iOS platformlarını hedefler.

## Kullanılan Teknolojiler:
*   **Frontend:** React (TypeScript), Ionic Framework
*   **Mobil Platform:** Capacitor (Android + iOS)
*   **Durum Yönetimi:** Redux Toolkit, React Redux, Redux Persist, redux-persist-transform-encrypt
*   **API Entegrasyonları:** Google Identity Services, Firebase Auth, Gmail API, Google Calendar API
*   **Yerel Eklentiler (Capacitor):**
    *   **Google Auth** (`@plugins/google-auth`): OAuth, Gmail ve Calendar API erişimi
    *   **PDF Ayrıştırma**: Android'de `PdfParserPlugin.java` (`pdfbox-android`), iOS'te `PdfParserPlugin.swift` (`PDFKit`)
    *   **OCR**: Android'de `OcrPlugin.java` (Google ML Kit), iOS'te `OcrPlugin.swift` (Vision framework)
    *   **Güvenli Depolama**: Android'de `SecureStoragePlugin.java` (Android KeyStore + Tink), iOS'te `SecureStoragePlugin.swift` (Keychain + CryptoKit)
*   **Kimlik Doğrulama:** Google Sign-In SDK + Firebase Auth (her iki platformda)
*   **Test:** Vitest

## Proje Yapısı:

```
.
├── android/                 # Android yerel proje
│   └── app/src/main/java/com/codeyzer/ekstre/
│       ├── GoogleAuthPlugin.java        # Ana plugin (OAuth, Gmail, Calendar delegasyonu)
│       ├── GoogleCalendarHandler.java   # Calendar API (create, search, update)
│       ├── GoogleGmailHandler.java      # Gmail API (search, details, attachment)
│       ├── ErrorUtils.java              # Merkezi hata yönetimi
│       ├── OcrPlugin.java              # Google ML Kit OCR
│       ├── PdfParserPlugin.java        # pdfbox-android PDF ayrıştırma
│       ├── SecureStoragePlugin.java     # Android KeyStore şifreleme
│       └── MainActivity.java
├── ios/                     # iOS yerel proje
│   └── App/App/
│       ├── Plugins/
│       │   ├── GoogleAuth/
│       │   │   ├── GoogleAuthPlugin.swift    # Ana plugin
│       │   │   ├── GoogleAuthPlugin.m        # ObjC bridge
│       │   │   ├── CalendarHandler.swift     # Calendar API (create, search, update)
│       │   │   └── GmailHandler.swift        # Gmail API
│       │   ├── SecureStorage/               # Keychain + CryptoKit
│       │   ├── PdfParser/                   # PDFKit
│       │   └── Ocr/                         # Vision framework
│       ├── AppDelegate.swift
│       └── CustomBridgeViewController.swift  # Plugin registration
├── src/
│   ├── components/          # React bileşenleri
│   │   ├── DisplayItemList.tsx   # Ana liste (swipe actions, ikon/renk yönetimi)
│   │   ├── DetailsModal.tsx      # Kayıt detay modalı
│   │   └── ToastManager.tsx      # Toast bildirim yönetimi
│   ├── hooks/               # Özel React hook'ları
│   │   └── useScreenshotImport.ts
│   ├── pages/               # Sayfa bileşenleri
│   │   ├── AccountTab.tsx        # Ana ekran (liste, takvim, yenileme)
│   │   ├── ManualEntryTab.tsx    # Manuel kayıt formu (borç/harcama/kredi/kmh)
│   │   ├── SettingsTab.tsx       # Ayarlar (çıkış, veri aktarımı)
│   │   ├── LoginPage.tsx         # Giriş sayfası
│   │   └── LoanManagementPage.tsx # Kredi yönetimi (taksit takibi, ilerleme)
│   ├── plugins/             # Capacitor plugin TS tanımları
│   │   ├── google-auth/
│   │   │   ├── definitions.ts    # Tüm plugin arayüzleri (Calendar, Gmail, Auth)
│   │   │   ├── index.ts
│   │   │   └── web.ts           # Web platform mock'ları
│   │   ├── ocr/
│   │   ├── pdf-parser/
│   │   └── secure-storage/
│   ├── services/            # API servisleri ve ayrıştırma mantığı
│   │   ├── index.ts              # Platform-aware servis seçimi (real vs mock)
│   │   ├── calendar.service.ts   # Calendar API (create, search, searchEventDetails, update)
│   │   ├── calendar.service.mock.ts
│   │   ├── gmail.service.ts      # Gmail API
│   │   ├── gmail.service.mock.ts
│   │   ├── ocr.service.ts        # OCR servis katmanı
│   │   ├── bank-registry.ts      # Banka adları, alias'lar ve normalizasyon
│   │   ├── email-parsing/
│   │   │   └── parsers/          # E-posta ayrıştırıcıları (7 banka)
│   │   │       ├── akbank-email-parser.ts
│   │   │       ├── garanti-email-parser.ts
│   │   │       ├── isbank-email-parser.ts
│   │   │       ├── kuveytturk-email-parser.ts
│   │   │       ├── qnb-email-parser.ts
│   │   │       ├── yapikredi-email-parser.ts
│   │   │       └── ziraat-email-parser.ts
│   │   ├── statement-parsing/
│   │   │   ├── types.ts          # ParsedStatement, EmailDetails, ScreenshotDetails, parser arayüzleri
│   │   │   └── statement-processor.ts # Ana pipeline (fetch, parse, deduplicate)
│   │   └── screenshot-parsing/
│   │       ├── parsers/          # Screenshot ayrıştırıcıları
│   │       │   └── akbank-screenshot-parser.ts
│   │       └── screenshot-processor.ts
│   ├── store/               # Redux durum yönetimi
│   │   ├── index.ts              # Store konfigürasyonu (platform-aware şifreleme)
│   │   ├── slices/
│   │   │   ├── authSlice.ts      # Kimlik doğrulama (signIn, signOut, silentSignIn thunk'ları)
│   │   │   ├── dataSlice.ts      # Veri yönetimi (ana slice, selector'lar, thunk'lar)
│   │   │   ├── loadingSlice.ts   # Global yükleme durumu
│   │   │   └── toastSlice.ts     # Bildirim yönetimi
│   │   └── transforms/          # Redux Persist transformları
│   ├── theme/               # Tema ve stil dosyaları (variables.css)
│   ├── types/               # TypeScript tipleri
│   │   └── manual-entry.types.ts # ManualEntry arayüzü (entryType: debt|expense|loan|kmh)
│   ├── utils/               # Yardımcı fonksiyonlar
│   │   ├── formatting.ts        # Tarih, para birimi formatlama, addMonths, isWeekend
│   │   ├── parsing.ts           # Türkçe tarih/sayı ayrıştırma
│   │   ├── typeGuards.ts        # isStatement(), isManualEntry() tip koruyucuları
│   │   ├── identifiers.ts       # AppID oluşturma (takvim benzersizliği)
│   │   ├── bank-entry-format.ts # Banka giriş açıklama formatlama/ayrıştırma
│   │   ├── googleApiClient.ts   # Native Google API çağrı sarmalayıcısı (otomatik retry)
│   │   └── encryptTransform.ts  # Redux Persist şifreleme transform'u
│   ├── App.tsx              # Ana uygulama bileşeni (yönlendirme, sekmeler)
│   └── main.tsx             # Uygulama giriş noktası
├── capacitor.config.ts      # Capacitor yapılandırması (Android + iOS)
├── package.json             # Bağımlılıklar ve script'ler
└── tsconfig.json            # TypeScript yapılandırması
```

# Kurulum ve Çalıştırma

## Ön Koşullar:
*   Node.js ve npm/yarn
*   Android Studio (Android için) ve/veya Xcode (iOS için)

## Kurulum Adımları:

1.  **Depoyu Klonlayın:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```
3.  **Google Cloud Console Kurulumu:**
    *   Bir Google Cloud projesi oluşturun veya mevcut bir projeyi kullanın.
    *   **Gmail API** ve **Google Takvim API**'lerini etkinleştirin.
    *   Bir **OAuth 2.0 İstemci Kimliği** oluşturun:
        *   **Android:** Uygulama türü olarak Android seçin, paket adını `com.codeyzer.ekstre` ile eşleştirin, SHA-1 parmak izini ekleyin.
        *   **iOS:** Uygulama türü olarak iOS seçin, Bundle ID'yi eşleştirin.
        *   **Web:** `serverClientId` olarak kullanılacak bir Web İstemci Kimliği oluşturun.
    *   Firebase projesini yapılandırın ve `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) dosyalarını ekleyin.
4.  **Yerel Projeyi Senkronize Edin:**
    ```bash
    npx cap sync
    ```
5.  **Uygulamayı Çalıştırın:**
    *   **Android:** `npx cap run android` veya Android Studio ile `android/` klasörünü açın.
    *   **iOS:** `npx cap run ios` veya Xcode ile `ios/App/` klasörünü açın. İlk çalıştırmada `cd ios/App && pod install` gerekebilir.

# Geliştirme Kuralları

*   **Dil:** TypeScript (frontend), Java (Android native), Swift (iOS native)
*   **Çerçeveler:** React, Ionic Framework, Capacitor
*   **Durum Yönetimi:** Kalıcı durum için Redux Persist ile Redux Toolkit. Slice'lar `src/store/slices` altında düzenlenmiştir. Android'de `auth`, `data` slice'ları `redux-persist-transform-encrypt` ile şifrelenir; iOS'te App Sandbox güvenliği yeterli olduğundan şifreleme devre dışıdır. Şifreleme anahtarı native `SecureStorage` ile yönetilir. Android'de `android:allowBackup="false"` ayarı aktiftir.
*   **Kod Yapısı:** Özelliğe ve sorumluluğa göre modülerleştirilmiştir (bileşenler, sayfalar, servisler, store, yardımcılar).
*   **Ayrıştırma Mantığı:** Bankaya özel e-posta ayrıştırıcıları `src/services/email-parsing/parsers/` ve screenshot ayrıştırıcıları `src/services/screenshot-parsing/parsers/` altında bulunur. HTML içeriği için regex tabanlı ayrıştırıcılar ve PDF ekleri için native PDF ayrıştırıcı eklentileri mevcuttur. Bazı bankalar farklı kart türleri için farklı e-posta formatları kullanabilir (örn: Garanti BBVA Bonus - Mastercard ve Troy formatları).
*   **Tarih Filtresi:** `statement-processor.ts` içinde e-posta taramaları otomatik olarak son 2 aylık mesajlarla sınırlandırılmıştır (performans optimizasyonu).
*   **Özel Eklentiler:** Google kimlik doğrulaması, PDF ayrıştırma, OCR ve güvenli depolama için özel Capacitor eklentileri kullanılır. Her eklentinin Android (Java) ve iOS (Swift) implementasyonu mevcuttur.
*   **Native API Çağrıları:** Google API'lerine (Gmail, Calendar) erişim tamamen native handler'lar üzerinden yapılır. `googleApiClient.ts` sarmalayıcısı auth hatalarında otomatik silent sign-in retry mekanizması sağlar.
*   **Servis Mock'ları:** Web platformunda çalıştırma için `calendar.service.mock.ts` ve `gmail.service.mock.ts` dosyaları mevcuttur. Platform tespiti `src/services/index.ts` içinde yapılır.
*   **Test:** Vitest, özellikle ayrıştırma mantığı için birim testlerinde kullanılır. Yeni ayrıştırıcılar birim testleri içermelidir.
*   **Stil:** Tema ve stiller `src/theme/` altında yönetilir.

## Veri İşleme Detayları:
*   **Tarih Serileştirme:** Tarihler `Date` nesnelerine ayrıştırılır, Redux durum serileştirmesi için ISO dizelerine dönüştürülür ve bileşen tüketimi için memoize edilmiş seçiciler (`selectAllDataWithDates`) tarafından tekrar `Date` nesnelerine dönüştürülür.
*   **Kayıt Türleri:** `'debt'` (borç), `'expense'` (harcama), `'loan'` (kredi), `'kmh'` (kredili mevduat hesabı). Otomatik (e-posta/screenshot) kayıtlar daima `'debt'` türündedir. `'loan'` türü taksitlere bölünür ve her taksit `'debt'` olarak saklanır.
*   **Toplam Borç:** Sadece `entryType === 'debt'` veya `entryType === 'kmh'` olan ve `isPaid !== true` olan kayıtlar hesaba katılır. Tutar önceliği: `userAmount ?? amount ?? 0`.
*   **Deduplikasyon:** Manuel girişler ile e-posta kayıtları `bankName:last4Digits:dueDate` anahtarıyla eşleştirilir. Eşleşen manuel kayıtlar kaldırılır ve `isPaid` durumu e-posta kaydına aktarılır.
*   **Veri Koruması:** `fetchAndProcessDataThunk` ile veri yenilendiğinde `isPaid` ve `userAmount` değerleri stabil anahtar eşleştirmesiyle korunur.
*   **dataSlice Reducers:** `addManualEntry`, `deleteManualEntry`, `deleteLoan`, `togglePaidStatus`, `setUserAmount`, `clearUserAmount`, `updateItemDueDate`, `updateManualEntryAmount`, `importData`.
*   **dataSlice Selectors:** `selectAllData`, `selectAllDataWithDates` (tarih dönüşümü + taksit filtreleme), `selectTotalDebt`, `selectGroupedLoans` (kredi gruplama ve ilerleme takibi).

## Takvim Entegrasyonu:
*   **AppID Sistemi:** Her kayıt için benzersiz `[AppID: type_bankname_YYYY-MM-DD]` formatında kimlik üretilir.
*   **Etkinlik Oluşturma:** `calendarService.createEvent()` ile takvime eklenir.
*   **Etkinlik Arama:** `calendarService.searchEvents()` (boolean dönüş) ve `calendarService.searchEventDetails()` (eventId dahil detaylı dönüş).
*   **Etkinlik Güncelleme:** `calendarService.updateEvent()` ile mevcut etkinliğin summary/description'ı güncellenebilir. Tutar değiştiğinde takvim otomatik güncellenir.

## Yeni Bir Banka Ekleme:
1.  **Ayrıştırıcı Oluşturma:** `src/services/email-parsing/parsers/` veya `src/services/screenshot-parsing/parsers/` altında yeni bir ayrıştırıcı dosyası geliştirin ve `BankEmailParser` veya `BankScreenshotParser` arayüzünü uygulayın.
2.  **İşlemciye Ekleme:** Yeni ayrıştırıcıyı `src/services/statement-parsing/statement-processor.ts` dosyasına içe aktarın ve Gmail sorgusunu ve ayrıştırıcı örneğini belirterek `availableBankProcessors` dizisine yeni bir banka yapılandırma nesnesi ekleyin.
3.  **Banka Kaydı (Opsiyonel):** Eğer banka adı deduplikasyon veya format eşleştirmesinde kullanılacaksa `src/services/bank-registry.ts` dosyasına ekleyin.
4.  **Test Yazma:** Yeni ayrıştırıcı için `__tests__` dizini altında Vitest ile birim testleri oluşturun.
    *   **Not:** Test mock'larında tarih kullanırken, dinamik tarihler kullanın (son 2 ay filtresi aktif olduğundan). Statik tarihler yerine `new Date()` ile hesaplanan dinamik tarihler testlerin her zaman geçmesini sağlar.
5.  **Çoklu Format Desteği:** Eğer banka farklı kart türleri için farklı HTML formatları kullanıyorsa (örn: Mastercard vs Troy), parser'da her iki formatı da destekleyen regex pattern'leri yazın ve her format için ayrı mock dosyası ve test case'i oluşturun.

# Gelecek Geliştirmeler

*   **Redux'ta E-posta Veri Depolamasını Optimize Etme:** `dataSlice` içinde saklanan `EmailDetails` objelerinden `originalResponse` alanını kaldırmayı veya sadece gerekli minimum bilgiyi saklayacak şekilde yeniden yapılandırmayı değerlendirin.
*   **Gizlilik Politikası URL'si Sağlama:** Google Play Store ve App Store politikalarına uymak için gizlilik politikası metni oluşturulmalı, web üzerinde barındırılmalı ve mağaza konsollarına eklenmelidir.
*   **Daha Fazla Screenshot Parser:** Diğer bankalar için screenshot parser'lar eklenebilir (şu an sadece Akbank destekleniyor).
*   **KMH Genişletme:** KMH için limit takibi, faiz hesaplaması ve banka e-postalarından otomatik ayrıştırma eklenebilir.
