import React from 'react';
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

type DisplayItem = ParsedStatement | ManualEntry; // ParsedLoan kaldırıldı

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
}

const DisplayItemList: React.FC<DisplayItemListProps> = ({
    items,
    calendarEventStatus,
    loadingItems,
    onItemClick,
    onAddToCalendar,
    // onAddAllInstallments prop'u kaldırıldı
    onDeleteManualEntry,
    onTogglePaidStatus
}) => {

    if (items.length === 0) {
        return (
            <IonItem lines="none">
                <p className="empty-list-message">Görüntülenecek aktif ekstre bilgisi bulunamadı. Verileri yenilemek için ekranı aşağı çekebilirsiniz.</p>
            </IonItem>
        );
    }

    return (
        <>
            {items.length > 0 ? (
                <IonList lines="none">
                    {items.map((item, index) => {
                        // id'yi almak için type guard kullanalım
                        let itemId: string | undefined;
                        if (isManualEntry(item)) {
                            itemId = item.id;
                        } else if ((item as any).id) { // Geçici olarak any kullandık
                            itemId = (item as any).id;
                        }

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
                                                <p>Tutar: <strong>{formatCurrency(item.amount)}</strong></p>
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
            ) : (
                <IonItem lines="none">
                    <p className="empty-list-message">Görüntülenecek aktif ekstre bilgisi bulunamadı. Geçmiş kayıtlar otomatik olarak gizlenir. Yeni veri getirmeyi deneyebilirsiniz.</p>
                </IonItem>
            )}
        </>
    );
};

export default DisplayItemList; 