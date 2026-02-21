# Kod İncelemesi — CodeyzerEkstreTakip

**Tarih:** 2026-02-21
**İncelenen:** Tüm kaynak dosyalar, Android native plugin'ler, testler ve konfigürasyon

---

## KRİTİK Sorunlar

### 1. `calendar.service.ts` — Kırık Template Literal

**Dosya:** `src/services/calendar.service.ts` (satır 33, 54, 58)

Hata loglarında `${error.code}` hiçbir zaman interpolate edilmiyor. Backslash (`\$`) yüzünden literal metin olarak yazılıyor. Takvim hatalarını debug etmek neredeyse imkansız.

```typescript
// HATALI — backslash interpolasyonu engelliyor:
`callNativeGoogleApi: Native API call failed with code: \${error.code}.`

// DOĞRU:
`callNativeGoogleApi: Native API call failed with code: ${error.code}.`
```

---

### 2. `firebase.ts` — Ölü Dosya, Gerçek Proje ID'si Açıkta

**Dosya:** `src/firebase.ts`

Hiçbir yerde import edilmeyen bu dosya gerçek Firebase project ID'sini (`ekstre-takvim-android`) açığa çıkarıyor. Silinmeli.

---

### 3. `isbank-email-parser.ts` — Döngüsel Bağımlılık

**Dosya:** `src/services/email-parsing/parsers/isbank-email-parser.ts`

```typescript
import { gmailService } from '../../index'; // DÖNGÜSEL: index bu parser'ı import ediyor
```

`services/index.ts` → `statement-processor.ts` → bu parser → `services/index.ts` döngüsü oluşuyor. Bazı ortamlarda `undefined` olabilir.

**Çözüm:** Doğrudan `'../gmail.service'`'den import etmeli.

---

### 4. `gmail.service.mock.ts` — Yanlış Dönüş Tipi

**Dosya:** `src/services/gmail.service.mock.ts`

```typescript
// Mock bir array döndürüyor:
async searchEmails(query: string): Promise<{ id: string; threadId: string }[]> {
    return [{ id: 'mock-email-1', threadId: 'thread-1' }];
}

// Ama statement-processor.ts bir obje bekliyor:
const searchResult: GmailSearchResponse = await gmailService.searchEmails(query);
const messages = searchResult.messages || []; // undefined döner
```

Web/test ortamında e-postalar sessizce işlenmiyor.

---

### 5. `GoogleAuthPlugin.java:64` — Hardcoded OAuth Client ID

**Dosya:** `android/app/src/main/java/com/codeyzer/ekstre/GoogleAuthPlugin.java` (satır 64)

```java
private static final String WEB_CLIENT_ID = "1008857567754-...apps.googleusercontent.com";
```

OAuth client ID kaynak kodda açık metin olarak bulunuyor.

