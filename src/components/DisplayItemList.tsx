import React, { useState } from 'react';
import {
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItemSliding,
    IonItem,
    IonIcon,
    IonLabel,
    IonButton,
    IonSpinner,
    IonItemOptions,
    IonItemOption,
    IonAlert,
    IonModal,
    IonDatetime,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
} from '@ionic/react';
import {
    mailOutline,
    cashOutline,
    calendarOutline,
    chatbubbleEllipsesOutline,
    documentTextOutline,
    trashOutline,
    addOutline,
    arrowUndoCircleOutline, // Yeni ikon
    receiptOutline, // Yeni ikon
    warningOutline, // Haftasonu uyarısı için
    createOutline, // Tutar düzenleme ikonu (swipe)
} from 'ionicons/icons';

// Tipler
import type { ParsedStatement } from '../services/statement-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// Yeni utils'leri import et
import { formatDate, formatCurrency, isWeekend } from '../utils/formatting';
import { isStatement, isManualEntry } from '../utils/typeGuards';
import { generateAppId } from '../utils/identifiers';

// Yeni importlar
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

type DisplayItem = ParsedStatement | ManualEntry;

// --- Yardımcı Fonksiyonlar kaldırıldı ---

interface DisplayItemListProps {
    items: DisplayItem[];
    calendarEventStatus: Record<string, boolean>;
    loadingItems: Record<string, boolean>;
    onItemClick: (item: DisplayItem) => void;
    onAddToCalendar: (item: ParsedStatement | ManualEntry) => void;
    // onAddAllInstallments prop'u kaldırıldı
    onDeleteManualEntry: (id: string) => void;
    onTogglePaidStatus: (id: string) => void;
    onSetUserAmount: (id: string, amount: number) => void;
    onUpdateDueDate: (id: string, dueDate: string) => void;
}

