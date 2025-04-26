import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonIcon, IonNote, useIonToast, IonLoading, IonModal, IonButtons, IonFooter, IonItemSliding, IonItemOptions, IonItemOption, IonRefresher, IonRefresherContent, RefresherEventDetail, useIonViewWillEnter, IonAlert } from '@ionic/react';
import './AccountTab.css';
import { useEffect, useState, useRef, useCallback } from 'react';
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
import { isStatement, isManualEntry } from '../utils/typeGuards';

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
  const [isCheckingCalendar, setIsCheckingCalendar] = useState(false);
  const [isAddingInstallments, setIsAddingInstallments] = useState(false);
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

      setIsCheckingCalendar(true);
      const newStatus: Record<string, boolean> = {};
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      for (const item of displayItems) {
        let itemKey = "";
        let summary = "";
        let targetDateForSearch = "";

        try {
        if (isStatement(item) && item.dueDate) {
            const targetDate = new Date(item.dueDate);
            targetDateForSearch = formatTargetDate(targetDate);
            summary = `${item.bankName} Kredi Kartı Son Ödeme`;
            itemKey = `${item.bankName}-${targetDateForSearch}-${item.last4Digits || 'null'}`;
            newStatus[itemKey] = await calendarService.searchEvents(summary, targetDateForSearch, timeZone);
          } else if (isManualEntry(item) && item.dueDate) {
            const targetDate = new Date(item.dueDate);
            targetDateForSearch = formatTargetDate(targetDate);
            summary = item.description;
            itemKey = `manual-${item.id}`;
            newStatus[itemKey] = await calendarService.searchEvents(summary, targetDateForSearch, timeZone);
          } else if (!isStatement(item) && !isManualEntry(item)) {
            const loan = item as ParsedLoan;
            if (loan.firstPaymentDate && loan.termMonths) {
                const targetDate = new Date(loan.firstPaymentDate);
                targetDateForSearch = formatTargetDate(targetDate);
                summary = `Kredi Taksidi - ${loan.bankName} - Taksit 1/${loan.termMonths}`;
                itemKey = `loan-${loan.bankName}-${targetDateForSearch}-${loan.termMonths}`;
                newStatus[itemKey] = await calendarService.searchEvents(summary, targetDateForSearch, timeZone);
            }
          }
        } catch (error: any) {
          console.error(`Error checking calendar status for item:`, item, error);
          if (itemKey) {
            if (isManualEntry(item) || isStatement(item)) {
            newStatus[itemKey] = false;
            }
          }
        }
      }
      console.log("AccountTab Effect: calendar status checked:", newStatus);
      setCalendarEventStatus(newStatus);
      setIsCheckingCalendar(false);
    };

    checkCalendarEvents();
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
    if (!item.dueDate) { 
        dispatch(addToast({ message: 'Etkinlik oluşturmak için son ödeme tarihi bilgisi eksik.', duration: 3000, color: 'warning', }));
        return;
    }

    dispatch(startGlobalLoading());
    try {
      const dueDate = new Date(item.dueDate);
      // Saati 10:00 olarak ayarla
      dueDate.setHours(10, 0, 0, 0); 
      const startTime = dueDate;
      const endTime = new Date(startTime.getTime());
      // Bitiş saatini 10:30 yapalım
      endTime.setHours(10, 30, 0, 0); 

      const startTimeIsoForApi = startTime.toISOString();
      const endTimeIsoForApi = endTime.toISOString();

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const targetDateForSearch = formatTargetDate(dueDate);

      let summary = "";
      let description = "";
      let itemKey = "";

      if (isManualEntry(item)) {
          summary = item.description;
          description = `Son Ödeme: ${formatDate(item.dueDate)}
Tutar: ${formatCurrency(item.amount)}`;
          itemKey = `manual-${item.id}`;
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
          itemKey = `${item.bankName}-${targetDateForSearch}-${item.last4Digits || 'null'}`;
      }

      if (calendarEventStatus[itemKey] === true) {
        console.log(`Event ${itemKey} already exists in calendar (checked from state).`);
        dispatch(addToast({ message: 'Bu etkinlik zaten takviminizde mevcut.', duration: 3000, color: 'warning', }));
        return;
      }

      const exists = await calendarService.searchEvents(summary, targetDateForSearch, timeZone);
      if (exists) {
         console.log(`Event ${itemKey} already exists in calendar (checked via API).`);
         setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
        dispatch(addToast({ message: 'Bu etkinlik zaten takviminizde mevcut.', duration: 3000, color: 'warning', }));
        return;
      }

      console.log(`Adding to calendar: ${summary} at ${startTimeIsoForApi}`);
      await calendarService.createEvent(summary, description, startTimeIsoForApi, endTimeIsoForApi, timeZone);
      setCalendarEventStatus(prevStatus => ({ ...prevStatus, [itemKey]: true }));
      dispatch(addToast({ message: 'Etkinlik başarıyla takvime eklendi.', duration: 2000, color: 'success', }));

    } catch (error: any) {
      console.error('Error adding event to calendar:', error);
      dispatch(addToast({ message: `Takvime eklenirken hata: ${error.message || 'Bilinmeyen bir hata oluştu.'}`, duration: 3000, color: 'danger', }));
    } finally {
      dispatch(stopGlobalLoading());
    }
  };

  const handleAddAllInstallments = async (loan: ParsedLoan) => {
    if (!loan.firstPaymentDate || !loan.termMonths || loan.termMonths <= 0) {
      dispatch(addToast({ message: 'Taksitleri eklemek için ilk ödeme tarihi ve taksit sayısı bilgisi gereklidir.', duration: 3000, color: 'warning', }));
      return;
    }

    setIsAddingInstallments(true);
    let addedCount = 0;
    let skippedCount = 0;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const originalFirstPaymentDate = new Date(loan.firstPaymentDate);

    try {
      for (let i = 0; i < loan.termMonths; i++) {
        // Her taksit için tarihi hesapla
        let installmentDate = addMonths(originalFirstPaymentDate, i); // 'let' olarak değiştirildi

        // --- HAFTA SONU KONTROLÜ --- 
        const dayOfWeek = installmentDate.getDay(); // 0: Pazar, 6: Cumartesi
        if (dayOfWeek === 0) { // Pazar ise 2 gün geri git (Cuma)
            installmentDate.setDate(installmentDate.getDate() - 2);
            console.log(`Adjusted date from Sunday to Friday for installment ${i + 1}`);
        } else if (dayOfWeek === 6) { // Cumartesi ise 1 gün geri git (Cuma)
            installmentDate.setDate(installmentDate.getDate() - 1);
            console.log(`Adjusted date from Saturday to Friday for installment ${i + 1}`);
        }
        // --- HAFTA SONU KONTROLÜ SONU ---

        installmentDate.setHours(10, 0, 0, 0); // Saati 10:00 yapalım (örnek)

        const startTime = installmentDate;
        const endTime = new Date(startTime.getTime());
        endTime.setHours(10, 30, 0, 0);

        const startTimeIsoForApi = startTime.toISOString();
        const endTimeIsoForApi = endTime.toISOString();
        const targetDateForSearch = formatTargetDate(installmentDate);

        const summary = `Kredi Taksidi - ${loan.bankName} - Taksit ${i + 1}/${loan.termMonths}`;
        let description = `Banka: ${loan.bankName}`;
        if (loan.installmentAmount !== null && loan.installmentAmount !== undefined) {
            description += `\nTaksit Tutarı: ${formatCurrency(loan.installmentAmount)}`;
        }
         if (loan.loanAmount !== null && loan.loanAmount !== undefined) {
            description += `\nToplam Kredi: ${formatCurrency(loan.loanAmount)}`;
        }
        if (loan.accountNumber) {
             description += `\nHesap No: ...${loan.accountNumber.slice(-4)}`;
        }
        description += `\nKaynak: ${loan.source.toUpperCase()}`;

        try {
            const exists = await calendarService.searchEvents(summary, targetDateForSearch, timeZone);

            if (exists) {
                console.log(`Installment ${i + 1} already exists for ${loan.bankName}. Skipping.`);
                skippedCount++;
            } else {
                console.log(`Adding installment ${i + 1} for ${loan.bankName} on ${targetDateForSearch}`);
                await calendarService.createEvent(summary, description, startTimeIsoForApi, endTimeIsoForApi, timeZone);
                addedCount++;
            }

            await new Promise(resolve => setTimeout(resolve, 250));

        } catch (error: any) {
             console.error(`Error processing installment ${i + 1} for ${loan.bankName}:`, error);
             dispatch(addToast({ message: `${i + 1}. taksit işlenirken hata: ${error.message || 'Bilinmeyen hata'}. Diğer taksitler deneniyor.`, duration: 4000, color: 'danger', })); 
             skippedCount++;
        }
      }

      let finalMessage = '';
      if (addedCount > 0 && skippedCount > 0) {
          finalMessage = `${addedCount} taksit başarıyla eklendi, ${skippedCount} taksit zaten mevcuttu veya hata oluştu.`;
      } else if (addedCount > 0) {
          finalMessage = `${addedCount} taksit başarıyla takvime eklendi.`;
      } else if (skippedCount > 0) {
           finalMessage = `Tüm ${skippedCount} taksit zaten takviminizde mevcut veya işlenirken hata oluştu.`;
      } else {
           finalMessage = 'Taksit ekleme işlemi tamamlandı ancak hiçbir taksit eklenmedi veya bulunamadı.';
    }
      dispatch(addToast({ message: finalMessage, duration: 3000, color: addedCount > 0 ? 'success' : 'warning', })); 

    } catch (globalError: any) {
        console.error('General error adding installments:', globalError);
        dispatch(addToast({ message: `Taksitler eklenirken genel bir hata oluştu: ${globalError.message || 'Bilinmeyen hata'}`, duration: 3000, color: 'danger', })); 
    } finally {
        setIsAddingInstallments(false);
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
      console.log(`Deleting manual entry with ID: ${id}`);
      // TODO: Kullanıcıdan onay almak için bir Alert eklenebilir.
      try {
          dispatch(deleteManualEntry(id));
          dispatch(addToast({ message: 'Kayıt başarıyla silindi.', duration: 2000, color: 'success', }));
      } catch (error: any) {
           console.error("Error deleting manual entry:", error);
           dispatch(addToast({ message: `Kayıt silinirken hata oluştu: ${error.message || 'Bilinmeyen hata'}`, duration: 3000, color: 'danger', }));
      }
      // Sliding item'ı kapatmaya gerek yok, Redux state'i güncelleyince kaybolacak.
  };

  return (
    <IonPage>
      <IonLoading
        isOpen={isLoading || isAddingInstallments || isCheckingCalendar}
        message={isAddingInstallments ? 'Taksitler takvime ekleniyor...' : isCheckingCalendar ? 'Takvim kontrol ediliyor...' : 'Veriler işleniyor...'}
      />
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
                               : 'Ekstre ve kredi bilgilerini otomatik görmek için lütfen Ayarlar sekmesinden SMS okuma iznini verin.'} // Diğer durumlarda mesaj
                         </IonCardContent>
                     </IonCard>
                  )}

             <DisplayItemList 
                items={displayItems}
                calendarEventStatus={calendarEventStatus}
                isCheckingCalendar={isCheckingCalendar}
                isAddingInstallments={isAddingInstallments}
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
