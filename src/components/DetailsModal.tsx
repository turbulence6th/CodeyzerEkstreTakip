import React from 'react';
import {
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent
} from '@ionic/react';

interface DetailsModalProps {
    isOpen: boolean;
    title: string;
    content: string | null;
    onDismiss: () => void;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ isOpen, title, content, onDismiss }) => {
    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{title}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onDismiss}>Kapat</IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                {/* İçeriği pre ile sarmalayarak formatlamayı koru */}
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {content ?? 'İçerik yüklenemedi.'} 
                </pre>
            </IonContent>
        </IonModal>
    );
};

export default DetailsModal; 