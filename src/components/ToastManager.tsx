import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useIonToast } from '@ionic/react';
import type { RootState, AppDispatch } from '../store';
import { removeToast, ToastMessage } from '../store/slices/toastSlice';

const ToastManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [present] = useIonToast();

  // Gösterilecek toast mesajlarının listesini al
  const toastMessages = useSelector((state: RootState) => state.toast.messages);

  // Şu anda gösterilen bir toast olup olmadığını takip etmek için ref
  const isToastVisible = useRef(false);

  useEffect(() => {
    // Eğer gösterilecek mesaj varsa ve şu anda başka bir toast görünmüyorsa
    if (toastMessages.length > 0 && !isToastVisible.current) {
      // Kuyruktaki ilk mesajı al
      const currentToast = toastMessages[0];
      isToastVisible.current = true;

      // Ionic toast'u göster
      present({
        message: currentToast.message,
        color: currentToast.color,
        duration: currentToast.duration,
        position: currentToast.position,
        onDidDismiss: () => {
          // Toast kapandığında state'den kaldır ve görünürlük flag'ini resetle
          console.log(`Toast dismissed: ${currentToast.id}`);
          dispatch(removeToast(currentToast.id));
          isToastVisible.current = false;
        },
      });
    }
    // toastMessages dizisi değiştiğinde bu effect çalışır
  }, [toastMessages, dispatch, present]);

  // Bu componentin kendisi bir UI render etmez
  return null;
};

export default ToastManager; 