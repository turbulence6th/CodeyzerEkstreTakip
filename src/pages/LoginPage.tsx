import React from 'react';
import { IonContent, IonPage, IonButton, IonLabel, IonHeader, IonToolbar, IonTitle, IonCard, IonCardHeader, IonCardTitle, IonCardContent, useIonToast } from '@ionic/react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store'; 
import { signInWithGoogleThunk } from '../store/slices/authSlice';

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [presentToast] = useIonToast();

  const handleGoogleSignIn = async () => {
    dispatch(signInWithGoogleThunk())
      .unwrap()
      .then(() => {
        console.log('LoginPage: Google Sign-In Thunk Başarılı.');
        // Başarılı giriş sonrası App.tsx'deki conditional rendering 
        // otomatik olarak sekmeleri gösterecektir.
      })
      .catch((error) => {
        console.error('LoginPage: Google Sign-In Thunk Hatası:', error);
        presentToast({
          message: `Giriş hatası: ${error?.message || error || 'Bilinmeyen bir hata oluştu.'}`,
          duration: 3000,
          color: 'danger'
        });
      });
  };

  return (
    <IonPage>
      <IonHeader className="safe-area-header">
        <IonToolbar>
          <IonTitle>Giriş Yap</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard style={{ maxWidth: '400px', margin: 'auto', marginTop: '50px' }}>
          <IonCardHeader>
            <IonCardTitle className="ion-text-center">Ekstre Takvim</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p className="ion-text-center" style={{ marginBottom: '20px' }}>
              Devam etmek için lütfen Google hesabınızla giriş yapın.
              Bu, Gmail e-postalarınızı okumak ve takviminize etkinlik eklemek için gereklidir.
            </p>
            <IonButton expand="block" onClick={handleGoogleSignIn}>
              <IonLabel>Google ile Giriş Yap</IonLabel>
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage; 