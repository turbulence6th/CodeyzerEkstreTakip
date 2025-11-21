# Screenshot OCR Özelliği - İmplementasyon Dokümantasyonu

## 📸 Genel Bakış

Bu özellik, banka mobil uygulamalarından alınan ekran görüntülerini OCR ile okuyup otomatik olarak ekstre kaydı oluşturur. **Akbank için özel olarak tasarlanmıştır** ancak mimari diğer bankaların da kolayca eklenmesine olanak tanır.

## 🎯 Çözülen Sorun

Akbank bazen ekstre PDF'lerini geç gönderiyor veya hiç göndermiyor. Bu özellik sayesinde kullanıcılar:
- Akbank Mobile'den ekran görüntüsü alabilir
- OCR ile otomatik veri çıkarabilir
- Manuel giriş yapmadan ekstre kaydı oluşturabilir

## 🏗️ Mimari Tasarım

### Klasör Yapısı

```
src/
├── services/
│   ├── screenshot-parsing/
│   │   ├── parsers/
│   │   │   ├── akbank-screenshot-parser.ts
│   │   │   └── __tests__/
│   │   │       └── akbank-screenshot-parser.test.ts
│   │   ├── screenshot-processor.ts
│   │   └── __tests__/
│   │       └── screenshot-processor.test.ts
│   └── sms-parsing/
│       └── types.ts (güncellenmiş)
├── plugins/
│   └── ocr/
│       ├── definitions.ts
│       ├── web.ts
│       └── index.ts
└── utils/
    └── parsing.ts (yeni fonksiyon eklendi)
```

### Temel Bileşenler

#### 1. **Type Definitions** (`src/services/sms-parsing/types.ts`)

```typescript
// Screenshot için yeni tipler
export interface ScreenshotDetails {
  extractedText: string;
  imageUri?: string;
  timestamp: Date;
}

export interface BankScreenshotParser {
  bankName: string;
  canParse(extractedText: string): boolean;
  parse(screenshot: ScreenshotDetails): ParsedStatement | null;
}

// BankProcessor güncellendi
export interface BankProcessor {
  // ... mevcut alanlar
  screenshotParser?: BankScreenshotParser; // YENİ
}

// ParsedStatement güncellendi
export interface ParsedStatement {
  // ...
  originalMessage: SmsDetails | EmailDetails | ScreenshotDetails; // ScreenshotDetails eklendi
  source: 'sms' | 'email' | 'screenshot'; // 'screenshot' eklendi
}
```

#### 2. **OCR Plugin** (`src/plugins/ocr/`)

Native OCR implementasyonu için plugin tanımları:

```typescript
export interface OcrPlugin {
  recognizeText(options: RecognizeTextOptions): Promise<RecognizeTextResult>;
}
```

**ÖNEMLİ**: Şu an sadece TypeScript tanımları mevcut. Native Android implementasyonu için **Google ML Kit** kullanılması önerilir.

#### 3. **Akbank Screenshot Parser** (`src/services/screenshot-parsing/parsers/akbank-screenshot-parser.ts`)

Gerçek Akbank Mobile OCR çıktısını parse eder:

**Girdi Formatları:**
```
Akbank ****1234 38.222,22TL Son gün: 26 Kasım 6.028,66TL Ekstreni öde
Axess ****5678 10.000,00TL Son gün: 15 Aralık 2.500,00TL Ekstreni öde
Wings ****9999 5.000,00TL Son gün: 10 Ocak 1.000,00TL Ekstreni öde
```

**Not:** Akbank'ın farklı kart markaları (Akbank, Axess, Wings) tümü aynı parser tarafından desteklenir.

**Çıkarılan Veriler:**
- Kart No: `1234`
- Son Gün: `26 Kasım` (yıl otomatik hesaplanır)
- Ekstre Tutarı: `6.028,66 TL`

**Özellikler:**
- `canParse()`: Akbank ve ekstre anahtar kelimelerini kontrol eder
- `parse()`: Regex pattern'leri ile veri çıkarır
- Türkçe ay isimleri desteği
- Yıl otomasyonu (geçmiş tarihse gelecek yıl kullanır)

#### 4. **Screenshot Processor** (`src/services/screenshot-parsing/screenshot-processor.ts`)

