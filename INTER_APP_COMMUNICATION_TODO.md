# Uygulamalar Arası İletişim (Inter-App Communication) TODO Listesi

Bu döküman, "Codeyzer Portfoy" ve "Codeyzer Ekstre Takip" uygulamalarının birbirleriyle konuşarak borç verisini otomatik olarak senkronize etmesi için gereken adımları açıklamaktadır.

İletişim yöntemi olarak Android'in "Custom URL Schemes" (Özel URL Şemaları) özelliği kullanılacaktır.

---

## 1. "Codeyzer Ekstre Takip" Uygulaması (Veri Sağlayıcı)

Bu uygulamanın görevi, belirli bir URL çağrısını dinlemek, toplam borç tutarını hesaplamak ve sonucu başka bir URL çağrısıyla geri göndermektir.

### ✅ Adım 1.1: Gelen Çağrıyı Dinlemek (`AndroidManifest.xml`)

Uygulamanın dışarıdan gelen özel URL çağrılarını yakalayabilmesi için `AndroidManifest.xml` dosyasında ana `Activity`'nize bir `intent-filter` eklenmelidir.

**Yapılacak:** `AndroidManifest.xml` dosyasında, `<activity>` etiketinin içine aşağıdaki `<intent-filter>`'ı ekleyin.

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="codeyzer-ekstre-takip" android:host="borcu-getir" />
</intent-filter>
```

### ✅ Adım 1.2: Gelen `Intent`'i İşlemek (MainActivity.java / .kt)

Uygulama, Adım 1.1'de tanımlanan URL ile açıldığında, bu bilgiyi işleyecek kodu `MainActivity`'nize ekleyin.

**Yapılacak:** `MainActivity`'nin `onCreate` veya `onNewIntent` metoduna, gelen `Intent`'i kontrol eden ve borç hesaplama mantığını tetikleyen kodu ekleyin.

```java
// MainActivity.java (Örnek Kod)
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

@Override
protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleIntent(intent);
}

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    handleIntent(getIntent());
}

private void handleIntent(Intent intent) {
    Uri data = intent.getData();
    if (data != null && "codeyzer-ekstre-takip".equals(data.getScheme()) && "borcu-getir".equals(data.getHost())) {
        // 1. Toplam borcu hesaplayan kendi fonksiyonunuzu burada çağırın.
        double totalDebt = calculateTotalDebt(); // Bu fonksiyonu sizin yazmanız gerekiyor.

        // 2. Portföy uygulamasına geri cevap gönderin.
        sendDebtToPortfolioApp(totalDebt);
    }
}
```

### ✅ Adım 1.3: Veriyi Geri Göndermek

Toplam borç hesaplandıktan sonra, sonucu Portföy uygulamasına geri gönderecek fonksiyonu yazın.

**Yapılacak:** `MainActivity` içine aşağıdaki gibi bir fonksiyon ekleyin.

```java
// MainActivity.java (Örnek Kod)
private void sendDebtToPortfolioApp(double totalDebt) {
    // Portföy uygulamasının dinlediği özel URL'i oluşturun.
    String responseUrl = "codeyzer-portfoy://borc-geldi?tutar=" + totalDebt;
    Intent responseIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(responseUrl));
    
    // Aktivitenin yeni bir görev olarak başlatıldığından emin olun.
    responseIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

    try {
        startActivity(responseIntent);
    } catch (ActivityNotFoundException e) {
        // Portföy uygulaması yüklü değilse hata yönetimi.
        // Örneğin bir Toast mesajı gösterebilirsiniz.
    }
}

// Bu fonksiyon sizin borç hesaplama mantığınızı içermelidir.
private double calculateTotalDebt() {
    // TODO: Gerçek borç hesaplama mantığınızı buraya ekleyin.
    return 12345.67; // Örnek bir değer döndürüyor.
}
```

---

## 2. "Codeyzer Portfoy" Uygulaması (Veri Alıcı)

Bu uygulamanın görevi, veri isteği çağrısını başlatmak ve "Ekstre Takip" uygulamasından geri gelen cevabı dinleyip işlemektir.

### ✅ Adım 2.1: Gelen Cevabı Dinlemek (`android/app/src/main/AndroidManifest.xml`)

Uygulamanın, "Ekstre Takip" uygulamasından gönderilen borç verisini yakalayabilmesi için kendi `AndroidManifest.xml` dosyasını yapılandırın.

**Yapılacak:** Bu projenin `android/app/src/main/AndroidManifest.xml` dosyasında, ana `Activity`'nize aşağıdaki `<intent-filter>`'ı ekleyin.

```xml
<!-- Zaten var olan intent-filter'ın yanına YENİ bir tane olarak ekleyin -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="codeyzer-portfoy" android:host="borc-geldi" />
</intent-filter>
```

### ✅ Adım 2.2: Borç Senkronizasyon Butonu ve Çağrıyı Başlatma

Kullanıcının veri çekme işlemini başlatabileceği bir buton ekleyin ve bu butonun "Ekstre Takip" uygulamasını çağırmasını sağlayın.

**Yapılacak:**
1.  `DebtInputCard.tsx` bileşenini, manuel giriş yerine bir senkronizasyon butonu gösterecek şekilde güncelleyin.
2.  Bu buton tıklandığında, `capacitor/app` eklentisini kullanarak `codeyzer-ekstre-takip://borcu-getir` URL'ini açın.

### ✅ Adım 2.3: Gelen Veriyi Yakalama ve İşleme (`App.tsx`)

Uygulama, Adım 2.1'de tanımlanan URL ile açıldığında (veya öne getirildiğinde), bu veriyi yakalayıp Redux'a kaydedecek mantığı ekleyin.

**Yapılacak:** `App.tsx` dosyasında, Capacitor'un `App` eklentisinin `appUrlOpen` olay dinleyicisini kullanın.

```typescript
// App.tsx içindeki AuthGuard veya benzer bir ana bileşende
useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        const url = new URL(event.url);
        if (url.hostname === 'borc-geldi') {
            const debtAmount = parseFloat(url.searchParams.get('tutar') || '0');
            if (!isNaN(debtAmount)) {
                // Gelen borç tutarını Redux'a kaydet
                dispatch(setTotalDebt(debtAmount));
                // Kullanıcıya bildirim göster (Snackbar vb.)
            }
        }
    });

    return () => {
      CapacitorApp.removeAllListeners();
    };
}, [dispatch]);
```

### ✅ Adım 2.4: Manuel Girişi Kaldırma

Otomatik sistem kurulduğunda, `Dashboard`'daki manuel borç giriş kartını (`DebtInputCard.tsx`) kaldırın veya yeni senkronizasyon butonuyla değiştirin.
