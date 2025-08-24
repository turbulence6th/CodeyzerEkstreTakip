import React, { useEffect, useRef } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
  IonLoading,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { addOutline, listCircleOutline, settingsOutline } from 'ionicons/icons';
import AccountTab from './pages/AccountTab';
import ManualEntryTab from './pages/ManualEntryTab';
import SettingsTab from './pages/SettingsTab';
import LoginPage from './pages/LoginPage';
import ToastManager from './components/ToastManager';
import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';


/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store';
import { selectTotalDebt } from './store/slices/dataSlice';

setupIonicReact();

const App: React.FC = () => {
  // Global state'leri al
  const { isActive: isGlobalLoading, message: loadingMessage } = useSelector((state: RootState) => state.loading);
  const isAuthenticated = useSelector((state: RootState) => !!state.auth.idToken);
  const totalDebt = useSelector(selectTotalDebt);
  const totalDebtRef = useRef(totalDebt);
  
  useEffect(() => {
    totalDebtRef.current = totalDebt;
  }, [totalDebt]);

  const dispatch = useDispatch();

  useEffect(() => {
    // Sadece kimlik doğrulanmışsa dinleyiciyi kur
    if (!isAuthenticated) return;

    let listenerHandle: PluginListenerHandle | null = null;

    const registerListener = async () => {
        listenerHandle = await CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
            const url = new URL(event.url);
            if (url.hostname === 'borcu-getir' && url.protocol === 'codeyzer-ekstre-takip:') {
                console.log('Borç getirme isteği alındı!', event.url);

                // Her zaman en güncel borç bilgisini kullanmak için ref'i oku
                const currentTotalDebt = totalDebtRef.current;
                const responseUrl = `codeyzer-portfoy://borc-geldi?tutar=${currentTotalDebt}`;
                
                console.log(`Hesaplanan toplam borç: ${currentTotalDebt}. Portföy uygulamasına yönlendiriliyor: ${responseUrl}`);

                // Başka bir uygulamayı URL şeması ile açmak için AppLauncher kullanılır.
                AppLauncher.openUrl({ url: responseUrl }).catch((err: any) => {
                    console.error('Portföy uygulaması açılamadı', err);
                    // TODO: Kullanıcıya Portföy uygulamasının yüklü olmadığına dair bir bildirim gösterilebilir.
                });
            }
        });
    };

    registerListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [isAuthenticated]);


  return (
  <IonApp>
    <ToastManager />
    <IonReactRouter>
      {isAuthenticated ? (
          // Kullanıcı giriş yapmışsa ana sekmeleri göster
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/account">
                <AccountTab />
              </Route>
              <Route exact path="/statements">
                <AccountTab />
              </Route>
              <Route exact path="/add">
                <ManualEntryTab />
              </Route>
              <Route path="/settings">
                <SettingsTab />
              </Route>
              <Route exact path="/">
                <Redirect to="/statements" />
              </Route>
              {/* Eğer login sayfasına gitmeye çalışırsa anasayfaya yönlendir */}
              <Route exact path="/login">
                  <Redirect to="/statements" />
              </Route>
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              <IonTabButton tab="statements" href="/statements">
                <IonIcon aria-hidden="true" icon={listCircleOutline} />
                <IonLabel>Ekstreler</IonLabel>
              </IonTabButton>
              <IonTabButton tab="add" href="/add">
                <IonIcon aria-hidden="true" icon={addOutline} />
                <IonLabel>Ekle</IonLabel>
              </IonTabButton>
              <IonTabButton tab="settings" href="/settings">
                <IonIcon aria-hidden="true" icon={settingsOutline} />
                <IonLabel>Ayarlar</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
      ) : (
          // Kullanıcı giriş yapmamışsa LoginPage'i göster
          <IonRouterOutlet>
              <Route exact path="/login">
                  <LoginPage />
              </Route>
              {/* Diğer tüm yolları login'e yönlendir */}
              <Redirect to="/login" />
          </IonRouterOutlet>
      )}
    </IonReactRouter>
      {/* Global Loading Göstergesi */}
      <IonLoading 
          isOpen={isGlobalLoading} 
          message={loadingMessage || ''} 
      />
  </IonApp>
);
};

export default App;