Tüm screenshot parser'ları yöneten merkezi servis:

```typescript
class ScreenshotProcessor {
  processScreenshot(extractedText: string, imageUri?: string): Promise<ParsedStatement | null>
  getSupportedBanks(): string[]
  hasParserForBank(bankName: string): boolean
}
```

**Çalışma Prensibi:**
1. OCR metnini alır
2. Tüm kayıtlı parser'ları dener (`canParse`)
3. İlk eşleşen parser ile parse eder
4. `ParsedStatement` döndürür

#### 5. **Parsing Utilities** (`src/utils/parsing.ts`)

Yeni eklenen fonksiyon:

```typescript
export function parseTurkishDayMonth(dateStr: string): Date | null
```

**Özellikler:**
- "26 Kasım" formatını parse eder
- Yıl olmadan tarih işler
- Eğer geçmiş bir tarihse otomatik olarak gelecek yıl kullanır
- Türkçe ay isimleri: ocak, şubat, mart, nisan, mayıs, haziran, temmuz, ağustos, eylül, ekim, kasım, aralık

## 🧪 Testler

### Akbank Parser Testi
```bash
npm test -- akbank-screenshot-parser.test.ts
```

**Test Senaryosu:**
```typescript
const text = `Akbank ****1234 38.222,22TL Son gün: 26 Kasım 6.028,66TL Ekstreni öde`;
// Beklenen: { bankName: 'Akbank', last4Digits: '1234', amount: 6028.66, ... }
```

### Screenshot Processor Testi
```bash
npm test -- screenshot-processor.test.ts
```

## 📝 Kullanım Senaryosu (Gelecek UI Entegrasyonu)

### Adım 1: OCR Plugin Native Implementasyonu

**Android için (Java/Kotlin):**
```java
// android/app/src/main/java/com/codeyzer/ekstre/OcrPlugin.java
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {
    @PluginMethod
    public void recognizeText(PluginCall call) {
        String imageSource = call.getString("imageSource");

        // Google ML Kit Text Recognition
        InputImage image = InputImage.fromFilePath(context, Uri.parse(imageSource));
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        recognizer.process(image)
            .addOnSuccessListener(result -> {
                JSObject ret = new JSObject();
                ret.put("text", result.getText());
                ret.put("success", true);
                call.resolve(ret);
            })
            .addOnFailureListener(e -> {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            });
    }
}
```

**Gerekli Dependencies (`android/app/build.gradle`):**
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-mlkit-text-recognition:19.0.0'
}
```

### Adım 2: UI Entegrasyonu (ManualEntryTab)

```typescript
import { Camera } from '@capacitor/camera';
import { Ocr } from '@plugins/ocr';
import { screenshotProcessor } from '@services/screenshot-parsing/screenshot-processor';

const handleScreenshotImport = async () => {
  try {
    // 1. Kamera veya galeriden resim al
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos, // Galeriden seç
    });

    // 2. OCR ile metin çıkar
    const ocrResult = await Ocr.recognizeText({
      imageSource: photo.path!,
      sourceType: 'path',
    });

    if (!ocrResult.success || !ocrResult.text) {
      showToast('OCR başarısız oldu', 'warning');
      return;
    }

    // 3. Screenshot processor ile parse et
    const parsed = await screenshotProcessor.processScreenshot(
      ocrResult.text,
      photo.path
    );

    if (!parsed) {
      showToast('Ekstre bilgileri okunamadı. Manuel giriş yapın.', 'warning');
      return;
    }

    // 4. Formu otomatik doldur
    setDescription(`${parsed.bankName} - ${parsed.last4Digits ? '****' + parsed.last4Digits : ''}`);
    setAmount(parsed.amount?.toString() || '');
    setDueDate(parsed.dueDate.toISOString());

    showToast('Ekstre bilgileri otomatik yüklendi!', 'success');
  } catch (error) {
    console.error('Screenshot import error:', error);
    showToast('Hata oluştu', 'danger');
  }
};
```

**UI Butonu:**
```tsx
<IonButton onClick={handleScreenshotImport} fill="outline">
  📸 Ekran Görüntüsünden Ekle
