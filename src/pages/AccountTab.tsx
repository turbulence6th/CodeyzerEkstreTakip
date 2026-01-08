import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonIcon, IonNote, useIonToast, IonModal, IonButtons, IonFooter, IonItemSliding, IonItemOptions, IonItemOption, IonRefresher, IonRefresherContent, RefresherEventDetail, IonAlert } from '@ionic/react';
import './AccountTab.css';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { GoogleAuth } from '@plugins/google-auth';
import type { GoogleUser } from '@plugins/google-auth';
import { Capacitor } from '@capacitor/core'; 

// Tipler
import type { ParsedStatement } from '../services/sms-parsing/types';
import type { SmsDetails, EmailDetails } from '../services/sms-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// Servisler
import { gmailService, calendarService } from '../services';
import { statementProcessor } from '../services/sms-parsing/sms-processor';
import { calendarService as oldCalendarService } from '../services/calendar.service';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store'; 

import {
  clearData,
  fetchAndProcessDataThunk,
  deleteManualEntry,
  selectAllDataWithDates,
  togglePaidStatus, // togglePaidStatus import edildi
} from '../store/slices/dataSlice';
import { startGlobalLoading, stopGlobalLoading } from '../store/slices/loadingSlice';
import { checkSmsPermissionThunk } from '../store/slices/permissionSlice';
import { addToast } from '../store/slices/toastSlice';

import { addOutline, mailOutline, cashOutline, calendarOutline, chatbubbleEllipsesOutline, documentTextOutline, trashOutline, walletOutline } from 'ionicons/icons';

// Yeni eklenen bileşeni import et
import DetailsModal from '../components/DetailsModal'; 
import DisplayItemList from '../components/DisplayItemList'; // Yeni liste bileşeni import edildi

// Utils importları
import { formatDate, formatCurrency, formatTargetDate } from '../utils/formatting';
import { generateAppId } from '../utils/identifiers';
import { isStatement, isManualEntry } from '../utils/typeGuards';

type DisplayItem = ParsedStatement | ManualEntry;

// Helper function to add months safely - BU FONKSİYON ARTIK formatting.ts İÇİNDE
// function addMonths...

// iOS'ta SMS okuma mümkün değil, bu yüzden SMS izni kontrolünü atla
const getIsIOSPlatform = (): boolean => {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  console.log('[AccountTab] Platform check:', { platform, isNative });
  // iOS veya native olmayan platform (web) ise SMS izni gerekmez
  return platform === 'ios' || !isNative;
};

