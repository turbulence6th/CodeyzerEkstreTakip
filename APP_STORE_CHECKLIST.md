# App Store Yayınlama Kontrol Listesi

Bu rapor, uygulamanın App Store'a yayınlanması için gereken değişiklikleri ve eksikleri listeler.

---

## KRITIK - Hemen Yapılması Gerekenler

### 1. Şifreleme Beyanı (ITSAppUsesNonExemptEncryption)
**Durum:** EKSIK

Info.plist'e eklenmelidir. Bu olmadan her build yüklemesinde Apple şifreleme sorusu sorar.

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

> Not: Uygulama HTTPS kullanıyor ancak özel şifreleme algoritması kullanmıyorsa `false` olmalı.

---

### 2. Privacy Policy URL
**Durum:** EKSIK - KRİTİK

Apple, kullanıcı verisi toplayan tüm uygulamalar için gizlilik politikası URL'si zorunlu tutar.

**Yapılması Gerekenler:**
- Gizlilik politikası metni hazırlanmalı (Türkçe/İngilizce)
- Bir web sitesinde barındırılmalı (GitHub Pages, Notion, vb.)
- App Store Connect'e URL eklenmeli

**Uygulamanın Topladığı Veriler:**
- Google hesap bilgileri (email, ad)
- Gmail erişimi (ekstre e-postaları)
- Google Takvim erişimi
- Fotoğraf kitaplığı (screenshot OCR için)
- Kamera erişimi

---

### 3. App Store Connect - Data Privacy Beyanları
**Durum:** YAPILMALI

App Store Connect'te "App Privacy" bölümünde aşağıdaki veri türleri beyan edilmeli:

| Veri Türü | Kullanım Amacı | Kullanıcıya Bağlı |
|-----------|----------------|-------------------|
| Email Adresi | Hesap Tanımlama | Evet |
| Ad | Kişiselleştirme | Evet |
| Finansal Bilgiler | Uygulama İşlevselliği | Evet |
| Fotoğraflar | Uygulama İşlevselliği | Hayır |

---

## ORTA ÖNCELİK

### 4. Version Numarası
**Durum:** Güncellenmeli

- **Mevcut:** `package.json` = 0.0.1, Xcode = 1.0
- **Öneri:** Her ikisini de 1.0.0 olarak senkronize edin

---

### 5. App Transport Security (ATS)
**Durum:** Kontrol Edilmeli

Info.plist'te ATS ayarı yok, bu iyi. Varsayılan olarak tüm HTTP bağlantıları engellenir.

**Kullanılan API'ler:**
- Google APIs (HTTPS) ✓
- Firebase (HTTPS) ✓

ATS ek ayarı gerekmiyor.

---

### 6. Minimum iOS Sürümü
**Durum:** iOS 14.0 - UYGUN

iOS 14.0 minimum sürüm olarak ayarlanmış. App Store için uygun.

---

## DÜŞÜK ÖNCELİK (ama önemli)

### 7. Uygulama İkonları
**Durum:** MEVCUT ✓

- 1024x1024 App Icon mevcut (`AppIcon-512@2x.png`)

**Kontrol Edilmeli:**
- İkon alpha/şeffaflık içermemeli
- İkon köşeleri düz olmalı (iOS otomatik yuvarlar)

---

### 8. Launch Screen / Splash
**Durum:** MEVCUT ✓

- Splash görselleri mevcut (2732x2732)

---

### 9. Entitlements Dosyası
**Durum:** EKSIK

Xcode'da otomatik oluşturulabilir. Sign in with Apple kullanmıyorsanız zorunlu değil.

---

## APP STORE CONNECT HAZIRLIK

### 10. Metadata (App Store Connect'te Girilmeli)

| Alan | Durum | Açıklama |
|------|-------|----------|
| App Name | Girilmeli | "Codeyzer Ekstre Takip" veya kısa versiyon |
| Subtitle | Girilmeli | Max 30 karakter |
| Description | Girilmeli | Uygulama açıklaması |
| Keywords | Girilmeli | SEO için anahtar kelimeler |
| Support URL | Girilmeli | Destek sayfası URL'si |
| Privacy Policy URL | KRİTİK | Gizlilik politikası URL'si |
| Category | Girilmeli | "Finance" kategorisi önerilir |
| Age Rating | Girilmeli | 4+ uygun |

---

### 11. Screenshots
**Durum:** HAZIRLANMALI

Minimum gerekli screenshot boyutları:
- **6.7" (iPhone 15 Pro Max):** 1290 x 2796 px
- **6.5" (iPhone 11 Pro Max):** 1284 x 2778 px
- **5.5" (iPhone 8 Plus):** 1242 x 2208 px

**iPad için (opsiyonel ama önerilir):**
- **12.9" (iPad Pro):** 2048 x 2732 px

---

### 12. Google API OAuth Consent Screen
**Durum:** KONTROL EDİLMELİ

Google Cloud Console'da:
- OAuth consent screen "Production" modunda olmalı
- Tüm scope'lar listelenmiş olmalı
- App verification (gerekirse) tamamlanmış olmalı

**Kullanılan Scope'lar:**
- `gmail.readonly` - Gmail okuma
- `calendar` veya `calendar.events` - Takvim erişimi
- `userinfo.email` - Email adresi
- `userinfo.profile` - Profil bilgisi

---

## YAPILACAKLAR ÖZETİ

### Hemen Yapılması Gerekenler (Red Flags):

- [ ] **Info.plist'e `ITSAppUsesNonExemptEncryption` ekle**
- [ ] **Gizlilik politikası hazırla ve URL al**
- [ ] **App Store Connect'te Data Privacy beyanlarını doldur**

### Build Öncesi:

- [ ] Version numaralarını senkronize et (1.0.0)
- [ ] `npm run build:ios` çalıştır
- [ ] Xcode'da Archive oluştur
- [ ] App Store Connect'e yükle

### App Store Connect'te:

- [ ] Tüm metadata alanlarını doldur
- [ ] Screenshots ekle
- [ ] Privacy Policy URL ekle
- [ ] Age rating belirle
- [ ] Review için gönder

---

## EK NOTLAR

### Google Sign-In Review
Apple, Google Sign-In kullanan uygulamaları genellikle sorunsuz onaylar. Ancak "Sign in with Apple" da sunmanız istenebilir (Login sayfasında alternatif olarak).

### Finansal Uygulama Uyarısı
Bu uygulama finansal veri işlediği için Apple review ekibi daha dikkatli inceleyebilir. Açıklamada şunları vurgulayın:
- Uygulama sadece kullanıcının kendi verilerini işler
- Üçüncü taraflarla veri paylaşılmaz
- Veriler cihazda şifreli saklanır

---

## HIZLI DÜZELTMELER

### Info.plist'e Eklenecekler:

```xml
<!-- App Store - Şifreleme beyanı -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Bu değişikliği yaptıktan sonra:
```bash
npm run build:ios
cd ios/App && pod install
```

Ardından Xcode'dan Archive → Distribute → App Store Connect.
