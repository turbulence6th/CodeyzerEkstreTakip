# Ekstre Takvim Entegrasyonu (React Native / Capacitor)

Bu proje, banka ekstre SMS'lerini ve e-postalarını okuyarak kredi kartı son ödeme tarihlerini ve kredi ilk ödeme tarihlerini listeleyen ve isteğe bağlı olarak Google Takvim'e ekleyen bir React Native/Capacitor Android uygulamasıdır.

## Amaç

Kullanıcıların farklı bankalardan gelen ekstre ve kredi bilgilerini tek bir yerde görmelerini ve önemli ödeme tarihlerini kolayca takip etmelerini sağlamak. Manuel veri girişine olan ihtiyacı azaltarak finansal takibi otomatikleştirmek.

## Özellikler

*   **Otomatik Veri Ayrıştırma:**
    *   Belirli bankalardan gelen **SMS**'leri okur ve işler (QNB, Garanti BBVA Kredi, Kuveyt Türk).
    *   Belirli bankalardan gelen **E-postaları** (Gmail) okur ve işler (Yapı Kredi, Ziraat Bankası).
    *   Ekstreler için: Son ödeme tarihi, dönem borcu, kartın son 4 hanesi.
    *   Krediler için: İlk ödeme tarihi, taksit tutarı (varsa).
*   **Manuel Kayıt Ekleme:** Otomatik olarak bulunamayan veya farklı türdeki ödemeleri manuel olarak ekleme imkanı.
*   **Birleşik Liste Görünümü:** Otomatik ayrıştırılan ve manuel eklenen tüm kayıtları tek bir listede gösterir.
*   **Google Entegrasyonu:**
    *   Güvenli Google ile giriş (OAuth 2.0).
    *   Ekstre ve kredi ödeme tarihlerini Google Takvim'e tekil veya toplu (krediler için) olarak ekleme.
*   **İzin Yönetimi:** Android SMS okuma iznini yönetir ve kullanıcıyı yönlendirir.
*   **State Yönetimi:** Redux Toolkit ve Redux Persist kullanılarak uygulama state'inin (oturum, izinler, veriler) yönetimi ve kalıcılığı.
*   **Platform:** Capacitor kullanılarak Android platformu hedeflenmiştir.

## Kullanılan Teknolojiler

*   **Frontend:** React (TypeScript), Ionic Framework
*   **Mobil Platform:** Capacitor
*   **State Yönetimi:** Redux Toolkit, React Redux, Redux Persist
*   **API Entegrasyonları:** Google Identity Services (Web), Google People API, Gmail API, Google Calendar API
*   **Native Eklentiler (Capacitor):**
    *   `@plugins/sms-reader`: Özel Android SMS okuyucu.
    *   `@plugins/google-auth`: Özel Android Google Auth istemcisi.
*   **Test:** Vitest

## Proje Yapısı

```
.
├── android/             # Android native proje
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
│   ├── store/           # Redux state yönetimi (slices, store, transforms)
│   │   ├── slices/      # Redux slice'ları (auth, data, permission, loading)
│   │   ├── transforms/  # Redux Persist için özel transformlar (örn. tarih)
│   │   └── index.ts     # Redux store konfigürasyonu
│   ├── theme/           # Tema ve stil dosyaları
│   ├── types/           # Genel TypeScript tipleri
│   ├── utils/           # Yardımcı fonksiyonlar (parsing vb.)
│   ├── App.tsx          # Ana uygulama bileşeni (yönlendirme, sekmeler)
│   └── index.tsx        # Uygulama giriş noktası
├── .gitignore           # Git tarafından yoksayılacak dosyalar
├── capacitor.config.ts  # Capacitor yapılandırma dosyası
├── package.json         # Proje bağımlılıkları ve script'ler
├── README.md            # Bu dosya
└── tsconfig.json        # TypeScript yapılandırması
```

## Kurulum ve Çalıştırma

