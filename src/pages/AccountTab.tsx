import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonIcon, IonNote, useIonToast, IonModal, IonButtons, IonFooter, IonItemSliding, IonItemOptions, IonItemOption, IonRefresher, IonRefresherContent, RefresherEventDetail, IonAlert } from '@ionic/react';
import './AccountTab.css';
import { useEffect, useState, useCallback } from 'react';
import { GoogleAuth } from '@plugins/google-auth';
import type { GoogleUser } from '@plugins/google-auth'; 

// Tipler
import type { ParsedStatement, ParsedLoan } from '../services/sms-parsing/types';
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
} from '../store/slices/dataSlice';
import { startGlobalLoading, stopGlobalLoading } from '../store/slices/loadingSlice';
import { checkSmsPermissionThunk } from '../store/slices/permissionSlice';
import { addToast } from '../store/slices/toastSlice';

import { addOutline, mailOutline, cashOutline, calendarOutline, chatbubbleEllipsesOutline, documentTextOutline, trashOutline } from 'ionicons/icons';

// Yeni eklenen bileşeni import et
import DetailsModal from '../components/DetailsModal'; 
import DisplayItemList from '../components/DisplayItemList'; // Yeni liste bileşeni import edildi

// Utils importları
import { formatDate, formatCurrency, formatTargetDate } from '../utils/formatting';
import { generateAppId } from '../utils/identifiers';
import { isStatement, isManualEntry, isLoan } from '../utils/typeGuards';

type DisplayItem = ParsedStatement | ParsedLoan | ManualEntry;

// Helper function to add months safely
function addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    const expectedMonth = (d.getMonth() + months) % 12;
    d.setMonth(d.getMonth() + months);
    // If the month didn't change as expected (e.g., adding 1 month to Jan 31 resulted in Mar 2/3),
    // set the date to the last day of the *previous* month.
    if (d.getMonth() !== expectedMonth) {
        d.setDate(0); // Sets the date to the last day of the previous month
    }
    return d;
}

const AccountTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [presentToast] = useIonToast();
  const [calendarEventStatus, setCalendarEventStatus] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("Detay");

  const { user: userInfo, accessToken, error: authError } = useSelector((state: RootState) => state.auth);
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
                : 'İlgili ekstre veya kredi bulunamadı.',
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
    if (accessToken && smsPermission?.readSms === 'granted' && lastUpdated === null) {
        console.log('AccountTab: Initial data fetch triggered.');
        fetchAndProcessData();
    }
    // fetchAndProcessData bağımlılığı güncellendi
  }, [accessToken, smsPermission, lastUpdated, fetchAndProcessData]);

  useEffect(() => {
    const checkCalendarEvents = async () => {
      if (!accessToken || displayItems.length === 0) {
        setCalendarEventStatus({});
        return;
      }

      dispatch(startGlobalLoading('Takvim kontrol ediliyor...'));
      const newStatus: Record<string, boolean> = {};

      // Orijinal for...of döngüsü
      for (const item of displayItems) {
          const appIdToCheck = isLoan(item) ? generateAppId(item, 1) : generateAppId(item);
          if (!appIdToCheck) {
            console.warn('Could not generate AppID for calendar check:', item);
            continue;
          }
          try {
            const status = await calendarService.searchEvents(accessToken!, appIdToCheck);
            newStatus[appIdToCheck] = status;
          } catch (error: any) {
            console.error(`Error checking calendar status for AppID: ${appIdToCheck}`, item, error);
            newStatus[appIdToCheck] = false; // Hata durumunda false ata
          }
      }

      console.log("AccountTab Effect: calendar status checked:", newStatus);
      setCalendarEventStatus(newStatus);
      // stopGlobalLoading döngüden sonra çağrılıyor
      dispatch(stopGlobalLoading());
    };

    checkCalendarEvents();
    // dispatch bağımlılığı tekrar kaldırıldı (önceki gibi)
  }, [displayItems, accessToken]);

  // YENİ useEffect: İzin durumunu otomatik kontrol et
  useEffect(() => {
      if (smsPermission === null || smsPermission === undefined) {
          console.log('AccountTab: SMS permission status is unknown, dispatching check...');
          dispatch(checkSmsPermissionThunk());
      }
  }, [dispatch, smsPermission]);

  // Yenileme işlemini yönetecek fonksiyon
  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    console.log('Pull-to-refresh triggered');
    if (smsPermission?.readSms !== 'granted') {
      dispatch(addToast({ 
        message: 'Verileri yenilemek için SMS okuma izni gerekli.', 
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

    dispatch(startGlobalLoading('Takvime ekleniyor...'));
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
        dispatch(stopGlobalLoading());
        return;
      }

      const exists = await calendarService.searchEvents(accessToken!, itemKey);
      if (exists) {
         console.log(`Event ${itemKey} already exists in calendar (checked via API).`);
         setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
        dispatch(addToast({ message: 'Bu etkinlik zaten takviminizde mevcut.', duration: 3000, color: 'warning', }));
        dispatch(stopGlobalLoading());
        return;
      }

      console.log(`Adding to calendar: ${summary} for ${itemKey}`);
      await calendarService.createEvent(accessToken!, summary, description, startTimeIsoForApi, endTimeIsoForApi);
      setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
      dispatch(addToast({ message: 'Etkinlik başarıyla takvime eklendi.', duration: 2000, color: 'success', }));
    } catch (error: any) {
      console.error('Error adding event to calendar:', error);
      dispatch(addToast({ message: `Takvime eklenirken hata oluştu: ${error.message || 'Bilinmeyen bir hata oluştu.'}`, duration: 3000, color: 'danger', }));
    } finally {
      dispatch(stopGlobalLoading());
    }
  };

  const handleAddAllInstallments = async (loan: ParsedLoan) => {
    if (!loan.firstPaymentDate || !loan.termMonths || !loan.installmentAmount) {
        dispatch(addToast({ message: 'Taksitleri eklemek için ilk ödeme tarihi, vade ve taksit tutarı bilgisi gerekli.', duration: 3000, color: 'warning', }));
        return;
    }

    dispatch(startGlobalLoading('Taksitler ekleniyor...'));
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const firstPayment = new Date(loan.firstPaymentDate);

      for (let i = 0; i < loan.termMonths; i++) {
          let paymentDate = addMonths(firstPayment, i);
          
          const dayOfWeek = paymentDate.getDay();
          if (dayOfWeek === 0) {
              paymentDate.setDate(paymentDate.getDate() - 2);
          } else if (dayOfWeek === 6) {
              paymentDate.setDate(paymentDate.getDate() - 1);
          }

          paymentDate.setHours(10, 0, 0, 0);
          const startTime = paymentDate;
          const endTime = new Date(startTime.getTime());
          endTime.setHours(10, 30, 0, 0);

          const startTimeIsoForApi = startTime.toISOString();
          const endTimeIsoForApi = endTime.toISOString();

          const installmentNumber = i + 1;
          const summary = `Kredi Taksidi - ${loan.bankName} - Taksit ${installmentNumber}/${loan.termMonths}`;
          const description = `Tutar: ${formatCurrency(loan.installmentAmount)}
Banka: ${loan.bankName}
Kaynak: ${loan.source.toUpperCase()}`;
          
          const installmentKey = generateAppId(loan, installmentNumber);
          if (!installmentKey) {
              console.warn(`Could not generate AppID for installment ${installmentNumber} of loan:`, loan);
              errorCount++;
              continue;
          }
          
          const finalDescription = `${description}\n\n${installmentKey}`;

          try {
              if (calendarEventStatus[installmentKey] === true) {
                  console.log(`Installment ${installmentKey} already exists in calendar (checked from state).`);
                  skippedCount++;
                  continue;
              }

              const exists = await calendarService.searchEvents(accessToken!, installmentKey);
              if (exists) {
                  console.log(`Installment ${installmentKey} already exists in calendar (checked via API).`);
                  setCalendarEventStatus(prevStatus => ({ ...prevStatus, [installmentKey]: true }));
                  skippedCount++;
                  continue;
              }

              console.log(`Adding installment to calendar: ${summary} for ${installmentKey}`);
              await calendarService.createEvent(accessToken!, summary, finalDescription, startTimeIsoForApi, endTimeIsoForApi);
              setCalendarEventStatus(prevStatus => ({ ...prevStatus, [installmentKey]: true }));
              addedCount++;

          } catch (searchCreateError: any) {
              console.error(`Error searching/creating calendar event for installment ${installmentKey}:`, searchCreateError);
              errorCount++;
          }
      }
    } catch (loopError: any) {
        console.error('Error processing installments:', loopError);
        dispatch(addToast({ message: `Taksitler işlenirken bir hata oluştu: ${loopError.message || 'Bilinmeyen hata'}`, duration: 3000, color: 'danger', }));
    } finally {
        dispatch(stopGlobalLoading());
        let resultMessage = "";
        if (addedCount > 0) resultMessage += `${addedCount} taksit başarıyla eklendi. `; 
        if (skippedCount > 0) resultMessage += `${skippedCount} taksit zaten mevcuttu. `; 
        if (errorCount > 0) resultMessage += `${errorCount} taksit eklenirken hata oluştu.`;
        if (!resultMessage) resultMessage = 'İşlem tamamlandı, eklenen veya güncellenen taksit yok.';
        
        dispatch(addToast({ 
            message: resultMessage.trim(), 
            duration: 4000, 
            color: errorCount > 0 ? 'danger' : (addedCount > 0 ? 'success' : 'warning') 
        }));
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
      } else if (!isStatement(item) && !isManualEntry(item)) {
           const loan = item as ParsedLoan;
           title = `${loan.bankName || 'Kredi'} Detayı`;
           if (loan.originalMessage && loan.source === 'sms') {
                const sms = loan.originalMessage as SmsDetails;
                content = `Gönderen: ${sms.sender}\nZaman: ${new Date(sms.date).toLocaleString('tr-TR')}\n\n${sms.body}`;
           } else {
               content = `Banka: ${loan.bankName || 'Bilinmiyor'}\nİlk Ödeme: ${formatDate(loan.firstPaymentDate)}\nTaksit Tutarı: ${formatCurrency(loan.installmentAmount)}\nVade: ${loan.termMonths || '-'} Ay\n\nOrijinal mesaj içeriği bulunamadı veya desteklenmiyor.`;
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

  return (
    <IonPage>
      <DetailsModal 
        isOpen={isModalOpen}
        title={modalTitle}
        content={modalContent}
        onDismiss={() => setIsModalOpen(false)}
      />
      <IonHeader>
        <IonToolbar className="ion-padding-top">
          <IonTitle>Ekstreler & Krediler</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Ekstreler & Krediler</IonTitle>
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
                  {/* İzin durumu bilinmiyorsa veya reddedilmişse uyarıyı göster */}
                  {(smsPermission === null || (smsPermission && smsPermission.readSms !== 'granted')) && (
                     <IonCard /* color="warning" kaldırıldı */ >
                         <IonCardContent className="permission-warning-text ion-text-center">
                             {smsPermission === null
                               ? 'SMS izin durumu kontrol ediliyor...' // Durum null iken mesaj
                               : 'Ekstre ve kredi bilgilerini otomatik görmek için lütfen Ayarlar sekmesinden SMS okuma iznini verin.'} 
                         </IonCardContent>
                     </IonCard>
                  )}

             <DisplayItemList 
                items={displayItems}
                calendarEventStatus={calendarEventStatus}
                onItemClick={handleItemClick}
                onAddToCalendar={handleAddToCalendar}
                onAddAllInstallments={handleAddAllInstallments}
                onDeleteManualEntry={handleDeleteManualEntry}
             />
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AccountTab;
