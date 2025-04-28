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
    addOutline
} from 'ionicons/icons';

// Tipler
import type { ParsedStatement, ParsedLoan } from '../services/sms-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// Yeni utils'leri import et
import { formatDate, formatCurrency } from '../utils/formatting';
import { isStatement, isManualEntry, isLoan } from '../utils/typeGuards';
import { generateAppId } from '../utils/identifiers';

type DisplayItem = ParsedStatement | ParsedLoan | ManualEntry;

// --- Yardımcı Fonksiyonlar kaldırıldı ---

interface DisplayItemListProps {
    items: DisplayItem[];
    calendarEventStatus: Record<string, boolean>;
    isCheckingCalendar: boolean;
    isAddingInstallments: boolean; // Kredi ekleme durumu için
    onItemClick: (item: DisplayItem) => void;
    onAddToCalendar: (item: ParsedStatement | ManualEntry) => void;
    onAddAllInstallments: (loan: ParsedLoan) => void;
    onDeleteManualEntry: (id: string) => void;
}

const DisplayItemList: React.FC<DisplayItemListProps> = ({
    items,
    calendarEventStatus,
    isCheckingCalendar,
    isAddingInstallments,
    onItemClick,
    onAddToCalendar,
    onAddAllInstallments,
    onDeleteManualEntry
}) => {
    return (
        <IonCard>
            <IonCardHeader>
                <IonCardTitle>Bulunan Ekstreler ve Krediler</IonCardTitle>
                {/* Takvim kontrol notu kaldırıldı, ikonlar durumu gösterecek */}
            </IonCardHeader>
            {items.length > 0 && (
                <IonList lines="none">
                    {items.map((item, index) => {
                        const listKey = `${item.source}-${item.source === 'manual' ? item.id : (item as any).bankName || 'unknown'}-${index}`;

                        // Takvim durumu için AppID'yi oluştur
                        const appId = generateAppId(item);
                        // Kredi taksitleri için ilk taksitin ID'sini oluştur (AddAll butonu için)
                        const firstInstallmentAppId = isLoan(item) ? generateAppId(item, 1) : null;

                        // Prop'tan gelen status objesini kullanarak durumu belirle
                        const isAdded = appId ? !!calendarEventStatus[appId] : false;
                        const isFirstInstallmentAdded = firstInstallmentAppId ? !!calendarEventStatus[firstInstallmentAppId] : false;

                        return (
                            <IonItemSliding key={listKey}>
                                <IonItem onClick={() => onItemClick(item)} button detail={false}>
                                    <IonIcon
                                        slot="start"
                                        icon={isManualEntry(item) ? documentTextOutline : isStatement(item) && item.source === 'email' ? mailOutline : isStatement(item) && item.source === 'sms' ? chatbubbleEllipsesOutline : isLoan(item) ? cashOutline : addOutline}
                                        color={isManualEntry(item) ? "tertiary" : isStatement(item) ? "primary" : "success"}
                                    />
                                    <IonLabel>
                                        <h2>{isManualEntry(item) ? item.description : item.bankName}</h2>
                                        {isStatement(item) ? (
                                            <>
                                                <p>Son Ödeme: <strong>{formatDate(item.dueDate)}</strong></p>
                                                <p>Tutar: <strong>{formatCurrency(item.amount)}</strong></p>
                                                {item.last4Digits && <p>Kart No: <strong>...{item.last4Digits}</strong></p>}
                                            </>
                                        ) : isManualEntry(item) ? (
                                            <>
                                                <p>Son Ödeme: <strong>{formatDate(item.dueDate)}</strong></p>
                                                <p>Tutar: <strong>{formatCurrency(item.amount)}</strong></p>
                                            </>
                                        ) : isLoan(item) ? (
                                            <>
                                                <p>İlk Ödeme: <strong>{formatDate(item.firstPaymentDate)}</strong></p>
                                                <p>Taksit Tutarı: <strong>{formatCurrency(item.installmentAmount)}</strong></p>
                                                <p>Vade: <strong>{item.termMonths ? `${item.termMonths} Ay` : '-'}</strong></p>
                                            </>
                                        ) : null}
                                    </IonLabel>
                                    {(isStatement(item) || isManualEntry(item)) && (
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onAddToCalendar(item); }}
                                            disabled={isCheckingCalendar || isAdded || !item.dueDate}
                                            className="calendar-button"
                                        >
                                            {isCheckingCalendar && appId && calendarEventStatus[appId] === undefined ? (
                                                <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                                            ) : (
                                                <IonIcon slot="icon-only" icon={calendarOutline} color={isAdded ? 'medium' : (isManualEntry(item) ? 'tertiary' : 'primary')} />
                                            )}
                                        </IonButton>
                                    )}
                                    {isLoan(item) && item.termMonths && item.firstPaymentDate && (
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onAddAllInstallments(item); }}
                                            disabled={isAddingInstallments || isCheckingCalendar || isFirstInstallmentAdded || !item.firstPaymentDate || !item.termMonths}
                                            className="calendar-button"
                                        >
                                            {isCheckingCalendar && firstInstallmentAppId && calendarEventStatus[firstInstallmentAppId] === undefined ? (
                                                <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                                            ) : (
                                                <IonIcon slot="icon-only" icon={calendarOutline} color={isFirstInstallmentAdded ? 'medium' : 'success'} />
                                            )}
                                        </IonButton>
                                    )}
                                </IonItem>

                                <IonItemOptions side="end">
                                    {isManualEntry(item) && (
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
            )}
            {items.length === 0 && (
                <IonCardContent>
                    <p className="empty-list-message">Görüntülenecek aktif ekstre veya kredi bilgisi bulunamadı. Geçmiş kayıtlar otomatik olarak gizlenir. Yeni veri getirmeyi deneyebilirsiniz.</p>
                </IonCardContent>
            )}
        </IonCard>
    );
};

export default DisplayItemList; 