1.  **Projeyi Klonlayın:**
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
    *   **Gmail API** ve **Google Calendar API**'lerini etkinleştirin.
    *   **OAuth 2.0 İstemci Kimliği** oluşturun:
        *   Uygulama türü olarak **Android** seçin.
        *   Paket adını `capacitor.config.ts` dosyasındaki `appId` ile aynı yapın (örn: `com.ekstre.takvim`).
        *   SHA-1 imza parmak izini (signing certificate fingerprint) ekleyin. (Android Studio veya `keytool` ile alabilirsiniz).
        *   Oluşturulan **Android Client ID**'sini alın. Bu ID, Google ile giriş için gereklidir. *NOT: Bu ID'nin nereye ekleneceği (örneğin `capacitor.config.ts` veya environment dosyası) proje kodunda belirtilmelidir.*
        *   **Web Client ID** de oluşturmanız gerekebilir (özellikle `idToken` doğrulaması veya Web platformu için). Bu ID, `serverClientId` olarak kullanılacaktır.
4.  **Native Projeyi Senkronize Edin:**
    ```bash
    npx cap sync android
    ```
5.  **Uygulamayı Çalıştırın:**
    *   **Android Studio ile:** `android` klasörünü Android Studio'da açın ve çalıştırın.
    *   **CLI ile:**
        ```bash
        npx cap run android
        ```
        (Bağlı bir Android cihaz veya çalışan bir emülatör gerektirir.)

## Nasıl Çalışır?

1.  **Giriş:** Kullanıcı, `LoginPage` üzerinden Google hesabı ile giriş yapar. Başarılı girişte alınan `idToken` ve `accessToken` Redux (`authSlice`) state'inde saklanır.
2.  **İzin Kontrolü:** Uygulama açıldığında veya `SettingsTab` üzerinden SMS okuma izni kontrol edilir/istenir. İzin durumu Redux (`permissionSlice`) state'inde tutulur.
3.  **Veri Çekme ve İşleme:**
    *   `AccountTab` açıldığında veya yenilendiğinde `fetchAndProcessDataThunk` tetiklenir.
    *   Bu thunk, `statementProcessor` servisinin `fetchAndParseStatements` ve `fetchAndParseLoans` fonksiyonlarını çağırır.
    *   `statementProcessor`:
        *   SMS izni varsa, `availableBankProcessors` listesindeki her banka için yapılandırılmış gönderici (`smsSenderKeywords`) ve anahtar kelime (`smsStatementQueryKeyword` veya `smsLoanQueryKeyword`) filtreleriyle native `@plugins/sms-reader` eklentisini kullanarak ilgili **en yeni** SMS'leri çeker.
        *   Gmail API'si için `gmailService`'i kullanarak `availableBankProcessors` listesindeki her banka için yapılandırılmış `gmailQuery` ile **en yeni** e-postaları arar ve detaylarını alır.
        *   Gelen SMS ve e-posta içeriklerini ilgili bankanın parser'ına (`*-parser.ts`) gönderir.
        *   Parser'lar (örn: `QnbSmsParser`, `ZiraatEmailParser`) mesaj içeriğini ayrıştırarak yapılandırılmış `ParsedStatement` veya `ParsedLoan` nesneleri oluşturur. Tarihler `Date` nesnesi olarak parse edilir.
4.  **State Güncelleme:**
    *   `fetchAndProcessDataThunk`, parser'lardan dönen `ParsedStatement` ve `ParsedLoan` listelerindeki `Date` nesnelerini **ISO string formatına** dönüştürerek Redux (`dataSlice`) state'ini günceller. Bu, state'in serialize edilebilir olmasını sağlar.
    *   Kullanıcı `ManualEntryTab` üzerinden manuel kayıt eklediğinde veya `AccountTab` üzerinden sildiğinde `dataSlice` güncellenir.