</IonButton>
```

## 🔧 Yeni Banka Ekleme

### Örnek: Garanti BBVA Screenshot Parser

1. **Parser Oluştur:**
```typescript
// src/services/screenshot-parsing/parsers/garanti-screenshot-parser.ts
export const garantiScreenshotParser: BankScreenshotParser = {
    bankName: 'Garanti BBVA',

    canParse(text: string): boolean {
        const lower = text.toLowerCase();
        return (lower.includes('garanti') || lower.includes('bonus')) &&
               lower.includes('son ödeme');
    },

    parse(screenshot: ScreenshotDetails): ParsedStatement | null {
        // Garanti formatına göre parse et
        // Örnek: "BONUS ****5678 Son Ödeme: 15 Aralık 2024 Tutar: 1.500,00TL"
        // ... parsing logic
    }
};
```

2. **Processor'a Ekle:**
```typescript
// src/services/sms-parsing/sms-processor.ts
import { garantiScreenshotParser } from '../screenshot-parsing/parsers/garanti-screenshot-parser';

export const availableBankProcessors: BankProcessor[] = [
  // ...
  {
    bankName: 'Garanti BBVA Bonus',
    screenshotParser: garantiScreenshotParser, // YENİ
    // ... diğer parser'lar
  },
];
```

3. **Test Yaz:**
```typescript
// src/services/screenshot-parsing/parsers/__tests__/garanti-screenshot-parser.test.ts
describe('Garanti Screenshot Parser', () => {
  it('should parse Garanti mobile screenshot', () => {
    const text = `BONUS ****5678 Son Ödeme: 15 Aralık 2024 Tutar: 1.500,00TL`;
    // ... test assertions
  });
});
```

## ⚠️ Dikkat Edilmesi Gerekenler

### 1. OCR Accuracy
- Ekran parlaklığı ve çözünürlük önemlidir
- OCR sonuçları %100 doğru olmayabilir
- Kullanıcıya her zaman düzeltme imkanı sunun

### 2. Gizlilik
- Görüntü dosyalarını **saklamayın**
- Sadece OCR metnini işleyin
- On-device OCR kullanın (ML Kit bundled model)

### 3. Tarih Mantığı
- `parseTurkishDayMonth` geçmiş tarihleri gelecek yıla atar
- Örnek: Bugün 15 Aralık ise, "10 Ocak" → 2026 olur
- Bu mantık ekstre son ödeme tarihleri için uygundur

### 4. Hata Yönetimi
```typescript
if (!parsed) {
  // Parse başarısız
  // Kullanıcıya manuel giriş seçeneği sun
  showManualEntryForm();
}
```

## 🚀 Sonraki Adımlar

### Zorunlu (Native OCR için)
1. ✅ Type definitions hazır
2. ⏳ **Android OCR Plugin implementasyonu** (Google ML Kit)
3. ⏳ **iOS OCR Plugin implementasyonu** (Vision Framework - opsiyonel)
4. ⏳ **ManualEntryTab UI güncellemesi** (Screenshot import butonu)
5. ⏳ **Capacitor.registerPlugin** yapılandırması

### Opsiyonel (İyileştirmeler)
- [ ] Diğer bankalar için screenshot parser'ları (Garanti, Yapı Kredi, İş Bankası, vb.)
- [ ] OCR önizleme UI'ı (kullanıcı parse öncesi görseli görebilir)
- [ ] OCR confidence score gösterimi
- [ ] Çoklu dil desteği (şu an sadece Türkçe)
- [ ] Görüntü ön işleme (parlaklık, kontrast ayarı)

## 📚 Kaynaklar

- [Google ML Kit Text Recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [Capacitor Camera Plugin](https://capacitorjs.com/docs/apis/camera)
- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins/creating-plugins)

## ✅ Tamamlanan İşler

- [x] Screenshot parser soyutlaması (types)
- [x] Akbank screenshot parser implementasyonu
- [x] Screenshot processor servisi
- [x] Parsing utility fonksiyonu (`parseTurkishDayMonth`)
- [x] Comprehensive test suite
- [x] OCR plugin type definitions
- [x] BankProcessor integration
- [x] Dokümantasyon

---

**Not:** Bu özellik şu anda **backend altyapısı hazır** durumda. OCR işlevselliği için native Android/iOS implementasyonu gereklidir.