**Çözüm:** `BuildConfig` veya `res/values/strings.xml` (gitignore'lu) üzerinden yönetilmeli.

---

## ÖNEMLİ Sorunlar

### 6. `main.tsx` — Geçici Hata Tüm Veriyi Siliyor

**Dosya:** `src/main.tsx`

```typescript
} catch (error) {
    await Preferences.remove({ key: PERSIST_KEY });
    // ... sıfırdan başla
}
```

`SecureStorage` geçici bir hatayla başarısız olursa (cihaz yeni açılmış, kilit açılmamış vb.), kod tüm kalıcı verileri silip sıfırdan başlıyor.

**Çözüm:** Retry mekanizması (exponential backoff) veya hata ekranı gösterilmeli.

---

### 7. `addMonths` — Kenar Durumlarında Yanlış Hesaplama

**Dosya:** `src/utils/formatting.ts`

```typescript
export function addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    const newMonth = d.getMonth() + months;
    if (newMonth > 11) {
        d.setFullYear(d.getFullYear() + Math.floor(months / 12));
    }
    d.setMonth((d.getMonth() + months) % 12);
    return d;
}
```

Modülo mantığı 24+ ay veya yıl geçişlerinde bozuk. JavaScript'in `Date.setMonth()` overflow'u zaten doğru yönetiyor.

**Çözüm:** Doğrudan `d.setMonth(d.getMonth() + months)` kullanılmalı.

---

### 8. `SettingsTab.tsx` — Import Edilen JSON Doğrulanmıyor

**Dosya:** `src/pages/SettingsTab.tsx`

```typescript
const parsed = JSON.parse(jsonContent);
dispatch(importData({ items: parsed.items, merge: true })); // Doğrulama yok
```

Dosyadan okunan JSON, hiçbir şema doğrulaması yapılmadan direkt Redux store'a dispatch ediliyor.

**Çözüm:** `zod` veya elle yazılmış bir validator ile doğrulama eklenmeli.

---

### 9. `callNativeGoogleApi` İki Serviste Kopyalanmış

**Dosyalar:**
- `src/services/gmail.service.ts`
- `src/services/calendar.service.ts`

İki dosyada farklılaşmış kopyalar var. `gmail` versiyonu `SIGN_IN_REQUIRED` ve `INVALID_GRANT` yönetirken, `calendar` versiyonu ek olarak `NOT_SIGNED_IN` da yönetiyor.

**Çözüm:** Tek bir `src/utils/googleApiClient.ts` utility'sine çıkarılmalı.

---

### 10. `AccountTab.tsx` — N+1 Takvim API Sorunu

**Dosya:** `src/pages/AccountTab.tsx`

```typescript
for (const item of allItems) {
    const eventId = await calendarService.findEventByAppId(item.appId);
}
```

N öğe için N seri API çağrısı yapılıyor.

**Çözüm:** `Promise.all()` ile paralel çağrı veya toplu arama mekanizması kullanılmalı.

---

### 11. `AccountTab.tsx` — Ölü Import'lar

**Dosya:** `src/pages/AccountTab.tsx` (satır 16)

```typescript
import { calendarService as oldCalendarService } from '../services/calendar.service';
import { gmailService } from '../services/gmail.service';
import { statementProcessor } from '../services/statement-parsing/statement-processor';
```

Bu import'lar dosyada hiçbir yerde kullanılmıyor. Bundle boyutunu gereksiz artırıyor.

---

### 12. `DisplayItemList.tsx:102` — `(item as any).id`

**Dosya:** `src/components/DisplayItemList.tsx` (satır 102)

```typescript
key={(item as any).id || index}
```

`ParsedStatement` tipinde `id` alanı tanımlı değil. Redux'ta ekleniyor ama tip sistemi bunu bilmiyor.

**Çözüm:** `DisplayItem` tipine `id: string` eklenmeli.

---

### 13. `deleteLoan` Kırılgan String Eşleştirme Kullanıyor

**Dosya:** `src/store/slices/dataSlice.ts`

```typescript
state.items = state.items.filter(
    item => !(item.description.includes('Taksit') && item.id.startsWith(action.payload))
);
```

Description format'ı değişirse bozulur.

**Çözüm:** Her taksit item'ına dedicated `loanId` alanı eklenmeli.

---

### 14. `DisplayItemList.tsx` — Ulaşılmaz Ölü JSX

**Dosya:** `src/components/DisplayItemList.tsx` (satır 241)

Satır 85'teki early return yüzünden satır 241'deki ikinci boş durum JSX'ine asla ulaşılamıyor. Silinmeli.

---

### 15. `importData` Reducer Tüm İş Mantığını Atlıyor

**Dosya:** `src/store/slices/dataSlice.ts`

`importData` action'ı deduplication, stable-key koruma ve taksit oluşturma mantığını çalıştırmadan direkt `state.items`'ı değiştiriyor. Çakışan kayıtlar oluşabilir.

---

## PERFORMANS Sorunları

### 16. `selectAllDataWithDates` Her Çağrıda Yeni Date Objeleri Üretiyor

**Dosya:** `src/store/slices/dataSlice.ts`

`createSelector` memoize etse de, herhangi bir item değiştiğinde tüm array yeniden map'leniyor ve her öğe için yeni `Date` objeleri oluşturuluyor.

**Çözüm:** `createEntityAdapter` ile normalize edilmiş store yapısı düşünülebilir.

---

### 17. `originalMessage` Canlı Bellekte Tutuluyor

**Dosya:** `src/store/slices/dataSlice.ts`

Büyük e-posta HTML'leri ve base64 PDF verileri Redux Persist'e yazılırken `dateTransform.ts` tarafından temizleniyor ama oturum boyunca canlı bellekte kalıyor.

**Çözüm:** Parse işlemi tamamlandıktan sonra `state.items`'a yazılmadan önce bu alanlar strip edilmeli.

---

### 18. `GoogleAuthPlugin.java` — Tek İş Parçacıklı Executor

**Dosya:** `android/app/src/main/java/com/codeyzer/ekstre/GoogleAuthPlugin.java`

```java
private ExecutorService executor = Executors.newSingleThreadExecutor();
```

Tüm Gmail ve Calendar API çağrıları tek bir background thread üzerinde sıralı çalışıyor.

**Çözüm:** `Executors.newCachedThreadPool()` veya `newFixedThreadPool(N)` kullanılmalı.

---

### 19. `parseTurkishDayMonth` Tarih Tahmini Eski Veriler İçin Yanlış

**Dosya:** `src/utils/parsing.ts`

```typescript
if (date < now) {
    year++;
    date.setFullYear(year);
}
```

Geçmiş aylardan alınan screenshot'lar import edildiğinde geçmiş tarihler yanlışlıkla gelecek yıla atanıyor.

---

## GÜVENLİK Sorunları

### 20. iOS'ta Şifreleme Anahtarı `NSUserDefaults`'ta (Şifresiz)

**Dosya:** `src/main.tsx`

Android'de `SecureStorage` (AES-256-GCM + Keystore) kullanılırken, iOS fallback'i anahtarı şifresiz `NSUserDefaults`'a (Capacitor Preferences) yazıyor.

**Çözüm:** iOS Keychain (SecureStorage plugin) kullanılmalı.

---

### 21. Production'da Console Log'ları

**Dosyalar:** `gmail.service.ts`, `calendar.service.ts` ve diğerleri

Token bilgileri ve API yanıtları dahil hata detayları console'a yazılıyor. `adb logcat` ile erişilebilir.

**Çözüm:** `import.meta.env.PROD` kontrolü ile production'da logları bastıran bir logger wrapper kullanılmalı.

---

### 22. `waitForSecureStorage` Plugin Dışı Hataları Yütuyor

**Dosya:** `src/main.tsx`

```typescript
} catch (e: any) {
    if (!e.message?.includes('not implemented')) {
        resolve(); // Plugin dışı gerçek hatalar da başarılı kabul ediliyor
    }
}
```

**Çözüm:** Sadece "not implemented" case'ini handle edip diğer hataları rethrow etmeli.

---

## PARSER Sorunları

### 23. QNB `canParse` Çok Geniş

**Dosya:** `src/services/email-parsing/parsers/qnb-email-parser.ts`

```typescript
canParse(email: EmailDetails): boolean {
    return email.sender.toLowerCase().includes('qnb');
}
```

Sender'da `"qnb"` geçen her e-posta eşleşiyor (phishing dahil).

**Çözüm:** `@qnb.com.tr` veya `@qnbfinansbank.com` domain kontrolü yapılmalı.

---

### 24. Ziraat Tutar Regex'i İlk `<center>` Etiketini Yakalar

**Dosya:** `src/services/email-parsing/parsers/ziraat-email-parser.ts`

```typescript
const amountRowMatch = content.match(/<center>\s*([\d.,]+)\s*(?:<\/b>)?\s*<\/center>/is);
```

E-posta HTML'inde tutar öncesinde digit içeren başka bir `<center>` etiketi varsa (yıl, kart no vb.) yanlış değer yakalanır.

**Çözüm:** Regex'i çevreleyen bağlama (etiket/label) göre daraltılmalı.

---

### 25. Tüm Parser'lar Hatada Sessizce `null` Döndürüyor

**Dosyalar:** `src/services/email-parsing/parsers/` altındaki tüm parser'lar

```typescript
} catch (error) {
    console.error('Parser error:', error);
    return null;
}
```

Banka format değiştirirse kullanıcı hiçbir uyarı almadan o bankanın kayıtlarını göremez.

**Çözüm:** "N e-posta ayrıştırılamadı" gibi bir bildirim mekanizması eklenmeli.

---

## TİP GÜVENLİĞİ Sorunları

### 26. `any` Tipleri Gerçek Hataları Bastırıyor

Birden fazla dosyada `any` cast'leri kullanılıyor:

- `DisplayItemList.tsx`: `(item as any).id`
- `encryptTransform.ts`: `@ts-ignore`
- `isbank-email-parser.ts`: `error: any`

**Çözüm:** `@ts-ignore` yerine `@ts-expect-error` kullanılmalı, `any` cast'leri uygun tiplerle değiştirilmeli.

---

### 27. `ManualEntry` ve `ParsedStatement` Ortak Tipe Sahip Değil

**Dosya:** `src/types/manual-entry.types.ts`

İkisi de görüntülenebilir finansal öğeler ama ayrı tip hiyerarşilerine sahip. Proper discriminated union oluşturulmalı.

---

### 28. `GmailSearchResponse` Tipi Export Edilmiyor

**Dosya:** `src/services/gmail.service.ts`

Mock dosyası bu tipe erişemiyor, bu da 4. sorunun (yanlış mock dönüş tipi) kök nedeni.

---

## DURUM YÖNETİMİ Sorunları

### 29. Servisler Redux Store'a Doğrudan Dispatch Yapıyor

**Dosyalar:** `gmail.service.ts`, `statement-processor.ts`

```typescript
import { getStore } from '../store';
getStore().dispatch(setLoading({ key: 'fetchEmails', value: true }));
```

Sıkı bağlantı (tight coupling) oluşturuyor ve servislerin izole test edilmesini zorlaştırıyor.

**Çözüm:** `createAsyncThunk` lifecycle action'ları (`pending`, `fulfilled`, `rejected`) kullanılmalı.

---

### 30. `selectGroupedLoans` ID String Parse'ına Dayanıyor

**Dosya:** `src/store/slices/dataSlice.ts`

```typescript
const loanId = item.id.match(/^loan_(.+)_taksit_\d+$/)?.[1];
```

**Çözüm:** Taksit oluşturma sırasında dedicated `loanId` alanı eklenmeli.

---

### 31. Redux Store Modül Yükleme Zamanında Hazır Değil

**Dosya:** `src/store/index.ts`

```typescript
let store: ReturnType<typeof initializeStore> | null = null;
export function getStore() {
    if (!store) throw new Error('Store not initialized');
    return store;
}
```

`initializeStore()` çağrılmadan önce `getStore()` çağıran herhangi bir modül hata fırlatır.

---

### 32. Toast State Redux Yerine Local State Olmalı

**Dosya:** `src/store/slices/toastSlice.ts`

Toast bildirimleri geçici UI state'idir, navigation veya app restart'ta hayatta kalması gerekmez. React context + `useReducer` daha uygun olur.

---

## MİMARİ Sorunlar

### 33. `LoanManagementPage` İkili Render Modu

**Dosya:** `src/pages/LoanManagementPage.tsx`

```typescript
return onClose ? content : <IonPage>{content}</IonPage>;
```

Modal olarak render edildiğinde `<IonPage>` olmadığı için Ionic lifecycle hook'ları ve safe area inset'leri çalışmıyor.

**Çözüm:** Modal sunumu için `<IonModal>` kullanılmalı.

---

### 34. `App.tsx` Deep Link Listener'da Stale Closure Riski

**Dosya:** `src/App.tsx`

`useRef` ile `totalDebt` senkronize ediliyor ama state güncellemesi ile ref sync'i arasında dar bir race condition var.

---

### 35. `statement-processor.ts` Tutarsız Import Stili

**Dosya:** `src/services/statement-parsing/statement-processor.ts`

Alias path'leri ile relative path'leri karışık kullanılıyor. Tek bir konvansiyona standardize edilmeli.

---

## TEST KAPSAMI

### Test Edilen

| Alan | Test Sayısı |
|------|-------------|
| 7 e-posta parser | Her biri ayrı test dosyası + mock fixture'lar |
| Akbank screenshot parser | 3 test |
| `dataSlice` reducer | 35 test |
| `generateAppId` | 5 test |
| `bank-entry-format` | Round-trip, pattern, null case testleri |
| `bank-registry` | Sabit, fonksiyon testleri |

### Test EDİLMEYEN

- `calendar.service.ts` — sıfır test (kırık template literal testi ile yakalanabilirdi)
- `gmail.service.ts` — gerçek implementasyon için sıfır test
- `statement-processor.ts` — entegrasyon testi yok
- `main.tsx` — initialization ve key management testi yok
- Tüm sayfa/bileşenler (`AccountTab`, `ManualEntryTab`, `SettingsTab`, `DisplayItemList`)
- `addMonths`, `parseTurkishDayMonth` edge case'leri
- `encryptTransform.ts` — encryption round-trip testi yok
- Tüm Redux selector'ları (`selectTotalDebt`, `selectGroupedLoans` vb.)

---

## ÖNCELİKLİ EYLEM PLANI

| Sıra | İş | Ciddiyet | Tahmini Efor |
|------|----|----------|--------------|
| 1 | `calendar.service.ts` template literal düzelt | Kritik | 5 dk |
| 2 | `firebase.ts` sil | Kritik | 1 dk |
| 3 | `isbank-email-parser.ts` döngüsel bağımlılığı kır | Kritik | 5 dk |
| 4 | `gmail.service.mock.ts` dönüş tipini düzelt | Kritik | 5 dk |
| 5 | `GoogleAuthPlugin.java` client ID'yi dışarı al | Kritik | 15 dk |
| 6 | `main.tsx` hata kurtarmada veri silme yerine retry | Önemli | 30 dk |
| 7 | `addMonths` düzelt | Önemli | 5 dk |
| 8 | `SettingsTab` import doğrulaması ekle | Önemli | 20 dk |
| 9 | `callNativeGoogleApi` ortak utility'ye çıkar | Önemli | 30 dk |
| 10 | Ölü import ve kodları temizle | Önemli | 15 dk |
| 11 | QNB parser domain kontrolü ekle | Parser | 5 dk |
| 12 | Parser hata bildirim mekanizması ekle | Parser | 1 saat |
| 13 | Eksik testleri yaz | Test | 2-3 saat |