5.  **Veri Gösterimi:**
    *   `AccountTab` gibi bileşenler, Redux state'inden veriyi `selectAllDataWithDates` gibi **memoized selector**'ler aracılığıyla alır.
    *   Selector, state'deki **ISO string tarihlerini tekrar `Date` nesnelerine** dönüştürerek bileşenin kullanıma hazır hale getirir. Bu, gereksiz yeniden render'ları önler.
    *   Liste, son ödeme/ilk ödeme tarihine göre en yeniden eskiye doğru sıralanır.
6.  **Takvime Ekleme:**
    *   Kullanıcı "Takvime Ekle" veya "Tüm Taksitleri Ekle" butonuna bastığında, `calendarService` çağrılır.
    *   `calendarService`, Redux'tan alınan `accessToken`'ı kullanarak Google Calendar API'si ile iletişim kurar, etkinliğin zaten var olup olmadığını kontrol eder ve yoksa yeni bir etkinlik oluşturur (krediler için tüm taksitleri hesaplayarak ekler).

## Yeni Bir Banka Eklemek

1.  **Parser Oluşturma:**
    *   İlgili mesaj türü (SMS/E-posta/Kredi SMS) için `src/services/sms-parsing/parsers/` veya `src/services/email-parsing/parsers/` altında yeni bir `.ts` dosyası oluşturun (örn: `akbank-sms-parser.ts`).
    *   Gerekli arayüzü (`BankSmsParser`, `BankEmailParser`, `LoanSmsParser`) implemente edin (`canParse` ve `parse` metodları). Gerekirse `src/utils/parsing.ts` içindeki yardımcı fonksiyonları kullanın veya yenilerini ekleyin.
2.  **İşlemciye Ekleme:**
    *   `src/services/sms-parsing/sms-processor.ts` dosyasını açın.
    *   Oluşturduğunuz parser'ı import edin.
    *   `availableBankProcessors` dizisine yeni bir banka yapılandırma nesnesi ekleyin:
        ```typescript
        {
          bankName: 'Yeni Banka Adı',
          smsSenderKeywords: ['GONDERICI1', 'GONDERICI2'], // SMS gönderici adları/numaraları
          smsStatementQueryKeyword: 'ekstre anahtar kelime', // Ekstre SMS'i için (opsiyonel)
          smsLoanQueryKeyword: 'kredi anahtar kelime', // Kredi SMS'i için (opsiyonel)
          gmailQuery: 'from:(banka@mail.com) subject:("Konu")', // Gmail sorgusu (opsiyonel)
          smsParser: new YeniBankaSmsParser(), // Oluşturduğunuz SMS parser (opsiyonel)
          loanSmsParser: yeniBankaLoanParser, // Oluşturduğunuz Kredi SMS parser (opsiyonel)
          emailParser: yeniBankaEmailParser, // Oluşturduğunuz E-posta parser (opsiyonel)
        }
        ```
3.  **(Opsiyonel) Mock Veri Ekleme:** Web üzerinde test etmek için ilgili mock dosyasına (`src/web/*`) örnek mesaj ekleyebilirsiniz.
4.  **Test Yazma:** Oluşturduğunuz parser için `__tests__` dizini altına Vitest ile unit testler yazın.

## Gelecekteki İyileştirmeler (Olası)

*   Daha fazla banka için SMS ve E-posta parser'ları eklemek.
*   Arka planda periyodik veri kontrolü ve yeni ekstre/kredi bulunduğunda bildirim gönderme (Capacitor Background Runner / Push Notifications).
*   Daha detaylı hata yönetimi ve kullanıcı geri bildirimi (API hataları, parse hataları).
*   Ayarlar sekmesini genişletmek (örn. hangi bankaların taranacağını seçme, bildirim ayarları, takvim seçimi).
*   UI/UX iyileştirmeleri (daha iyi yükleme göstergeleri, boş durum mesajları, filtreleme/arama).
*   Kapsamlı Unit ve Integration testleri yazmak.

## Katkıda Bulunma

Katkılarınız memnuniyetle karşılanır! Lütfen bir issue açın veya pull request gönderin.

## Lisans

[MIT](LICENSE) (Eğer bir lisans dosyası eklemeyi düşünürseniz) 