const DisplayItemList: React.FC<DisplayItemListProps> = ({
    items,
    calendarEventStatus,
    loadingItems,
    onItemClick,
    onAddToCalendar,
    // onAddAllInstallments prop'u kaldırıldı
    onDeleteManualEntry,
    onTogglePaidStatus,
    onSetUserAmount,
    onUpdateDueDate
}) => {
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingDateItemId, setEditingDateItemId] = useState<string | null>(null);
    const [editingDateValue, setEditingDateValue] = useState<string | undefined>(undefined);

    if (items.length === 0) {
        return (
            <IonItem lines="none">
                <p className="empty-list-message">Görüntülenecek aktif ekstre bilgisi bulunamadı. Verileri yenilemek için ekranı aşağı çekebilirsiniz.</p>
            </IonItem>
        );
    }

    return (
        <>
            <IonList lines="none">
                    {items.map((item, index) => {
                        // Redux store'dan gelen tüm item'lar id içerir (SerializableStatement'a eklenir)
                        const itemId: string | undefined = isManualEntry(item) ? item.id : ('id' in item ? (item as any).id : undefined);

                        const listKey = `${item.source}-${itemId || index}`;

                        // Takvim durumu için AppID'yi oluştur
                        const appId = generateAppId(item);
                        
                        // Prop'tan gelen status objesini kullanarak durumu belirle
                        const isAdded = appId ? !!calendarEventStatus[appId] : false;

                        // İkonu entryType'a göre belirle
                        let itemIcon = addOutline;
                        let itemColor = "primary";

                        if (isManualEntry(item)) {
                            // Kredi taksitleri için özel kontrol (description'da "Taksit" geçiyor)
                            if (item.description.includes('Taksit')) {
                                itemIcon = cashOutline;
                                itemColor = "success";
                            } else {
                                itemIcon = item.entryType === 'debt' ? cashOutline : receiptOutline;
                                itemColor = "tertiary";
                            }
                        } else if (isStatement(item)) {
                            itemIcon = item.source === 'email' ? mailOutline : documentTextOutline; // screenshot için
                            itemColor = item.source === 'email' ? "primary" : "success"; // Screenshot farklı renk
                        }


                        return (
                            <IonItemSliding key={listKey}>
                                <IonItem onClick={() => onItemClick(item)} button detail={false} className={item.isPaid ? 'item-paid' : ''}>
                                    <IonIcon
                                        slot="start"
                                        icon={itemIcon}
                                        color={itemColor}
                                    />
                                    <IonLabel>
                                        <h2>{isManualEntry(item) ? item.description : item.bankName}</h2>
                                        {isStatement(item) ? (
                                            <>
                                                <p>
                                                    Son Ödeme: <strong>{formatDate(item.dueDate)}</strong>
                                                    {isWeekend(item.dueDate) && (
                                                        <IonIcon icon={warningOutline} color="warning" style={{ marginLeft: '8px', verticalAlign: 'middle' }} />
                                                    )}
                                                </p>
                                                <p>
                                                    Tutar: <strong style={item.amount === null && !item.userAmount ? { color: 'var(--ion-color-medium)' } : undefined}>
                                                        {formatCurrency(item.userAmount ?? item.amount)}
                                                    </strong>
                                                    {item.amount === null && !item.userAmount && (
                                                        <span style={{ fontSize: '0.8em', color: 'var(--ion-color-medium)', marginLeft: '4px' }}>(Kaydırarak girin)</span>
                                                    )}
                                                </p>
                                                {item.last4Digits && <p>Kart No: <strong>...{item.last4Digits}</strong></p>}
                                            </>
                                        ) : isManualEntry(item) ? (
                                            <>
                                                <p>
                                                    Son Ödeme: <strong>{formatDate(item.dueDate)}</strong>
                                                    {isWeekend(item.dueDate) && (
                                                        <IonIcon icon={warningOutline} color="warning" style={{ marginLeft: '8px', verticalAlign: 'middle' }} />
                                                    )}
                                                </p>
                                                <p>Tutar: <strong>{formatCurrency(item.amount)}</strong></p>
                                            </>
                                        ) : null}
                                    </IonLabel>
                                    {(isStatement(item) || isManualEntry(item)) && !item.isPaid && (
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onAddToCalendar(item); }}
                                            disabled={(appId && loadingItems[appId]) || isAdded || !item.dueDate}
                                            className="calendar-button"
                                        >
                                            {appId && loadingItems[appId] ? (
                                                <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                                            ) : (
                                                <IonIcon slot="icon-only" icon={calendarOutline} color={isAdded ? 'medium' : (isManualEntry(item) ? 'tertiary' : 'primary')} />
                                            )}
                                        </IonButton>
                                    )}
                                </IonItem>

                                <IonItemOptions side="end">
                                    {/* Tutarı null olan statement'lar için tutar girme butonu */}
                                    {isStatement(item) && item.amount === null && (
                                        <IonItemOption
                                            color="primary"
                                            onClick={() => itemId && setEditingItemId(itemId)}
                                            disabled={!itemId}
                                        >
                                            <IonIcon slot="icon-only" icon={createOutline}></IonIcon>
                                        </IonItemOption>
                                    )}
                                    {/* Kredi taksitleri için tarih düzenleme butonu */}
                                    {isManualEntry(item) && item.description.includes('Taksit') && (
                                        <IonItemOption
                                            color="tertiary"
                                            onClick={() => {
                                                if (itemId) {
                                                    const currentDate = item.dueDate instanceof Date
                                                        ? item.dueDate.toISOString()
                                                        : new Date(item.dueDate).toISOString();
                                                    setEditingDateValue(currentDate);
                                                    setEditingDateItemId(itemId);
                                                }
                                            }}
                                            disabled={!itemId}
                                        >
                                            <IonIcon slot="icon-only" icon={calendarOutline}></IonIcon>
                                        </IonItemOption>
                                    )}
                                    <IonItemOption
                                        color={item.isPaid ? "warning" : "success"}
                                        onClick={() => itemId && onTogglePaidStatus(itemId)}
                                        disabled={!itemId}
                                    >
                                        <IonIcon slot="icon-only" icon={item.isPaid ? arrowUndoCircleOutline : cashOutline}></IonIcon>
                                    </IonItemOption>
                                    {/* Sadece kredi taksiti OLMAYAN manuel girişler için silme butonu göster */}
                                    {isManualEntry(item) && !item.description.includes('Taksit') && (
                                        <IonItemOption
                                            color="danger"
                                            onClick={() => onDeleteManualEntry(item.id)}
                                        >
                                            <IonIcon slot="icon-only" icon={trashOutline}></IonIcon>
                                        </IonItemOption>
                                    )}
                                </IonItemOptions>
                            </IonItemSliding>
                        );
                    })}
                </IonList>
            <IonAlert
                isOpen={editingItemId !== null}
                header="Tutar Girin"
                message="Bu ekstre için tutar bilgisi bulunamadı. Lütfen tutarı elle girin."
                inputs={[
                    {
                        name: 'amount',
                        type: 'number',
                        placeholder: 'Tutar (TL)',
                        min: 0,
                    },
                ]}
                buttons={[
                    { text: 'İptal', role: 'cancel', handler: () => setEditingItemId(null) },
                    {
                        text: 'Kaydet',
                        handler: (data) => {
                            const amount = parseFloat(data.amount);
                            if (editingItemId && !isNaN(amount) && amount > 0) {
                                onSetUserAmount(editingItemId, amount);
                            }
                            setEditingItemId(null);
                        },
                    },
                ]}
                onDidDismiss={() => setEditingItemId(null)}
            />
            <IonModal
                isOpen={editingDateItemId !== null}
                onDidDismiss={() => {
                    setEditingDateItemId(null);
                    setEditingDateValue(undefined);
                }}
            >
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Tarih Düzenle</IonTitle>
                        <IonButtons slot="start">
                            <IonButton onClick={() => {
                                setEditingDateItemId(null);
                                setEditingDateValue(undefined);
                            }}>İptal</IonButton>
                        </IonButtons>
                        <IonButtons slot="end">
                            <IonButton
                                strong
                                onClick={() => {
                                    if (editingDateItemId && editingDateValue) {
                                        onUpdateDueDate(editingDateItemId, new Date(editingDateValue).toISOString());
                                    }
                                    setEditingDateItemId(null);
                                    setEditingDateValue(undefined);
                                }}
                            >Kaydet</IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <IonDatetime
                        presentation="date"
                        value={editingDateValue}
                        onIonChange={(e) => {
                            const val = e.detail.value;
                            if (typeof val === 'string') {
                                setEditingDateValue(val);
                            }
                        }}
                        locale="tr-TR"
                    />
                </IonContent>
            </IonModal>
        </>
    );
};

export default DisplayItemList; 