const AccountTab: React.FC = () => {
  // Platform kontrolünü component içinde yapalım
  const isIOSPlatform = getIsIOSPlatform();
  const dispatch = useDispatch<AppDispatch>();
  const [presentToast] = useIonToast();
  const [calendarEventStatus, setCalendarEventStatus] = useState<Record<string, boolean>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("Detay");

  const { user: userInfo, error: authError } = useSelector((state: RootState) => state.auth);
  const { sms: smsPermission, error: permissionError } = useSelector((state: RootState) => state.permissions);
  const displayItems = useSelector(selectAllDataWithDates);
  const dataError = useSelector((state: RootState) => state.data.error);
  const lastUpdated = useSelector((state: RootState) => state.data.lastUpdated);
  const isLoading = useSelector((state: RootState) => state.loading.isActive);

  const combinedError = authError || permissionError || dataError;

  // fetchAndProcessData fonksiyonunu useCallback ile sarmala (useEffect bağımlılıkları için)
  const fetchAndProcessData = useCallback(async () => {
    dispatch(fetchAndProcessDataThunk())
      .unwrap()
      .then((result) => {
        console.log(`Data Fetch Thunk Başarılı. ${result.totalItems} öğe bulundu.`);
        dispatch(addToast({
            message: result.totalItems > 0
                ? `${result.totalItems} kayıt başarıyla getirildi.`
                : 'İlgili ekstre bulunamadı.',
            duration: 2000,
            color: result.totalItems > 0 ? 'success' : 'warning',
        }));
      })
      .catch((error) => {
        console.error('Data Fetch Thunk Hatası:', error);
        dispatch(addToast({
            message: `Veriler getirilirken hata oluştu: ${error || 'Bilinmeyen bir hata oluştu.'}`,
            duration: 3000,
            color: 'danger',
        }));
      });
  }, [dispatch]);

  useEffect(() => {
    // İlk veri çekme
    // iOS'ta SMS izni yok, sadece email ile çalışır
    const canFetchData = isIOSPlatform || smsPermission?.readSms === 'granted';
    if (userInfo && canFetchData && lastUpdated === null) {
        console.log('AccountTab: Initial data fetch triggered.');
        fetchAndProcessData();
    }
    // fetchAndProcessData bağımlılığı güncellendi
  }, [userInfo, smsPermission, lastUpdated, fetchAndProcessData]);

  useEffect(() => {
    const checkCalendarEvents = async () => {
      if (!userInfo || displayItems.length === 0) {
        setCalendarEventStatus({});
        setLoadingItems({});
        return;
      }

      // Sadece henüz kontrol edilmemiş itemleri filtrele
      const allUnpaidItems = displayItems.filter(item => !item.isPaid);
      const itemsToCheck = allUnpaidItems.filter(item => {
        const appId = generateAppId(item);
        return appId && calendarEventStatus[appId] === undefined;
      });

      // Kontrol edilecek itemler için loading başlat
      const initialLoadingState: Record<string, boolean> = {};
      itemsToCheck.forEach(item => {
        const appId = generateAppId(item);
        if (appId) {
          initialLoadingState[appId] = true;
        }
      });

      setLoadingItems(initialLoadingState);

      // Eğer kontrol edilecek item yoksa, hemen çık
      if (itemsToCheck.length === 0) {
        return;
      }

      // Tüm kontrolleri paralel olarak başlat
      const checkPromises = itemsToCheck.map(async (item) => {
        const appIdToCheck = generateAppId(item);
        if (!appIdToCheck) {
          console.warn('Could not generate AppID for calendar check:', item);
          return null;
        }

        try {
          const status = await calendarService.searchEvents(appIdToCheck);

          // Her sonuç geldiğinde state'i güncelle
          setCalendarEventStatus(prev => ({ ...prev, [appIdToCheck]: status }));
          setLoadingItems(prev => ({ ...prev, [appIdToCheck]: false }));

          return { appId: appIdToCheck, status };
        } catch (error: any) {
          console.error(`Error checking calendar status for AppID: ${appIdToCheck}`, item, error);

          setCalendarEventStatus(prev => ({ ...prev, [appIdToCheck]: false }));
          setLoadingItems(prev => ({ ...prev, [appIdToCheck]: false }));

          return { appId: appIdToCheck, status: false };
        }
      });

      // Tüm kontrollerin bitmesini bekle
      const results = await Promise.all(checkPromises);
      console.log("AccountTab Effect: calendar status checked:", results.filter(r => r !== null));
    };

    checkCalendarEvents();
  }, [displayItems, userInfo]);

  // YENİ useEffect: İzin durumunu otomatik kontrol et (sadece Android için)
  useEffect(() => {
      // iOS'ta SMS okuma izni yok, bu yüzden kontrolü atla
      if (isIOSPlatform) return;

      if (smsPermission === null || smsPermission === undefined) {
          console.log('AccountTab: SMS permission status is unknown, dispatching check...');
          dispatch(checkSmsPermissionThunk());
      }
  }, [dispatch, smsPermission]);

  // Yenileme işlemini yönetecek fonksiyon
  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    console.log('Pull-to-refresh triggered');
    // iOS'ta SMS izni gerekmez, sadece email ile çalışır
    const canRefresh = isIOSPlatform || smsPermission?.readSms === 'granted';
    if (!canRefresh) {
      dispatch(addToast({
        message: 'Verileri yenilemek için Ayarlar sekmesinden SMS okuma izni verin.',
        duration: 3000,
        color: 'warning',
      }));
      event.detail.complete(); // İzin yoksa da refresher'ı bitir
      return;
    }
    // fetchAndProcessData zaten hata durumunda toast gösteriyor
    await fetchAndProcessData();
    event.detail.complete(); // İşlem bitince refresher animasyonunu durdur
  };

  const handleAddToCalendar = async (item: ParsedStatement | ManualEntry) => {
    const itemDate = isStatement(item) || isManualEntry(item) ? item.dueDate : null;
    if (!itemDate) {
        dispatch(addToast({ message: 'Etkinlik oluşturmak için tarih bilgisi eksik.', duration: 3000, color: 'warning', }));
        return;
    }
    const itemKey = generateAppId(item);
    if (!itemKey) {
        dispatch(addToast({ message: 'Etkinlik için benzersiz kimlik oluşturulamadı.', duration: 3000, color: 'danger', }));
        return;
    }

    // Bu item için loading başlat
    setLoadingItems(prev => ({ ...prev, [itemKey]: true }));
    try {
      const dueDate = new Date(itemDate);
      dueDate.setHours(10, 0, 0, 0);
      const startTime = dueDate;
      const endTime = new Date(startTime.getTime());
      endTime.setHours(10, 30, 0, 0);

      const startTimeIsoForApi = startTime.toISOString();
      const endTimeIsoForApi = endTime.toISOString();

      let summary = "";
      let description = "";

      if (isManualEntry(item)) {
          summary = item.description;
          description = `Son Ödeme: ${formatDate(item.dueDate)}
Tutar: ${formatCurrency(item.amount)}`;
      } else {
          summary = `${item.bankName} Kredi Kartı Son Ödeme`;
          description = `Son Ödeme Tarihi: ${formatDate(item.dueDate)}`;
          if (item.amount !== null && item.amount !== undefined) {
             description += `\nSon Ödeme Tutarı: ${formatCurrency(item.amount)}`;
          }
          if (item.last4Digits) {
               description += `\nKart: ...${item.last4Digits}`;
          }
          description += `\nKaynak: ${item.source.toUpperCase()}`;
      }

      description += `\n\n${itemKey}`;

      if (calendarEventStatus[itemKey] === true) {
        console.log(`Event ${itemKey} already exists in calendar (checked from state).`);
        dispatch(addToast({ message: 'Bu etkinlik zaten takviminizde mevcut.', duration: 3000, color: 'warning', }));
        setLoadingItems(prev => ({ ...prev, [itemKey]: false }));
        return;
      }

      const exists = await calendarService.searchEvents(itemKey);
      if (exists) {
         console.log(`Event ${itemKey} already exists in calendar (checked via API).`);
         setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
        dispatch(addToast({ message: 'Bu etkinlik zaten takviminizde mevcut.', duration: 3000, color: 'warning', }));
        setLoadingItems(prev => ({ ...prev, [itemKey]: false }));
        return;
      }

      console.log(`Adding to calendar: ${summary} for ${itemKey}`);
      await calendarService.createEvent(summary, description, startTimeIsoForApi, endTimeIsoForApi);
      setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
      dispatch(addToast({ message: 'Etkinlik başarıyla takvime eklendi.', duration: 2000, color: 'success', }));
    } catch (error: any) {
      console.error('Error adding event to calendar:', error);
      dispatch(addToast({ message: `Takvime eklenirken hata oluştu: ${error.message || 'Bilinmeyen bir hata oluştu.'}`, duration: 3000, color: 'danger', }));
    } finally {
      // Bu item için loading bitir
      setLoadingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };


  const handleItemClick = (item: DisplayItem) => {
      let title = "Detay";
      let content = "İçerik bulunamadı.";
      
      if (isManualEntry(item)) {
          title = `Manuel Kayıt: ${item.description}`;
          content = `Açıklama: ${item.description}\nSon Ödeme: ${formatDate(item.dueDate)}\nTutar: ${formatCurrency(item.amount)}\nID: ${item.id}`;
      } else if (isStatement(item) && item.originalMessage) {
          title = `${item.bankName} Ekstre Detayı`;
          if (item.source === 'sms') {
              const sms = item.originalMessage as SmsDetails;
              content = `Gönderen: ${sms.sender}\nZaman: ${new Date(sms.date).toLocaleString('tr-TR')}\n\n${sms.body}`;
          } else {
              const email = item.originalMessage as EmailDetails;
              content = `Gönderen: ${email.sender}\nKonu: ${email.subject}\nZaman: ${new Date(email.date).toLocaleString('tr-TR')}\n\n--- İçerik ---\n${email.plainBody || 'Düz metin içerik yok.'}`;
          }
      } else {
          content = 'Detaylar görüntülenemiyor.';
      }

      setModalTitle(title);
      setModalContent(content);
      setIsModalOpen(true);
  };

  const handleDeleteManualEntry = (id: string) => {
    dispatch(startGlobalLoading('Kayıt siliniyor...'));
    try {
        dispatch(deleteManualEntry(id));
        dispatch(addToast({ message: 'Manuel kayıt başarıyla silindi.', duration: 2000, color: 'success' }));
    } catch (error: any) {
        console.error('Error deleting manual entry:', error);
        dispatch(addToast({ message: `Kayıt silinirken hata: ${error.message || 'Bilinmeyen hata'}`, duration: 3000, color: 'danger' }));
    } finally {
        dispatch(stopGlobalLoading());
    }
  };

  const handleTogglePaidStatus = (id: string) => {
      dispatch(togglePaidStatus(id));
  };

  return (
    <IonPage>
      <DetailsModal 
        isOpen={isModalOpen}
        title={modalTitle}
        content={modalContent}
        onDismiss={() => setIsModalOpen(false)}
      />
      <IonHeader>
        <IonToolbar>
          <IonTitle>Ekstreler</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/loan-management" color="primary">
              <IonIcon slot="icon-only" icon={walletOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Ekstreler</IonTitle>
          </IonToolbar>
        </IonHeader>

        {combinedError && (
          <IonCard color="warning">
            <IonCardContent className="error-card-content">
              {combinedError}
            </IonCardContent>
          </IonCard>
        )}

        {userInfo && (
          <div>
                  {/* İzin durumu bilinmiyorsa veya reddedilmişse uyarıyı göster - iOS'ta SMS izni yok */}
                  {!isIOSPlatform && (smsPermission === null || (smsPermission && smsPermission.readSms !== 'granted')) && (
                     <IonCard /* color="warning" kaldırıldı */ >
                         <IonCardContent className="permission-warning-text ion-text-center">
                             {smsPermission === null
                               ? 'SMS izin durumu kontrol ediliyor...' // Durum null iken mesaj
                               : 'Ekstre bilgilerini otomatik görmek için lütfen Ayarlar sekmesinden SMS okuma iznini verin.'}
                         </IonCardContent>
                     </IonCard>
                  )}

             <DisplayItemList
                items={displayItems}
                calendarEventStatus={calendarEventStatus}
                loadingItems={loadingItems}
                onItemClick={handleItemClick}
                onAddToCalendar={handleAddToCalendar}
                // onAddAllInstallments prop'u kaldırıldı
                onDeleteManualEntry={handleDeleteManualEntry}
                onTogglePaidStatus={handleTogglePaidStatus}
             />
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AccountTab;
