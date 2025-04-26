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
    trashOutline
} from 'ionicons/icons';

// Tipler
import type { ParsedStatement, ParsedLoan } from '../services/sms-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// Yeni utils'leri import et
import { formatDate, formatCurrency, formatTargetDate } from '../utils/formatting';
import { isStatement, isManualEntry } from '../utils/typeGuards';

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
                        // Bu bileşene özgü anahtar oluşturma
                        const key = `${item.source}-${item.source === 'manual' ? item.id : (item as any).bankName || 'unknown'}-${index}`;
                        
                        // Takvim durumu için anahtar ve durum kontrolleri
                        let itemKeyForCalendarStatus = "";
                        let isItemAddedToCalendar = false; // Ekstre/Manuel için
                        let isFirstInstallmentAdded = false; // Kredi için

                        try {
                           if(isManualEntry(item)) {
                                itemKeyForCalendarStatus = `manual-${item.id}`;
                                isItemAddedToCalendar = !!calendarEventStatus[itemKeyForCalendarStatus];
                            } else if (isStatement(item) && item.dueDate) {
                                const targetDateForSearch = formatTargetDate(new Date(item.dueDate));
                                itemKeyForCalendarStatus = `${item.bankName}-${targetDateForSearch}-${item.last4Digits || 'null'}`;
                                isItemAddedToCalendar = !!calendarEventStatus[itemKeyForCalendarStatus];
                            } else if (!isStatement(item) && !isManualEntry(item) && item.firstPaymentDate && item.termMonths) {
                                const loan = item as ParsedLoan;
                                if (loan.firstPaymentDate) {
                                    const targetDateForSearch = formatTargetDate(new Date(loan.firstPaymentDate));
                                    // Anahtar, takvim kontrolü sırasında kullanılanla aynı olmalı
                                    itemKeyForCalendarStatus = `loan-${loan.bankName}-${targetDateForSearch}-${loan.termMonths}`;
                                    isFirstInstallmentAdded = !!calendarEventStatus[itemKeyForCalendarStatus];
                                }
                            }
                        } catch(e) {
                            console.error("Error calculating calendar status key/check:", item, e);
                        }

                        return (
                            <IonItemSliding key={key}>
                                <IonItem onClick={() => onItemClick(item)} button detail={false}>
                                    <IonIcon
                                        slot="start"
                                        icon={isManualEntry(item) ? documentTextOutline : item.source === 'email' ? mailOutline : item.source === 'sms' && isStatement(item) ? chatbubbleEllipsesOutline : cashOutline}
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
                                        ) : (
                                            <>
                                                <p>İlk Ödeme: <strong>{formatDate(item.firstPaymentDate)}</strong></p>
                                                <p>Taksit Tutarı: <strong>{formatCurrency(item.installmentAmount)}</strong></p>
                                                <p>Vade: <strong>{item.termMonths ? `${item.termMonths} Ay` : '-'}</strong></p>
                                            </>
                                        )}
                                    </IonLabel>
                                    {(isStatement(item) || isManualEntry(item)) && (
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onAddToCalendar(item); }}
                                            disabled={isItemAddedToCalendar || isCheckingCalendar || !item.dueDate}
                                            className="calendar-button"
                                        >
                                            {isCheckingCalendar ? (
                                                <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                                            ) : (
                                                <IonIcon slot="icon-only" icon={calendarOutline} color={isItemAddedToCalendar ? 'medium' : (isManualEntry(item) ? 'tertiary' : 'primary')} />
                                            )}
                                        </IonButton>
                                    )}
                                    {!isStatement(item) && !isManualEntry(item) && item.termMonths && item.firstPaymentDate && (
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onAddAllInstallments(item); }}
                                            disabled={isAddingInstallments || isCheckingCalendar || !item.firstPaymentDate || !item.termMonths || isFirstInstallmentAdded}
                                            className="calendar-button"
                                        >
                                            {isCheckingCalendar ? (
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