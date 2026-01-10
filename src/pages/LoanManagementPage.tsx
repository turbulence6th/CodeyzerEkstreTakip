import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonList,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonBadge,
    IonProgressBar,
    IonAlert,
} from '@ionic/react';
import { trashOutline, cashOutline, checkmarkCircleOutline, closeOutline } from 'ionicons/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import type { RootState, AppDispatch } from '../store';
import { selectGroupedLoans, deleteLoan, type LoanGroup } from '../store/slices/dataSlice';
import { addToast } from '../store/slices/toastSlice';
import { formatDate, formatCurrency } from '../utils/formatting';

interface LoanManagementPageProps {
    onClose?: () => void;
}

const LoanManagementPage: React.FC<LoanManagementPageProps> = ({ onClose }) => {
    const dispatch = useDispatch<AppDispatch>();
    const loans = useSelector((state: RootState) => selectGroupedLoans(state));
    const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);

    const handleDeleteLoan = (loanId: string) => {
        setDeletingLoanId(loanId);
    };

    const confirmDelete = () => {
        if (deletingLoanId) {
            dispatch(deleteLoan(deletingLoanId));
            dispatch(addToast({
                message: 'Kredi ve tüm taksitleri başarıyla silindi.',
                duration: 2000,
                color: 'success'
            }));
            setDeletingLoanId(null);
        }
    };

    const calculateProgress = (loan: LoanGroup): number => {
        return loan.totalInstallments > 0
            ? (loan.paidInstallments / loan.totalInstallments) * 100
            : 0;
    };

    const calculateRemainingAmount = (loan: LoanGroup): number => {
        const unpaidInstallments = loan.totalInstallments - loan.paidInstallments;
        return unpaidInstallments * loan.monthlyAmount;
    };

    const content = (
        <>
            <IonHeader className={onClose ? '' : 'safe-area-header'}>
                <IonToolbar>
                    <IonButtons slot="start">
                        {onClose ? (
                            <IonButton onClick={onClose}>
                                <IonIcon slot="icon-only" icon={closeOutline} />
                            </IonButton>
                        ) : (
                            <IonBackButton defaultHref="/statements" text="Geri" />
                        )}
                    </IonButtons>
                    <IonTitle>Kredi Yönetimi</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                {loans.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ion-color-medium)' }}>
                        Henüz kredi kaydı bulunmamaktadır.
                    </div>
                ) : (
                    <IonList lines="none" style={{ padding: '8px' }}>
                        {loans.map((loan) => {
                            const progress = calculateProgress(loan);
                            const remainingAmount = calculateRemainingAmount(loan);

                            return (
                                <IonCard key={loan.loanId} style={{ margin: '8px 0' }}>
                                    <IonCardHeader style={{ paddingBottom: '0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <IonCardTitle style={{ fontSize: '18px' }}>{loan.description}</IonCardTitle>
                                            <IonButton fill="clear" color="danger" size="small" onClick={() => handleDeleteLoan(loan.loanId)}>
                                                <IonIcon slot="icon-only" icon={trashOutline} />
                                            </IonButton>
                                        </div>
                                    </IonCardHeader>
                                    <IonCardContent style={{ paddingTop: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Aylık Taksit</p>
                                                <strong>{formatCurrency(loan.monthlyAmount)}</strong>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Kalan</p>
                                                <strong>{formatCurrency(remainingAmount)}</strong>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <IonBadge color={progress === 100 ? 'success' : 'primary'}>
                                                    {loan.paidInstallments}/{loan.totalInstallments} Taksit
                                                </IonBadge>
                                            </div>
                                            <IonProgressBar value={progress / 100} color={progress === 100 ? 'success' : 'primary'} />
                                        </div>

                                        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--ion-color-medium)' }}>Taksitler</p>
                                        {loan.installments.map((installment) => (
                                            <div
                                                key={installment.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '6px 0',
                                                    borderBottom: '1px solid var(--ion-color-light)',
                                                    opacity: installment.isPaid ? 0.6 : 1
                                                }}
                                            >
                                                <IonIcon
                                                    icon={installment.isPaid ? checkmarkCircleOutline : cashOutline}
                                                    color={installment.isPaid ? 'success' : 'medium'}
                                                    style={{ marginRight: '8px', fontSize: '18px' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>{installment.description}</p>
                                                    <strong style={{ fontSize: '13px' }}>{formatDate(installment.dueDate)}</strong>
                                                </div>
                                                <strong style={{ fontSize: '13px' }}>{formatCurrency(installment.amount)}</strong>
                                            </div>
                                        ))}
                                    </IonCardContent>
                                </IonCard>
                            );
                        })}
                    </IonList>
                )}

                <IonAlert
                    isOpen={deletingLoanId !== null}
                    onDidDismiss={() => setDeletingLoanId(null)}
                    header="Krediyi Sil"
                    message="Bu krediyi ve tüm taksitlerini silmek istediğinize emin misiniz?"
                    buttons={[
                        {
                            text: 'İptal',
                            role: 'cancel',
                        },
                        {
                            text: 'Sil',
                            role: 'destructive',
                            handler: confirmDelete,
                        },
                    ]}
                />
            </IonContent>
        </>
    );

    return onClose ? content : <IonPage>{content}</IonPage>;
};

export default LoanManagementPage;
