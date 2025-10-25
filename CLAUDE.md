# Proje Genel Bakışı

Bu proje, banka ekstre SMS'lerini ve e-postalarını okuyarak kredi kartı son ödeme tarihlerini ve kredi ilk ödeme tarihlerini listeleyen, React Native/Capacitor ile oluşturulmuş bir Android uygulamasıdır. Önemli ödeme tarihlerini takip etmelerine yardımcı olmak amacıyla Google Takvim ile isteğe bağlı entegrasyon sunar ve finansal takibi otomatikleştirmeyi, manuel veri girişini azaltmayı hedefler.

## Temel Özellikler:
*   **Otomatik Veri Ayrıştırma:** Belirli bankalardan gelen SMS'leri (QNB, Garanti BBVA Kredi, Kuveyt Türk) ve e-postaları (Gmail) (Yapı Kredi, Ziraat Bankası, İş Bankası, Garanti BBVA Bonus, Kuveyt Türk, Akbank) işler. Son ödeme tarihlerini, kredi ödeme tarihlerini ve diğer ilgili finansal bilgileri çıkarır. SMS'ler için dinamik, büyük/küçük harfe duyarlı (GLOB) native filtreleme kullanılır. E-posta ekleri (örn. PDF) ayrıştırılabilir. **Son 2 ay içindeki mesajları** otomatik olarak tarar (performans ve veri yönetimi için).
*   **Manuel Giriş:** Otomatik olarak algılanmayan ödeme kayıtlarını manuel olarak eklemeye olanak tanır.
*   **Birleşik Liste Görünümü:** Ayrıştırılan ve manuel olarak girilen tüm kayıtları tek, düzenli bir listede görüntüler.
*   **Google Entegrasyonu:** Güvenli Google oturum açma (OAuth 2.0) ve ödeme etkinliklerini eklemek için Google Takvim API ile entegrasyon. Gmail API aracılığıyla e-posta ekleri alınabilir ve işlenebilir. Takvim etkinlikleri için benzersiz bir AppID sistemi kullanılır.
*   **İzin Yönetimi:** Android SMS okuma izinlerini yönetir. İzin talebi, Google Play Store politikalarına uygun olarak dinamik ve filtrelenmiş SMS okuma ile güçlendirilmiştir.
*   **Durum Yönetimi:** Uygulama durumunu (oturum, izinler, veriler) yönetmek ve kalıcı hale getirmek için Redux Toolkit ve Redux Persist kullanır. Hassas veriler (`auth`, `permissions`, `data` slice'ları) `redux-persist-transform-encrypt` ile şifrelenir ve anahtar yönetimi native `SecureStorage` ile sağlanır. Android otomatik yedekleme devre dışı bırakılmıştır.
*   **Veri İşleme Mantığı:** Krediler taksitlere bölünür ve sadece belirli bir zaman aralığındaki taksitler gösterilir. Ödenen kalemler takip edilebilir ve toplam borç hesaplamasına dahil edilmez. Kalemler 'borç' veya 'harcama' olarak sınıflandırılabilir.
*   **Platform:** Başlıca Capacitor kullanarak Android platformunu hedefler.

## Kullanılan Teknolojiler:
*   **Frontend:** React (TypeScript), Ionic Framework
*   **Mobil Platform:** Capacitor
*   **Durum Yönetimi:** Redux Toolkit, React Redux, Redux Persist, redux-persist-transform-encrypt
*   **API Entegrasyonları:** Google Identity Services (Web), Google People API, Gmail API, Google Calendar API
*   **Yerel Eklentiler (Capacitor):** SMS okuma (`@plugins/sms-reader`), Google kimlik doğrulaması (`@plugins/google-auth`), ve PDF ayrıştırma (`PdfParserPlugin.java` - `com.tom-roush:pdfbox-android` kütüphanesini kullanır) gibi yerel işlevler için özel Capacitor eklentileri.
*   **Test:** Vitest

## Proje Yapısı:

```
.
├── android/             # Android yerel proje
├── node_modules/        # Proje bağımlılıkları
├── public/              # Statik varlıklar
├── src/
│   ├── assets/          # Resimler, ikonlar vb.
│   ├── components/      # Tekrar kullanılabilir React bileşenleri
│   ├── pages/           # Ana sayfa/sekme bileşenleri (AccountTab, ManualEntryTab, SettingsTab, LoginPage)
│   ├── services/        # API servisleri (gmail, calendar), ayrıştırma mantığı (sms-parsing, email-parsing)
│   │   ├── email-parsing/
│   │   │   └── parsers/ # E-posta ayrıştırıcıları (ziraat, yapikredi...)
│   │   ├── sms-parsing/
│   │   │   ├── parsers/ # SMS ayrıştırıcıları (qnb, garanti, kuveytturk...)
│   │   │   └── types.ts # Ortak veri tipleri
│   │   └── sms-processor.ts # SMS ve E-posta verilerini işleyen ana servis
│   ├── store/           # Redux durum yönetimi (slices, store, transforms)
│   │   ├── slices/      # Redux slice'ları (auth, data, permission, loading)
│   │   ├── transforms/  # Redux Persist için özel transformlar (örn. tarih)
│   │   └── index.ts     # Redux store konfigürasyonu
│   ├── theme/           # Tema ve stil dosyaları
│   ├── types/           # Genel TypeScript tipleri
│   ├── utils/           # Yardımcı fonksiyonlar (ayrıştırma vb.)
│   ├── App.tsx          # Ana uygulama bileşeni (yönlendirme, sekmeler)
│   └── index.tsx        # Uygulama giriş noktası
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
        *   Paket adını `capacitor.config.ts` dosyasındaki `appId` ile eşleştirin (örn: `com.ekstre.takvim`).
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
*   **Durum Yönetimi:** Kalıcı durum için Redux Persist ile Redux Toolkit. Slice'lar `src/store/slices` altında düzenlenmiştir. `auth`, `permissions`, `data` slice'ları `redux-persist-transform-encrypt` ile şifrelenir. Şifreleme anahtarı native `SecureStorage` ile yönetilir. `AndroidManifest.xml` içinde `android:allowBackup="false"` ayarı yapılmıştır.
*   **Kod Yapısı:** Özelliğe ve sorumluluğa göre modülerleştirilmiştir (bileşenler, sayfalar, servisler, store, yardımcılar).
*   **Ayrıştırma Mantığı:** Bankaya özel SMS ve e-posta ayrıştırıcıları `src/services/sms-parsing/parsers/` ve `src/services/email-parsing/parsers/` altında bulunur. HTML içeriği için regex tabanlı ayrıştırıcılar ve PDF ekleri için `pdfbox-android` kütüphanesini kullanan native PDF ayrıştırıcı eklentisi (`PdfParserPlugin.java`) mevcuttur. Bazı bankalar farklı kart türleri için farklı e-posta formatları kullanabilir (örn: Garanti BBVA Bonus - Mastercard ve Troy formatları).
*   **Tarih Filtresi:** `sms-processor.ts` içinde SMS ve e-posta taramaları otomatik olarak son 2 aylık mesajlarla sınırlandırılmıştır (performans optimizasyonu).
*   **Özel Eklentiler:** SMS okuma, Google kimlik doğrulaması ve PDF ayrıştırma gibi yerel işlevler için özel Capacitor eklentileri kullanılır.
*   **Test:** Vitest, özellikle ayrıştırma mantığı için birim testlerinde kullanılır. Yeni ayrıştırıcılar birim testleri içermelidir.
*   **Stil:** Tema ve stiller `src/theme/` altında yönetilir.
*   **Veri İşleme:** Tarihler `Date` nesnelerine ayrıştırılır, Redux durum serileştirmesi için ISO dizelerine dönüştürülür ve ardından bileşen tüketimi için memoize edilmiş seçiciler tarafından tekrar `Date` nesnelerine dönüştürülür. Kredi taksitleri dinamik olarak işlenir ve ödenen kalemler takip edilir.

## Yeni Bir Banka Ekleme:
1.  **Ayrıştırıcı Oluşturma:** `src/services/sms-parsing/parsers/` veya `src/services/email-parsing/parsers/` altında yeni bir ayrıştırıcı dosyası (örn: `akbank-sms-parser.ts`) geliştirin ve `BankSmsParser`, `BankEmailParser` veya `LoanSmsParser` arayüzünü uygulayın.
2.  **İşlemciye Ekleme:** Yeni ayrıştırıcıyı `src/services/sms-parsing/sms-processor.ts` dosyasına içe aktarın ve gönderici anahtar kelimelerini, Gmail sorgularını ve ayrıştırıcı örneğini belirterek `availableBankProcessors` dizisine yeni bir banka yapılandırma nesnesi ekleyin.
3.  **(İsteğe Bağlı) Sahte Veri Ekleme:** Web üzerinde test etmek için ilgili sahte dosyaya (örn: `src/web/*`) örnek mesajlar ekleyin.
4.  **Test Yazma:** Yeni ayrıştırıcı için `__tests__` dizini altında Vitest ile birim testleri oluşturun.
    *   **Not:** Test mock'larında tarih kullanırken, dinamik tarihler kullanın (son 2 ay filtresi aktif olduğundan). Statik tarihler yerine `new Date()` ile hesaplanan dinamik tarihler testlerin her zaman geçmesini sağlar.
5.  **Çoklu Format Desteği:** Eğer banka farklı kart türleri için farklı HTML formatları kullanıyorsa (örn: Mastercard vs Troy), parser'da her iki formatı da destekleyen regex pattern'leri yazın ve her format için ayrı mock dosyası ve test case'i oluşturun.

# Gelecek Geliştirmeler

*   **Redux'ta E-posta Veri Depolamasını Optimize Etme:** `dataSlice` içinde saklanan `EmailDetails` objelerinden, özellikle ek ayrıştırma (PDF) için artık gerekmeyen `originalResponse` alanını kaldırmayı veya sadece gerekli minimum bilgiyi (örn. ek ID'leri) saklayacak şekilde yeniden yapılandırmayı değerlendirin.
*   **OAuth Modernizasyonu (Google API İstemci Kütüphaneleri):** Eski `GoogleAuthUtil.getToken` yerine modern API istemci kütüphanelerini kullanarak Google API entegrasyonunu native tarafta yeniden yapılandırın. Bu, `gmail.service.ts` ve `calendar.service.ts` dosyalarının güncellenmesini gerektirecektir.
*   **Gizlilik Politikası URL'si Sağlama:** Google Play Store politikalarına uymak için gizlilik politikası metni oluşturulmalı, web üzerinde barındırılmalı ve URL Google Play Console'a eklenmelidir.
