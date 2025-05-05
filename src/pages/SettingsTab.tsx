import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, /*IonCard,*/ /*IonCardContent,*/ IonButton, useIonToast } from '@ionic/react';
import React/*, { useEffect }*/ from 'react'; // useEffect kaldırıldı
import './SettingsTab.css';

// İzinler için importlar
import {
  clearSmsPermission,
  clearSmsPermissionError,
  checkSmsPermissionThunk,
  requestSmsPermissionThunk,
} from '../store/slices/permissionSlice';

// Redux importları
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { signOutFromGoogleThunk } from '../store/slices/authSlice';
import { clearData } from '../store/slices/dataSlice';
import { addToast } from '../store/slices/toastSlice';

// Filtre ayarlama fonksiyonunu import et
// import { SmsReader } from '../plugins/sms-reader'; // Artık burada gerek yok
// import { allRelevantSenders, allRelevantKeywords } from '../services/sms-parsing/sms-processor'; // Artık burada gerek yok
import { setupNativeSmsFilters } from '../services/sms-parsing/sms-processor'; // Yeni yardımcıyı import et

// İzin durumlarını Türkçe'ye çeviren helper fonksiyonu
const translatePermissionStatus = (status: string | undefined): string => {
  if (!status) return 'Bilinmiyor';
  switch (status) {
    case 'granted': return 'İzin Verildi';
    case 'denied': return 'Reddedildi';
    case 'prompt': return 'Sorulacak';
    case 'prompt-with-rationale': return 'Açıklama ile Sorulacak';
    default: return status; // Beklenmedik durumlar için orijinal değeri döndür
  }
};

const SettingsTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { user: userInfo } = useSelector((state: RootState) => state.auth);
  const { sms: smsPermission, error: permissionError } = useSelector((state: RootState) => state.permissions);

  // Çıkış Yapma Fonksiyonu (AccountTab'den taşındı)
  const handleSignOut = () => {
    // Hata temizleme (opsiyonel, thunk yapabilir ama permission'ı burada yapalım)
    // dispatch(clearAuthError()); // Thunk'ta handle ediliyor
    // dispatch(clearSmsPermissionError()); // Permission hatası burada relevant değil

    dispatch(signOutFromGoogleThunk())
      .unwrap()
      .then(() => {
        console.log('SettingsTab: Google Sign-Out Thunk Başarılı.');
        // Diğer slice'ları temizle
        dispatch(clearSmsPermission());
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

  // İzin Kontrol Fonksiyonu (Sadece kontrol eder)
  const checkPermission = async () => {
    dispatch(clearSmsPermissionError());
    dispatch(checkSmsPermissionThunk())
      .unwrap()
      .then((status) => {
        console.log('[SettingsTab] SMS Permission Check Thunk Başarılı. Status:', status);
        dispatch(addToast({ message: `SMS İzin Durumu: ${translatePermissionStatus(status.readSms)}`, duration: 2000, color: 'success' }));
        // Başarılı kontrolde filtre ayarlamaya gerek yok, App.tsx halledecek
      })
      .catch((error) => {
        console.error('[SettingsTab] SMS Permission Check Thunk Hatası:', error);
        dispatch(addToast({
          message: `İzin kontrol hatası: ${error || 'Bilinmeyen bir hata oluştu.'}`, 
          duration: 3000,
          color: 'danger'
        }));
      });
  };

  // İzin İsteme Fonksiyonu (setupNativeSmsFilters çağrısı kaldırıldı)
  const requestPermission = async () => {
    dispatch(clearSmsPermissionError());
    dispatch(requestSmsPermissionThunk())
      .unwrap()
      .then((status) => {
        console.log('[SettingsTab] SMS Permission Request Thunk Successful. Status:', status);
        const message = `SMS İzin İsteği Sonucu: ${translatePermissionStatus(status.readSms)}`;
        const color = status.readSms === 'granted' ? 'success' : 'warning';
        dispatch(addToast({ message, duration: 2000, color }));

        // Filtre yapılandırması artık App.tsx'teki useEffect tarafından handle ediliyor.
        /*
        if (status.readSms === 'granted') {
          setupNativeSmsFilters()
            .catch(err => {
              console.error('[SettingsTab] Error calling setupNativeSmsFilters after request:', err);
              dispatch(addToast({ message: `Filtre ayarlanırken hata oluştu: ${err.message || err}`, duration: 3000, color: 'danger' }));
            });
        }
        */
      })
      .catch((error) => {
        console.error('[SettingsTab] SMS Permission Request Thunk Error:', error);
        dispatch(addToast({
          message: `İzin isteme hatası: ${error || 'Bilinmeyen bir hata oluştu.'}`, 
          duration: 3000,
          color: 'danger'
        }));
      });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="ion-padding-top">
          <IonTitle>Ayarlar</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Ayarlar</IonTitle>
          </IonToolbar>
        </IonHeader>
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

        {/* Giriş yapılmışsa İzin Yönetimi Kartı göster */} 
        {userInfo && (
            <div style={{ marginBottom: '15px' }}> 
                <p style={{ marginBottom: '10px' }}>
                  SMS Okuma İzin Durumu: <strong>{translatePermissionStatus(smsPermission?.readSms)}</strong>
                  <IonButton fill="clear" size="small" onClick={checkPermission} style={{ marginLeft: '10px' }}>
                     Kontrol Et
                  </IonButton>
                </p>
                {smsPermission?.readSms !== 'granted' && (
                  <IonButton expand="block" onClick={requestPermission} style={{ marginBottom: '5px' }}>
                    SMS Okuma İzni İste
                  </IonButton>
                )}
                {permissionError && (
                  <p style={{ color: 'var(--ion-color-danger)', marginTop: '10px' }}>İzin Hatası: {permissionError}</p>
                )}
            </div> 
        )}

        {/* Giriş yapılmamışsa bilgi mesajı */}
        {!userInfo && (
             <div style={{ marginBottom: '15px' }}> 
                <p>Hesap ve izin ayarlarını yönetmek için lütfen giriş yapın.</p>
            </div> 
        )}

        {/* Diğer ayarlar buraya eklenebilir */}

      </IonContent>
    </IonPage>
  );
};

export default SettingsTab; 