import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonButton, useIonToast } from '@ionic/react';
// import './Tab3.css'; // CSS dosyasının adı da değişmeli mi? Şimdilik bırakıyorum.
import './SettingsTab.css'; // Updated CSS import

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

  // Gerekli state'leri Redux'tan al
  const { user: userInfo, accessToken } = useSelector((state: RootState) => state.auth);
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

  // İzin Kontrol Fonksiyonu (AccountTab'den taşındı)
  const checkPermission = async () => {
    dispatch(clearSmsPermissionError()); // Önceki hatayı temizle
    dispatch(checkSmsPermissionThunk())
      .unwrap()
      .then((status) => {
        console.log('SettingsTab: SMS Permission Check Thunk Başarılı. Status:', status);
        dispatch(addToast({ message: `SMS İzin Durumu: ${translatePermissionStatus(status.readSms)}`, duration: 2000, color: 'success' }));
      })
      .catch((error) => {
        console.error('SettingsTab: SMS Permission Check Thunk Hatası:', error);
        dispatch(addToast({
          message: `İzin kontrol hatası: ${error || 'Bilinmeyen bir hata oluştu.'}`,
          duration: 3000,
          color: 'danger'
        }));
      });
  };

  // İzin İsteme Fonksiyonu (AccountTab'den taşındı)
  const requestPermission = async () => {
    dispatch(clearSmsPermissionError()); // Önceki hatayı temizle
    dispatch(requestSmsPermissionThunk())
      .unwrap()
      .then((status) => {
        console.log('SettingsTab: SMS Permission Request Thunk Başarılı. Status:', status);
        dispatch(addToast({ message: `SMS İzin İsteği Sonucu: ${translatePermissionStatus(status.readSms)}`, duration: 2000, color: status.readSms === 'granted' ? 'success' : 'warning' }));
      })
      .catch((error) => {
        console.error('SettingsTab: SMS Permission Request Thunk Hatası:', error);
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
            <IonCard>
                <IonCardContent>
                    <p style={{ marginBottom: '10px'}}>Giriş Yapılan Hesap: {userInfo.email}</p>
                    <IonButton expand="block" color="danger" onClick={handleSignOut}>
                        Google Hesabından Çıkış Yap
                    </IonButton>
                </IonCardContent>
            </IonCard>
        )}

        {/* Giriş yapılmışsa İzin Yönetimi Kartı göster */} 
        {userInfo && (
            <IonCard>
                <IonCardContent>
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
                </IonCardContent>
            </IonCard>
        )}

        {/* Giriş yapılmamışsa bilgi mesajı */}
        {!userInfo && (
             <IonCard>
                <IonCardContent>
                    <p>Hesap ve izin ayarlarını yönetmek için lütfen giriş yapın.</p>
                </IonCardContent>
            </IonCard>
        )}

        {/* Diğer ayarlar buraya eklenebilir */}

      </IonContent>
    </IonPage>
  );
};

export default SettingsTab; 