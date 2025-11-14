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
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonBadge,
    IonProgressBar,
    IonAlert,
} from '@ionic/react';
import { trashOutline, cashOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import type { RootState, AppDispatch } from '../store';
import { selectGroupedLoans, deleteLoan, type LoanGroup } from '../store/slices/dataSlice';
import { addToast } from '../store/slices/toastSlice';
import { formatDate, formatCurrency } from '../utils/formatting';

const LoanManagementPage: React.FC = () => {
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

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar className="ion-padding-top">
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/tabs/account" text="Geri" />
                    </IonButtons>
                    <IonTitle>Kredi Yönetimi</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen className="ion-padding">
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Kredi Yönetimi</IonTitle>
                    </IonToolbar>
                </IonHeader>

                {loans.length === 0 ? (
                    <IonCard>
                        <IonCardContent>
                            <p style={{ textAlign: 'center', color: 'var(--ion-color-medium)' }}>
                                Henüz kredi kaydı bulunmamaktadır.
                            </p>
                        </IonCardContent>
                    </IonCard>
                ) : (
                    <IonList lines="none">
                        {loans.map((loan) => {
                            const progress = calculateProgress(loan);
                            const remainingAmount = calculateRemainingAmount(loan);

                            return (
                                <IonCard key={loan.loanId}>
                                    <IonCardHeader>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <IonCardTitle>{loan.description}</IonCardTitle>
                                            <IonButton
                                                fill="clear"
                                                color="danger"
                                                onClick={() => handleDeleteLoan(loan.loanId)}
                                            >
                                                <IonIcon slot="icon-only" icon={trashOutline} />
                                            </IonButton>
                                        </div>
                                    </IonCardHeader>
                                    <IonCardContent>
                                        <IonList lines="full" style={{ marginTop: '0' }}>
                                            <IonItem>
                                                <IonLabel>
                                                    <p>Aylık Taksit</p>
                                                    <h2><strong>{formatCurrency(loan.monthlyAmount)}</strong></h2>
                                                </IonLabel>
                                            </IonItem>
                                            <IonItem>
                                                <IonLabel>
                                                    <p>İlerleme</p>
                                                    <h3>
                                                        <IonBadge color={progress === 100 ? 'success' : 'primary'}>
                                                            {loan.paidInstallments}/{loan.totalInstallments} Taksit
                                                        </IonBadge>
                                                    </h3>
                                                </IonLabel>
                                            </IonItem>
                                            <IonItem lines="none">
                                                <IonProgressBar value={progress / 100} color={progress === 100 ? 'success' : 'primary'} />
                                            </IonItem>
                                            <IonItem>
                                                <IonLabel>
                                                    <p>Kalan Toplam</p>
                                                    <h2><strong>{formatCurrency(remainingAmount)}</strong></h2>
                                                </IonLabel>
                                            </IonItem>
                                        </IonList>

                                        <h3 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                                            Taksitler
                                        </h3>
                                        <IonList lines="full" style={{ background: 'var(--ion-color-light)', borderRadius: '8px', padding: '4px' }}>
                                            {loan.installments.map((installment) => (
                                                <IonItem
                                                    key={installment.id}
                                                    className={installment.isPaid ? 'item-paid' : ''}
                                                    style={{ '--background': 'transparent' }}
                                                >
                                                    <IonIcon
                                                        slot="start"
                                                        icon={installment.isPaid ? checkmarkCircleOutline : cashOutline}
                                                        color={installment.isPaid ? 'success' : 'medium'}
                                                    />
                                                    <IonLabel>
                                                        <p style={{ fontSize: '12px' }}>{installment.description}</p>
                                                        <p style={{ fontSize: '13px' }}>
                                                            <strong>{formatDate(installment.dueDate)}</strong>
                                                        </p>
                                                    </IonLabel>
                                                    <IonLabel slot="end" style={{ textAlign: 'right' }}>
                                                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                            {formatCurrency(installment.amount)}
                                                        </p>
                                                    </IonLabel>
                                                </IonItem>
                                            ))}
                                        </IonList>
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
        </IonPage>
    );
};

export default LoanManagementPage;
