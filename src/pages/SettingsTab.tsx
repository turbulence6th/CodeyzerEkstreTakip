import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, useIonAlert, IonTextarea, IonModal, IonButtons, IonIcon, IonInput, IonItem, IonLabel } from '@ionic/react';
import React, { useState, useRef, useEffect } from 'react';
import './SettingsTab.css';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { cloudDownloadOutline, cloudUploadOutline, documentOutline } from 'ionicons/icons';

// Redux importları
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { signOutFromGoogleThunk } from '../store/slices/authSlice';
import { clearData, importData } from '../store/slices/dataSlice';
import { addToast } from '../store/slices/toastSlice';
import { setRentSettings, clearRentSettings, selectRentSettings } from '../store/slices/settingsSlice';

const SettingsTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [presentAlert] = useIonAlert();

  const { user: userInfo } = useSelector((state: RootState) => state.auth);
  const dataItems = useSelector((state: RootState) => state.data.items);
  const rentSettings = useSelector(selectRentSettings);

  // Kira ayarları local state
  const [rentAmountInput, setRentAmountInput] = useState<string>('');
  const [rentPaymentDayInput, setRentPaymentDayInput] = useState<string>('');

  // Redux'tan gelen kira değerlerini input'lara yükle
  useEffect(() => {
    setRentAmountInput(rentSettings.rentAmount !== null ? String(rentSettings.rentAmount) : '');
    setRentPaymentDayInput(rentSettings.rentPaymentDay !== null ? String(rentSettings.rentPaymentDay) : '');
  }, [rentSettings.rentAmount, rentSettings.rentPaymentDay]);

  // Modal state'leri
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export fonksiyonu - dosya olarak kaydedip paylaş
  const handleExport = async () => {
    try {
      const exportData = {
        version: 1,
        exportDate: new Date().toISOString(),
        items: dataItems,
      };
      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `ekstre-takip-backup-${new Date().toISOString().split('T')[0]}.json`;

      // Dosyayı kaydet
      const result = await Filesystem.writeFile({
        path: fileName,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      console.log('File saved:', result.uri);

      // Dosyayı paylaş
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: 'Ekstre Takip Verileri',
          url: result.uri,
          dialogTitle: 'Verileri Paylaş',
        });
        dispatch(addToast({ message: 'Dosya paylaşıma hazır!', duration: 2000, color: 'success' }));
      } else {
        // Paylaşım desteklenmiyorsa clipboard'a kopyala
        await Clipboard.write({ string: jsonString });
        dispatch(addToast({ message: 'Veriler panoya kopyalandı!', duration: 2000, color: 'success' }));
      }
    } catch (error: any) {
      console.error('Export error:', error);
      // Paylaşım iptal edildiyse hata gösterme
      if (!error?.message?.includes('cancel')) {
        dispatch(addToast({ message: 'Export hatası: ' + error.message, duration: 3000, color: 'danger' }));
      }
    }
  };

  // Import fonksiyonu
  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);

      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Geçersiz veri formatı');
      }

      presentAlert({
        header: 'Verileri İçe Aktar',
        message: `${parsed.items.length} kayıt bulundu. Mevcut verilerle birleştirmek mi yoksa değiştirmek mi istiyorsunuz?`,
        buttons: [
          {
            text: 'İptal',
            role: 'cancel',
          },
          {
            text: 'Birleştir',
            handler: () => {
              dispatch(importData({ items: parsed.items, merge: true }));
              dispatch(addToast({ message: 'Veriler birleştirildi!', duration: 2000, color: 'success' }));
              setIsImportModalOpen(false);
              setImportText('');
            },
          },
          {
            text: 'Değiştir',
            handler: () => {
              dispatch(importData({ items: parsed.items, merge: false }));
              dispatch(addToast({ message: 'Veriler içe aktarıldı!', duration: 2000, color: 'success' }));
              setIsImportModalOpen(false);
              setImportText('');
            },
          },
        ],
      });
    } catch (error: any) {
      console.error('Import error:', error);
      dispatch(addToast({ message: 'Geçersiz veri formatı: ' + error.message, duration: 3000, color: 'danger' }));
    }
  };

  // Panodan yapıştır
  const handlePasteFromClipboard = async () => {
    try {
      const result = await Clipboard.read();
      if (result.value) {
        setImportText(result.value);
        dispatch(addToast({ message: 'Panodan yapıştırıldı', duration: 1500, color: 'success' }));
      }
    } catch (error) {
      dispatch(addToast({ message: 'Panodan okuma hatası', duration: 2000, color: 'warning' }));
    }
  };

  // Dosyadan okuma
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportText(content);
        dispatch(addToast({ message: 'Dosya okundu', duration: 1500, color: 'success' }));
      }
    };
    reader.onerror = () => {
      dispatch(addToast({ message: 'Dosya okuma hatası', duration: 2000, color: 'danger' }));
    };
    reader.readAsText(file);

    // Input'u sıfırla (aynı dosyayı tekrar seçebilmek için)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Kira ayarlarını kaydet
  const handleSaveRent = () => {
    const amount = parseFloat(rentAmountInput.replace(',', '.'));
    const day = parseInt(rentPaymentDayInput, 10);

    if (isNaN(amount) || amount <= 0) {
      dispatch(addToast({ message: 'Geçerli bir kira tutarı girin.', duration: 2000, color: 'warning' }));
      return;
    }
    if (isNaN(day) || day < 1 || day > 28) {
      dispatch(addToast({ message: 'Ödeme günü 1-28 arasında olmalıdır.', duration: 2000, color: 'warning' }));
      return;
    }

    dispatch(setRentSettings({ amount, paymentDay: day }));
    dispatch(addToast({ message: 'Kira ayarları kaydedildi.', duration: 2000, color: 'success' }));
    setIsRentModalOpen(false);
  };

  // Kira ayarlarını sil
  const handleClearRent = () => {
    presentAlert({
      header: 'Kira Ayarlarını Sil',
      message: 'Kira ayarları silinecek. Otomatik kayıt oluşturulmayacak.',
      buttons: [
        { text: 'İptal', role: 'cancel' },
        {
          text: 'Sil',
          role: 'destructive',
          handler: () => {
            dispatch(clearRentSettings());
            dispatch(addToast({ message: 'Kira ayarları silindi.', duration: 2000, color: 'success' }));
          },
        },
      ],
    });
  };

  // Çıkış Yapma Fonksiyonu (AccountTab'den taşındı)
  const handleSignOut = () => {
    dispatch(signOutFromGoogleThunk())
      .unwrap()
      .then(() => {
        console.log('SettingsTab: Google Sign-Out Thunk Başarılı.');
        // Diğer slice'ları temizle
        dispatch(clearData());
        dispatch(addToast({ message: 'Başarıyla çıkış yapıldı.', duration: 2000, color: 'success'}));
      })
      .catch((error) => {
        console.error('SettingsTab: Google Sign-Out Thunk Hatası:', error);
        dispatch(addToast({
          message: `Çıkış hatası: ${error || 'Bilinmeyen bir hata oluştu.'}`,
          duration: 3000,
          color: 'danger'
        }));
      });
  };

  return (
    <IonPage>
      <IonHeader className="safe-area-header">
        <IonToolbar>
          <IonTitle>Ayarlar</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {/* ExploreContainer kaldırıldı */}
        {/* <ExploreContainer name="Ayarlar page" /> */}

        {/* Giriş yapılmışsa Hesap Yönetimi Kartı göster */}
        {userInfo && (
            <div style={{ marginBottom: '15px' }}> 
                <p style={{ marginBottom: '10px'}}>Giriş Yapılan Hesap: {userInfo.email}</p>
                <IonButton expand="block" color="danger" onClick={handleSignOut}>
                    Google Hesabından Çıkış Yap
                </IonButton>
            </div>
        )}

        {/* Giriş yapılmamışsa bilgi mesajı */}
        {!userInfo && (
             <div style={{ marginBottom: '15px' }}> 
                <p>Hesap ve izin ayarlarını yönetmek için lütfen giriş yapın.</p>
            </div> 
        )}

        {/* Veri Yönetimi - Export/Import */}
        {userInfo && (
            <div style={{ marginBottom: '15px', marginTop: '20px' }}>
                <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Veri Yönetimi</p>
                <p style={{ marginBottom: '10px', fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
                  Verilerinizi başka bir cihaza aktarmak için export/import kullanabilirsiniz.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <IonButton expand="block" onClick={handleExport} style={{ flex: 1 }}>
                    <IonIcon slot="start" icon={cloudUploadOutline} />
                    Export ({dataItems.length})
                  </IonButton>
                  <IonButton expand="block" onClick={() => setIsImportModalOpen(true)} style={{ flex: 1 }}>
                    <IonIcon slot="start" icon={cloudDownloadOutline} />
                    Import
                  </IonButton>
                </div>
            </div>
        )}

        {/* Kira Ayarları - Özet Satır */}
        <div style={{ marginBottom: '15px', marginTop: '20px' }}>
          <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Kira Ayarları</p>
          {rentSettings.rentAmount !== null ? (
            <p style={{ marginBottom: '10px', fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
              {rentSettings.rentAmount.toLocaleString('tr-TR')} ₺ — Her ayın {rentSettings.rentPaymentDay}. günü
              {rentSettings.lastRentEntryMonth && ` (Son kayıt: ${rentSettings.lastRentEntryMonth})`}
            </p>
          ) : (
            <p style={{ marginBottom: '10px', fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
              Henüz kira ayarı yapılmadı. Ayarlamak için düzenle butonuna basın.
            </p>
          )}
          <IonButton expand="block" fill="outline" onClick={() => setIsRentModalOpen(true)}>
            Kira Ayarlarını Düzenle
          </IonButton>
        </div>

        {/* Kira Ayarları Modal */}
        <IonModal isOpen={isRentModalOpen} onDidDismiss={() => setIsRentModalOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Kira Ayarları</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setIsRentModalOpen(false)}>Kapat</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <p style={{ marginBottom: '16px', fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
              Ayın ilk iş günü otomatik kira kaydı oluşturulur.
            </p>
            <IonItem lines="full" style={{ marginBottom: '8px' }}>
              <IonLabel position="stacked">Aylık Kira Tutarı (₺)</IonLabel>
              <IonInput
                type="number"
                inputmode="decimal"
                value={rentAmountInput}
                onIonInput={(e) => setRentAmountInput(e.detail.value || '')}
                placeholder="Örn: 5000"
                min={0}
              />
            </IonItem>
            <IonItem lines="full" style={{ marginBottom: '20px' }}>
              <IonLabel position="stacked">Ödeme Günü (1-28)</IonLabel>
              <IonInput
                type="number"
                inputmode="numeric"
                value={rentPaymentDayInput}
                onIonInput={(e) => setRentPaymentDayInput(e.detail.value || '')}
                placeholder="Örn: 5"
                min={1}
                max={28}
              />
            </IonItem>
            <IonButton expand="block" onClick={handleSaveRent} style={{ marginBottom: '10px' }}>
              Kaydet
            </IonButton>
            {rentSettings.rentAmount !== null && (
              <IonButton expand="block" fill="outline" color="danger" onClick={handleClearRent}>
                Kira Ayarını Sil
              </IonButton>
            )}
          </IonContent>
        </IonModal>

        {/* Import Modal */}
        <IonModal isOpen={isImportModalOpen} onDidDismiss={() => setIsImportModalOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Veri İçe Aktar</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setIsImportModalOpen(false)}>Kapat</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <p style={{ marginBottom: '10px' }}>
              Export edilen JSON dosyasını seçin veya içeriğini yapıştırın:
            </p>

            {/* Gizli file input */}
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <IonButton
                expand="block"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1 }}
              >
                <IonIcon slot="start" icon={documentOutline} />
                Dosya Seç
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={handlePasteFromClipboard}
                style={{ flex: 1 }}
              >
                Panodan Yapıştır
              </IonButton>
            </div>

            <IonTextarea
              value={importText}
              onIonInput={(e) => setImportText(e.detail.value || '')}
              placeholder='{"version": 1, "items": [...]}'
              rows={10}
              style={{
                border: '1px solid var(--ion-color-medium)',
                borderRadius: '8px',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            />
            <IonButton
              expand="block"
              onClick={handleImport}
              disabled={!importText.trim()}
              style={{ marginTop: '15px' }}
            >
              İçe Aktar
            </IonButton>
          </IonContent>
        </IonModal>

      </IonContent>
    </IonPage>
  );
};

export default SettingsTab; 