import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonDatetime,
    IonButton,
    IonCardContent,
    IonDatetimeButton, // Datetime butonu için
    IonModal, // Datetime modalı için
    IonNote,
    IonSelect,
    IonSelectOption
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { addManualEntry } from '../store/slices/dataSlice'; // Yorum kaldırıldı
import { startGlobalLoading, stopGlobalLoading } from '../store/slices/loadingSlice';
import { addToast } from '../store/slices/toastSlice';

// Yeni tipi import edelim (Doğru yol)
import type { ManualEntry } from '../types/manual-entry.types';

// Eski SMS ile ilgili importlar ve kodlar kaldırıldı

const ManualEntryTab: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();

    // Form state'leri
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<string>(''); // String olarak alıp sonra sayıya çevireceğiz
    const [dueDate, setDueDate] = useState<string | undefined>(new Date().toISOString()); // ISO 8601 formatında string
    const [entryType, setEntryType] = useState<'debt' | 'expense' | 'loan'>('debt'); // Kredi eklendi
    const [installmentCount, setInstallmentCount] = useState<string>(''); // Kredi için taksit sayısı
    const [formattedDueDate, setFormattedDueDate] = useState<string>(''); // Gösterilecek formatlanmış tarih

    // dueDate değiştiğinde formatlanmış tarihi güncelle
    useEffect(() => {
        if (dueDate) {
            try {
                const dateObj = new Date(dueDate);
                setFormattedDueDate(dateObj.toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }));
            } catch (e) {
                setFormattedDueDate('Geçersiz Tarih');
            }
        } else {
            setFormattedDueDate(''); // Tarih seçilmemişse boşalt
        }
    }, [dueDate]);

    const handleSave = () => {
        // Validasyon
        if (!description || !dueDate || !amount) {
             dispatch(addToast({ message: 'Lütfen tüm alanları doldurun.', duration: 3000, color: 'warning' }));
            return;
        }

        // Kredi için taksit sayısı kontrolü
        if (entryType === 'loan' && !installmentCount) {
             dispatch(addToast({ message: 'Kredi için taksit sayısı girmelisiniz.', duration: 3000, color: 'warning' }));
            return;
        }

        const parsedAmount = parseFloat(amount.replace(',', '.')); // Virgülü noktaya çevir
        if (isNaN(parsedAmount)) {
             dispatch(addToast({ message: 'Lütfen geçerli bir tutar girin.', duration: 3000, color: 'warning' }));
            return;
        }

        const parsedInstallmentCount = entryType === 'loan' ? parseInt(installmentCount) : undefined;
        if (entryType === 'loan' && (isNaN(parsedInstallmentCount!) || parsedInstallmentCount! <= 0)) {
             dispatch(addToast({ message: 'Lütfen geçerli bir taksit sayısı girin.', duration: 3000, color: 'warning' }));
            return;
        }

        const dueDateObj = new Date(dueDate);
         // Saati ayarlayalım (isteğe bağlı, örn. öğlen 12)
        dueDateObj.setHours(12, 0, 0, 0);

        // Basit bir ID oluştur
        const newEntryId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // ManualEntry nesnesi oluştur
        const newEntry: ManualEntry = {
            id: newEntryId,
            description: description,
            amount: parsedAmount,
            dueDate: dueDateObj,
            source: 'manual',
            entryType: entryType,
            installmentCount: parsedInstallmentCount,
        };

        // Mesaj eklendi
        dispatch(startGlobalLoading('Kaydediliyor...'));
        try {
             // Dispatch işlemi aktifleştirildi
             dispatch(addManualEntry(newEntry));

             dispatch(addToast({
                message: entryType === 'loan'
                    ? `Kredi kaydı başarıyla eklendi. ${parsedInstallmentCount} taksit oluşturulacak.`
                    : 'Kayıt başarıyla eklendi.',
                duration: 2000,
                color: 'success'
             }));
            // Formu temizle
            setDescription('');
            setAmount('');
            setDueDate(undefined);
            setInstallmentCount('');
            setEntryType('debt');
        } catch (error: any) {
             console.error('Error saving manual entry:', error);
             dispatch(addToast({ message: `Kayıt kaydedilirken hata: ${error.message || 'Bilinmeyen hata'}`, duration: 3000, color: 'danger' }));
        } finally {
            dispatch(stopGlobalLoading());
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar className="ion-padding-top">
                    <IonTitle>Manuel Kayıt Ekle</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen className="ion-padding">
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Manuel Kayıt Ekle</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonList>
                    <IonItem>
                        <IonLabel>Kayıt Türü</IonLabel>
                        <IonSelect
                            value={entryType}
                            onIonChange={e => setEntryType(e.detail.value)}
                            interface="popover"
                        >
                            <IonSelectOption value="debt">Borç</IonSelectOption>
                            <IonSelectOption value="expense">Harcama</IonSelectOption>
                            <IonSelectOption value="loan">Kredi</IonSelectOption>
                        </IonSelect>
                    </IonItem>

                    <IonItem>
                        <IonInput
                            label="Açıklama / Banka Adı"
                            labelPlacement="stacked"
                            value={description}
                            onIonInput={(e) => setDescription(e.detail.value!)}
                            placeholder="Örn: Kira Ödemesi, Ziraat Ekstre, İhtiyaç Kredisi"
                            clearInput
                        ></IonInput>
                    </IonItem>
                    <IonItem>
                        <IonInput
                            label={entryType === 'loan' ? 'Aylık Taksit Tutarı (TL)' : 'Tutar (TL)'}
                            labelPlacement="stacked"
                            type="number" // Klavye için
                            inputmode='decimal' // Daha iyi mobil klavye
                            value={amount}
                            onIonInput={(e) => setAmount(e.detail.value!)}
                            placeholder={entryType === 'loan' ? 'Örn: 500.00' : 'Örn: 1500.50'}
                            clearInput
                        ></IonInput>
                    </IonItem>

                    {entryType === 'loan' && (
                        <IonItem>
                            <IonInput
                                label="Taksit Sayısı"
                                labelPlacement="stacked"
                                type="number"
                                inputmode='numeric'
                                value={installmentCount}
                                onIonInput={(e) => setInstallmentCount(e.detail.value!)}
                                placeholder="Örn: 12"
                                clearInput
                            ></IonInput>
                        </IonItem>
                    )}

                    <IonItem lines="none">
                         <IonLabel>{entryType === 'loan' ? 'İlk Taksit Tarihi' : 'Son Ödeme Tarihi'}</IonLabel>
                         <div slot="end" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                             <IonDatetimeButton datetime="dueDate"></IonDatetimeButton>
                             <IonModal keepContentsMounted={true}>
                                 <IonDatetime
                                    id="dueDate"
                                    value={dueDate}
                                    onIonChange={(e) => setDueDate(e.detail.value?.toString())}
                                    presentation="date"
                                    showDefaultButtons={true}
                                    doneText="Tamam"
                                    cancelText="İptal"
                                    firstDayOfWeek={1}
                                ></IonDatetime>
                             </IonModal>
                         </div>
                    </IonItem>
                </IonList>
                 <IonButton
                    expand="block"
                    onClick={handleSave}
                    style={{ marginTop: '20px' }}
                    disabled={!description || !dueDate || !amount || (entryType === 'loan' && !installmentCount)}
                 >
                    Kaydet
                 </IonButton>
            </IonContent>
        </IonPage>
    );
};

export default ManualEntryTab; 