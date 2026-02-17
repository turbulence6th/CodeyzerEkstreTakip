# Proje Genel Bakışı

Bu proje, banka ekstre e-postalarını ve ekran görüntülerini okuyarak kredi kartı son ödeme tarihlerini ve kredi ilk ödeme tarihlerini listeleyen, React/Ionic/Capacitor ile oluşturulmuş bir Android uygulamasıdır. Önemli ödeme tarihlerini takip etmelerine yardımcı olmak amacıyla Google Takvim ile isteğe bağlı entegrasyon sunar ve finansal takibi otomatikleştirmeyi, manuel veri girişini azaltmayı hedefler.

## Temel Özellikler:
*   **Otomatik Veri Ayrıştırma:** Belirli bankalardan gelen e-postaları (Gmail) (Yapı Kredi, Ziraat Bankası, İş Bankası, Garanti BBVA Bonus, Kuveyt Türk, Akbank, QNB Finansbank) işler. Son ödeme tarihlerini, kredi ödeme tarihlerini ve diğer ilgili finansal bilgileri çıkarır. E-posta ekleri (örn. PDF) ayrıştırılabilir. **Son 2 ay içindeki e-postaları** otomatik olarak tarar (performans ve veri yönetimi için).
*   **OCR ile Ekran Görüntüsü Ayrıştırma:** Banka mobil uygulamalarından alınan ekran görüntülerini Google ML Kit ile okuyarak otomatik ekstre kaydı oluşturur. Akbank (Akbank, Axess, Wings) kart markaları desteklenir. OCR ile kart numarası, son ödeme tarihi ve ekstre tutarı çıkarılır.
*   **Manuel Giriş:** Otomatik olarak algılanmayan ödeme kayıtlarını manuel olarak eklemeye olanak tanır. Ekran görüntüsünden otomatik form doldurma desteklenir.
*   **Birleşik Liste Görünümü:** E-posta, screenshot ve manuel kayıtları tek, düzenli bir listede görüntüler. Swipe ile tutar düzenleme (tutar bilgisi olmayan ekstreler için `userAmount`) ve kredi taksit tarihlerini güncelleme özellikleri sunar.
*   **Google Entegrasyonu:** Güvenli Google oturum açma (OAuth 2.0) ve ödeme etkinliklerini eklemek için Google Takvim API ile entegrasyon. Gmail API aracılığıyla e-posta ekleri alınabilir ve işlenebilir. Takvim etkinlikleri için benzersiz bir AppID sistemi kullanılır.
*   **Durum Yönetimi:** Uygulama durumunu (oturum, veriler) yönetmek ve kalıcı hale getirmek için Redux Toolkit ve Redux Persist kullanır. Hassas veriler (`auth`, `data` slice'ları) `redux-persist-transform-encrypt` ile şifrelenir ve anahtar yönetimi native `SecureStorage` ile sağlanır. Android otomatik yedekleme devre dışı bırakılmıştır.
*   **Veri İşleme Mantığı:** Krediler taksitlere bölünür ve sadece belirli bir zaman aralığındaki taksitler gösterilir. Ödenen kalemler takip edilebilir ve toplam borç hesaplamasına dahil edilmez. Kalemler 'borç' veya 'harcama' olarak sınıflandırılabilir. Tutar bilgisi olmayan ekstreler için kullanıcı elle tutar girebilir (`userAmount`); toplam borç hesaplamasında `userAmount ?? amount` önceliği uygulanır. Kredi taksitlerinin ödeme tarihleri güncellenebilir ve güncelleme sonrası liste otomatik yeniden sıralanır.
*   **Platform:** Başlıca Capacitor kullanarak Android platformunu hedefler.

## Kullanılan Teknolojiler:
*   **Frontend:** React (TypeScript), Ionic Framework
*   **Mobil Platform:** Capacitor
*   **Durum Yönetimi:** Redux Toolkit, React Redux, Redux Persist, redux-persist-transform-encrypt
*   **API Entegrasyonları:** Google Identity Services (Web), Google People API, Gmail API, Google Calendar API
*   **Yerel Eklentiler (Capacitor):** Google kimlik doğrulaması (`@plugins/google-auth`), PDF ayrıştırma (`PdfParserPlugin.java` - `com.tom-roush:pdfbox-android` kütüphanesini kullanır) ve OCR (`OcrPlugin.java` - Google ML Kit Text Recognition kullanır) gibi yerel işlevler için özel Capacitor eklentileri.
*   **Test:** Vitest

## Proje Yapısı:

```
.
├── android/             # Android yerel proje
├── node_modules/        # Proje bağımlılıkları
├── public/              # Statik varlıklar
├── src/
│   ├── components/      # Tekrar kullanılabilir React bileşenleri (DisplayItemList, DetailsModal, ToastManager)
│   ├── hooks/           # Özel React hook'ları (useScreenshotImport)
│   ├── pages/           # Ana sayfa/sekme bileşenleri (AccountTab, ManualEntryTab, SettingsTab, LoginPage, LoanManagementPage)
│   ├── plugins/         # Capacitor yerel eklenti tanımları (google-auth, ocr, pdf-parser, secure-storage)
│   ├── services/        # API servisleri (gmail, calendar), ayrıştırma mantığı (statement-parsing, email-parsing, screenshot-parsing)
│   │   ├── email-parsing/
│   │   │   └── parsers/ # E-posta ayrıştırıcıları (ziraat, yapikredi, garanti, kuveytturk, akbank, isbank, qnb)
│   │   ├── statement-parsing/
│   │   │   ├── types.ts # Ortak veri tipleri
│   │   │   └── statement-processor.ts # E-posta ve Screenshot verilerini işleyen ana servis
│   │   └── screenshot-parsing/
│   │       ├── parsers/ # Screenshot ayrıştırıcıları (akbank)
│   │       └── screenshot-processor.ts # Screenshot verilerini yönlendiren servis
│   ├── store/           # Redux durum yönetimi (slices, store, transforms)
│   │   ├── slices/      # Redux slice'ları (auth, data, loading, toast)
│   │   ├── transforms/  # Redux Persist için özel transformlar (örn. tarih)
│   │   └── index.ts     # Redux store konfigürasyonu
│   ├── theme/           # Tema ve stil dosyaları (variables.css)
│   ├── types/           # Genel TypeScript tipleri
│   ├── utils/           # Yardımcı fonksiyonlar (ayrıştırma, formatlama, tip koruyucuları vb.)
│   ├── App.tsx          # Ana uygulama bileşeni (yönlendirme, sekmeler)
│   └── main.tsx         # Uygulama giriş noktası
├── .gitignore           # Git tarafından yoksayılacak dosyalar
├── capacitor.config.ts  # Capacitor yapılandırma dosyası
├── package.json         # Proje bağımlılıkları ve script'ler
├── README.md            # Bu dosya
└── tsconfig.json        # TypeScript yapılandırması
```

# Kurulum ve Çalıştırma

## Ön Koşullar:
*   Node.js ve npm/yarn
*   Android Studio (cihazda/emülatörde çalıştırmak için)

## Kurulum Adımları:

1.  **Depoyu Klonlayın:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    # veya
    yarn install
    ```
3.  **Google Cloud Console Kurulumu:**
    *   Bir Google Cloud projesi oluşturun veya mevcut bir projeyi kullanın.
    *   **Gmail API** ve **Google Takvim API**'lerini etkinleştirin.
    *   Bir **OAuth 2.0 İstemci Kimliği** oluşturun:
        *   Uygulama türü olarak **Android** seçin.
        *   Paket adını `capacitor.config.ts` dosyasındaki `appId` ile eşleştirin (örn: `com.codeyzer.ekstre`).
        *   SHA-1 imza parmak izini ekleyin (Android Studio veya `keytool` aracılığıyla edinilebilir).
        *   Oluşturulan **Android İstemci Kimliği**'ni alın.
        *   `serverClientId` olarak kullanılacak bir **Web İstemci Kimliği** de oluşturun.
4.  **Yerel Projeyi Senkronize Edin:**
    ```bash
    npx cap sync android
    ```
5.  **Uygulamayı Çalıştırın:**
    *   **Android Studio aracılığıyla:** `android` klasörünü Android Studio'da açın ve projeyi çalıştırın.
    *   **CLI aracılığıyla:**
        ```bash
        npx cap run android
        ```
        (Bağlı bir Android cihaz veya çalışan bir emülatör gerektirir.)

# Geliştirme Kuralları

*   **Dil:** TypeScript
*   **Çerçeveler:** React, Ionic Framework, Capacitor
*   **Durum Yönetimi:** Kalıcı durum için Redux Persist ile Redux Toolkit. Slice'lar `src/store/slices` altında düzenlenmiştir. `auth`, `data` slice'ları `redux-persist-transform-encrypt` ile şifrelenir. Şifreleme anahtarı native `SecureStorage` ile yönetilir. `AndroidManifest.xml` içinde `android:allowBackup="false"` ayarı yapılmıştır.
*   **Kod Yapısı:** Özelliğe ve sorumluluğa göre modülerleştirilmiştir (bileşenler, sayfalar, servisler, store, yardımcılar).
*   **Ayrıştırma Mantığı:** Bankaya özel e-posta ayrıştırıcıları `src/services/email-parsing/parsers/` ve screenshot ayrıştırıcıları `src/services/screenshot-parsing/parsers/` altında bulunur. HTML içeriği için regex tabanlı ayrıştırıcılar ve PDF ekleri için `pdfbox-android` kütüphanesini kullanan native PDF ayrıştırıcı eklentisi (`PdfParserPlugin.java`) mevcuttur. Bazı bankalar farklı kart türleri için farklı e-posta formatları kullanabilir (örn: Garanti BBVA Bonus - Mastercard ve Troy formatları).
*   **Tarih Filtresi:** `statement-processor.ts` içinde e-posta taramaları otomatik olarak son 2 aylık mesajlarla sınırlandırılmıştır (performans optimizasyonu).
*   **Özel Eklentiler:** Google kimlik doğrulaması, PDF ayrıştırma ve OCR gibi yerel işlevler için özel Capacitor eklentileri kullanılır.
*   **Test:** Vitest, özellikle ayrıştırma mantığı için birim testlerinde kullanılır. Yeni ayrıştırıcılar birim testleri içermelidir.
*   **Stil:** Tema ve stiller `src/theme/` altında yönetilir.
*   **Veri İşleme:** Tarihler `Date` nesnelerine ayrıştırılır, Redux durum serileştirmesi için ISO dizelerine dönüştürülür ve ardından bileşen tüketimi için memoize edilmiş seçiciler tarafından tekrar `Date` nesnelerine dönüştürülür. Kredi taksitleri dinamik olarak işlenir ve ödenen kalemler takip edilir. `dataSlice` içinde `setUserAmount`, `clearUserAmount` ve `updateItemDueDate` action'ları ile kullanıcı düzenlemeleri desteklenir. Veri yenilendiğinde (`fetchAndProcessDataThunk`) `isPaid` ve `userAmount` değerleri stabil anahtar eşleştirmesiyle korunur.

## Yeni Bir Banka Ekleme:
1.  **Ayrıştırıcı Oluşturma:** `src/services/email-parsing/parsers/` veya `src/services/screenshot-parsing/parsers/` altında yeni bir ayrıştırıcı dosyası (örn: `denizbank-email-parser.ts` veya `denizbank-screenshot-parser.ts`) geliştirin ve `BankEmailParser` veya `BankScreenshotParser` arayüzünü uygulayın.
2.  **İşlemciye Ekleme:** Yeni ayrıştırıcıyı `src/services/statement-parsing/statement-processor.ts` dosyasına içe aktarın ve Gmail sorgusunu ve ayrıştırıcı örneğini belirterek `availableBankProcessors` dizisine yeni bir banka yapılandırma nesnesi ekleyin.
3.  **Test Yazma:** Yeni ayrıştırıcı için `__tests__` dizini altında Vitest ile birim testleri oluşturun.
    *   **Not:** Test mock'larında tarih kullanırken, dinamik tarihler kullanın (son 2 ay filtresi aktif olduğundan). Statik tarihler yerine `new Date()` ile hesaplanan dinamik tarihler testlerin her zaman geçmesini sağlar.
4.  **Çoklu Format Desteği:** Eğer banka farklı kart türleri için farklı HTML formatları kullanıyorsa (örn: Mastercard vs Troy), parser'da her iki formatı da destekleyen regex pattern'leri yazın ve her format için ayrı mock dosyası ve test case'i oluşturun.

# Gelecek Geliştirmeler

*   **Redux'ta E-posta Veri Depolamasını Optimize Etme:** `dataSlice` içinde saklanan `EmailDetails` objelerinden, özellikle ek ayrıştırma (PDF) için artık gerekmeyen `originalResponse` alanını kaldırmayı veya sadece gerekli minimum bilgiyi (örn. ek ID'leri) saklayacak şekilde yeniden yapılandırmayı değerlendirin.
*   **OAuth Modernizasyonu (Google API İstemci Kütüphaneleri):** Eski `GoogleAuthUtil.getToken` yerine modern API istemci kütüphanelerini kullanarak Google API entegrasyonunu native tarafta yeniden yapılandırın. Bu, `gmail.service.ts` ve `calendar.service.ts` dosyalarının güncellenmesini gerektirecektir.
*   **Gizlilik Politikası URL'si Sağlama:** Google Play Store politikalarına uymak için gizlilik politikası metni oluşturulmalı, web üzerinde barındırılmalı ve URL Google Play Console'a eklenmelidir.
