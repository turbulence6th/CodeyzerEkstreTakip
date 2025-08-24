import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { ParsedStatement, ParsedLoan } from '../../services/sms-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types.ts';
import { statementProcessor } from '../../services/sms-parsing/sms-processor';
import { startGlobalLoading, stopGlobalLoading } from './loadingSlice';
import type { RootState } from '../index';
// Type guard importları eklendi
import { isStatement, isManualEntry as isTypeGuardManualEntry } from '../../utils/typeGuards'; 
import { addMonths } from '../../utils/formatting'; // addMonths import edildi

// DisplayItem tipi artık ParsedLoan içermiyor.
type DisplayItem = ParsedStatement | ManualEntry;

// --- Serialize edilmiş veri tipi (isPaid eklendi) ---
type SerializableStatement = Omit<ParsedStatement, 'dueDate'> & { id: string; dueDate: string; isPaid?: boolean; entryType: 'debt'; };
// SerializableLoan artık state'te saklanmayacak.
type SerializableManualEntry = Omit<ManualEntry, 'dueDate'> & { dueDate: string; source: 'manual'; isPaid?: boolean; entryType: 'debt' | 'expense'; };
type SerializableDisplayItem = SerializableStatement | SerializableManualEntry; // SerializableLoan kaldırıldı

// Thunk dönüş tipi: items artık isPaid içerebilir
interface FetchDataResult {
  items: (SerializableStatement)[]; // Sadece statement dönecek
  totalItems: number;
}

// Tip kontrol fonksiyonları (değişiklik yok)
function isSerializableStatement(item: SerializableDisplayItem): item is SerializableStatement {
  return typeof item.source === 'string' && item.source !== 'manual' && typeof (item as SerializableStatement).dueDate === 'string';
}
// isSerializableLoan artık kullanılmıyor.
/* 
function isSerializableLoan(item: SerializableDisplayItem): item is SerializableLoan {
     return item && typeof item === 'object' && item.source !== 'manual' && ('firstPaymentDate' in item) && (typeof item.firstPaymentDate === 'string' || item.firstPaymentDate === null);
}
*/
function isSerializableManualEntry(item: SerializableDisplayItem): item is SerializableManualEntry {
    return item.source === 'manual';
}

// Kararlı bir anahtar oluşturma fonksiyonu
const createStableKey = (item: ParsedStatement): string => {
    // Kredi taksitleri (artık ParsedStatement gibi davranıyor) için bankName zaten benzersiz
    // Ekstreler için: banka-son4hane-tutar-sonodemetarihi
    const dateStr = item.dueDate.toISOString().split('T')[0]; // Sadece YYYY-MM-DD
    return `${item.bankName}:${item.last4Digits || 'none'}:${item.amount}:${dateStr}`.toLowerCase();
};


// Veri Getirme ve İşleme Thunk'ı (isPaid mantığı eklendi)
export const fetchAndProcessDataThunk = createAsyncThunk<
  FetchDataResult,
  void,
  { state: RootState; rejectValue: string }
>(
  'data/fetchAndProcess',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const state = getState();
    const { sms: smsPermission } = state.permissions;
    const { user: userInfo } = state.auth;

    // İzin ve giriş kontrolü
    if (smsPermission?.readSms !== 'granted') {
      return rejectWithValue("Lütfen önce SMS okuma izni verin.");
    }
    if (!userInfo) {
      return rejectWithValue("Lütfen önce Google ile giriş yapın.");
    }

    dispatch(startGlobalLoading("Veriler işleniyor..."));
    try {
      console.log("[Thunk] Fetching and parsing statements & loans...");
      const [parsedStatements, parsedLoans] = await Promise.all([
        statementProcessor.fetchAndParseStatements({ maxCount: 100 }),
        statementProcessor.fetchAndParseLoans({ maxCount: 100 })
      ]);
      console.log("[Thunk] Promise.all for statement/loan fetching completed.");

      // Kredileri taksitlere ayır ve ekstre gibi davran
      const installmentStatements: ParsedStatement[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Karşılaştırma için bugünün başlangıcı
      const tenDaysFromNow = new Date();
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
      tenDaysFromNow.setHours(23, 59, 59, 999); // 10. günün sonu

      for (const loan of parsedLoans) {
          if (loan.termMonths && loan.firstPaymentDate && loan.installmentAmount) {
              for (let i = 0; i < loan.termMonths; i++) {
                  const dueDate = addMonths(loan.firstPaymentDate, i);
                  // Sadece vadesi bugünden itibaren 10 gün içinde olan taksitleri listeye ekle
                  if (dueDate >= today && dueDate <= tenDaysFromNow) {
                    const installment: ParsedStatement = {
                        bankName: `${loan.bankName} Kredi Taksidi (${i + 1}/${loan.termMonths})`,
                        dueDate: dueDate,
                        amount: loan.installmentAmount,
                        last4Digits: undefined,
                        originalMessage: loan.originalMessage,
                        source: loan.source,
                        entryType: 'debt',
                        isPaid: false, // Varsayılan
                    };
                    installmentStatements.push(installment);
                  }
              }
          }
      }

      const fetchedItems: (ParsedStatement)[] = [...parsedStatements, ...installmentStatements];
      console.log(`Parsed ${parsedStatements.length} statements and expanded ${parsedLoans.length} loans into ${installmentStatements.length} installments.`);

      // --- YENİ OTOMATİK KAYITLARI SERIALIZE ET ---
      const serializableFetchedItems: (SerializableStatement)[] = [];
      for (const item of fetchedItems) {
          let serializableOriginalMessage: any = item.originalMessage;
           if (item.originalMessage && item.originalMessage.date instanceof Date) {
               serializableOriginalMessage = {
                   ...item.originalMessage,
                   date: item.originalMessage.date.toISOString()
               };
           }

          // ID'yi oluştur (parser'dan gelmiyorsa) - ŞİMDİLİK GEÇİCİ ID
          const generatedId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          // baseItem oluşturmaya gerek kalmadı, doğrudan item kullanabiliriz

          // Type guard'lar ile kontrol (artık sadece isStatement var)
          if (isStatement(item)) { // ParsedStatement kontrolü
              const serializedItem: SerializableStatement = {
                  ...item, // Spread ParsedStatement özellikleri
                  id: generatedId,
                  dueDate: item.dueDate.toISOString(), // Guard sayesinde güvenli erişim
                  originalMessage: serializableOriginalMessage,
                  isPaid: item.isPaid || false, // isPaid durumunu ekle
                  entryType: 'debt', // Otomatik atama
              };
              serializableFetchedItems.push(serializedItem);
          } else {
               console.warn("Unknown item type during serialization, skipping:", item);
          }
      }
      // --- SERIALIZE ETME SONU ---

      const totalItems = serializableFetchedItems.length;
      console.log(`[Thunk] Total new automatic items fetched (no filtering): ${totalItems}`);

      // Thunk artık isPaid içermeyen, serileştirilmiş OTOMATİK listeyi döndürür
      return { items: serializableFetchedItems, totalItems: totalItems };

    } catch (err: any) {
      console.error('[Thunk] !!! Error fetching/parsing data:', err);
       return rejectWithValue(err.message || JSON.stringify(err) || 'Unknown Thunk Error');
    } finally {
      console.log("[Thunk] fetchAndProcessDataThunk finished (finally block). Stopping global loading.");
      dispatch(stopGlobalLoading());
    }
  }
);

// State tipi artık SerializableDisplayItem kullanacak
interface DataState {
  items: SerializableDisplayItem[];
  error: string | null;
  lastUpdated: number | null;
}

const initialState: DataState = {
  items: [],
  error: null,
  lastUpdated: null,
};

// Tarihe göre sıralama fonksiyonu (string tarihleri Date'e çevirerek sırala)
const sortItemsByDate = (items: SerializableDisplayItem[]) => {
  items.sort((a, b) => {
      const dateStringA = isSerializableManualEntry(a) ? a.dueDate
                        : isSerializableStatement(a) ? a.dueDate
                        : null;
      const dateStringB = isSerializableManualEntry(b) ? b.dueDate
                        : isSerializableStatement(b) ? b.dueDate
                        : null;

      let timeA = -Infinity;
      let timeB = -Infinity;

      if (dateStringA) {
          try {
              const dateA = new Date(dateStringA);
              if (!isNaN(dateA.getTime())) timeA = dateA.getTime();
          } catch (e) { console.error("Error parsing date A for sorting:", dateStringA, e); }
      }
      if (dateStringB) {
           try {
               const dateB = new Date(dateStringB);
               if (!isNaN(dateB.getTime())) timeB = dateB.getTime();
           } catch (e) { console.error("Error parsing date B for sorting:", dateStringB, e); }
      }

      if (timeA !== -Infinity && timeB !== -Infinity) return timeB - timeA; // En yeniden eskiye
      if (timeA !== -Infinity) return -1; // A geçerli, B değil
      if (timeB !== -Infinity) return 1; // B geçerli, A değil
      return 0; // İkisi de geçersiz veya null
  });
};


const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    clearData: (state) => {
      state.items = [];
      state.error = null;
      state.lastUpdated = null;
    },
    // Ödendi durumunu değiştiren yeni reducer
    togglePaidStatus: (state, action: PayloadAction<string>) => {
        const itemId = action.payload;
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            item.isPaid = !item.isPaid;
            console.log(`Item ${itemId} paid status toggled to: ${item.isPaid}`);
        } else {
            console.warn(`Item with ID ${itemId} not found for toggling paid status.`);
        }
    },
    // Manuel Giriş: isPaid mantığı eklendi
    addManualEntry: (state, action: PayloadAction<ManualEntry>) => {
        const newEntry = action.payload;
         let dueDateString: string;
         try {
              dueDateString = newEntry.dueDate instanceof Date
                            ? newEntry.dueDate.toISOString()
                            : new Date(newEntry.dueDate).toISOString();
             if (isNaN(new Date(dueDateString).getTime())) {
                  throw new Error("Invalid date provided for manual entry.");
             }
         } catch (e) {
              console.error("Error converting manual entry date to ISO string:", newEntry.dueDate, e);
              state.error = "Manuel giriş için geçersiz tarih sağlandı.";
              return;
         }

        // SerializableManualEntry (isPaid ile)
        const serializedEntry: SerializableManualEntry = {
            ...newEntry,
            id: newEntry.id,
            dueDate: dueDateString,
            source: 'manual',
            isPaid: newEntry.isPaid || false, // isPaid durumunu ekle
            entryType: newEntry.entryType, // entryType'ı payload'dan al
        };

        // ID kontrolü ve ekleme
        const existingIndex = state.items.findIndex(item => item.id === serializedEntry.id);
        if (existingIndex === -1) {
            state.items.push(serializedEntry);
            state.error = null;
            sortItemsByDate(state.items);
            console.log(`Manual entry added: ${serializedEntry.id}`);
        } else {
            console.warn(`Entry with ID ${serializedEntry.id} already exists.`);
            state.error = `Bu ID (${serializedEntry.id}) ile zaten bir giriş mevcut.`;
        }
    },
    // Manuel Silme: Aynı kaldı
    deleteManualEntry: (state, action: PayloadAction<string>) => {
       const idToDelete = action.payload;
       const initialLength = state.items.length;
       state.items = state.items.filter(item => !(isSerializableManualEntry(item) && item.id === idToDelete));
       if (state.items.length < initialLength) {
           console.log(`Manual entry deleted: ${idToDelete}`);
           state.error = null;
       } else {
           console.warn(`Manual entry with ID ${idToDelete} not found for deletion.`);
       }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAndProcessDataThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchAndProcessDataThunk.fulfilled, (state, action: PayloadAction<FetchDataResult>) => {
        // Mevcut öğelerin isPaid durumlarını bir haritada sakla.
        // ID'ler stabil olmadığı için, stabil bir anahtar kullan.
        const paidStatusMap = new Map<string, boolean>();
        state.items.forEach(item => {
            if (item.isPaid) {
                 // Manuel girişler için ID stabil.
                if(isSerializableManualEntry(item)) {
                    paidStatusMap.set(item.id, true);
                } else if (isSerializableStatement(item)) {
                    // Otomatik girişler için stabil anahtar oluştur.
                    // Bu, tarihlerin Date nesnesine çevrilmesini gerektirir.
                     try {
                        const deserializedItem = {
                            ...item,
                            dueDate: new Date(item.dueDate)
                        }
                        // Type guard'ları düzelt
                        const key = createStableKey(deserializedItem as any);
                        paidStatusMap.set(key, true);
                    } catch(e) {
                         console.error("Error creating stable key for existing item:", item, e);
                    }
                }
            }
        });

        // Thunk'tan gelen yeni otomatik kayıtlar
        const newAutomaticEntries = action.payload.items;

        // Yeni otomatik kayıtlara eski isPaid durumunu uygula
        const updatedAutomaticEntries = newAutomaticEntries.map(item => {
            let key = '';
            try {
                 const deserializedItem = {
                    ...item,
                    dueDate: new Date(item.dueDate)
                 }
                 key = createStableKey(deserializedItem as any);
            } catch(e) {
                console.error("Error creating stable key for new item:", item, e);
            }

            if (paidStatusMap.has(key)) {
                return { ...item, isPaid: true };
            }
            return item;
        });

        // Mevcut manuel kayıtları koru ve isPaid durumlarını güncelle
         const updatedManualEntries = state.items
            .filter(isSerializableManualEntry)
            .map(item => ({
                ...item,
                isPaid: paidStatusMap.has(item.id) ? true : item.isPaid
            }));


        // Mevcut manuel kayıtları ve GÜNCELLENMİŞ otomatik kayıtları birleştir
        state.items = [...updatedManualEntries, ...updatedAutomaticEntries];

        state.error = null;
        state.lastUpdated = Date.now();
        sortItemsByDate(state.items);
        console.log(`Data slice updated. Total items: ${state.items.length} (Manual: ${updatedManualEntries.length}, Auto: ${updatedAutomaticEntries.length})`);
        console.log("Paid status map size:", paidStatusMap.size);
      })
      .addCase(fetchAndProcessDataThunk.rejected, (state, action) => {
        // Hata mesajını string yap
        const errorMessage = typeof action.payload === 'string' ? action.payload : 
                           action.error?.message || 
                           'Unknown error fetching data';
        state.error = errorMessage;
        console.error("fetchAndProcessDataThunk rejected:", errorMessage, action.payload || action.error);
      });
  },
});

// --- Selectors ---

// Tüm state'i seçer (Serializable haliyle)
export const selectAllData = (state: RootState): SerializableDisplayItem[] => state.data.items;
export const selectDataError = (state: RootState): string | null => state.data.error;
export const selectLastUpdated = (state: RootState): number | null => state.data.lastUpdated;

// Memoized selector: isPaid mantığı kaldırıldı
export const selectAllDataWithDates = createSelector(
  [selectAllData],
  (items): DisplayItem[] => { // Dönen tip DisplayItem[] (artık isPaid içerebilir)
    return items.map(item => {
        try {
            if (isSerializableStatement(item)) {
                return { ...item, dueDate: new Date(item.dueDate), isPaid: !!item.isPaid, entryType: 'debt' } as DisplayItem;
            } else if (isSerializableManualEntry(item)) {
                 return { ...item, dueDate: new Date(item.dueDate), isPaid: !!item.isPaid, entryType: item.entryType } as DisplayItem;
            }
        } catch (e) {
             console.error("Error converting item dates in selector:", item, e);
        }
        console.warn("Unknown or problematic item type in selectAllDataWithDates, returning null:", item);
        return null;
    }).filter((item): item is DisplayItem => item !== null);
  }
);

// Toplam borcu hesaplayan yeni memoized selector (sadece ödenmemiş borçları dahil et)
export const selectTotalDebt = createSelector(
  [selectAllData],
  (items): number => {
    return items.reduce((total, item) => {
      // Ödenmişse veya borç değilse hesaba katma
      if (item.isPaid || item.entryType !== 'debt') {
          return total;
      }

      // Tarih kontrolü kaldırıldı. Sadece ödenmemiş borçları topla.
      let currentAmount = 0;
      if (isSerializableStatement(item)) {
        currentAmount = item.amount ?? 0;
      } else if (isSerializableManualEntry(item)) {
        currentAmount = item.amount;
      }
      return total + currentAmount;
    }, 0);
  }
);


// Yeni action'ı export et
export const { clearData, addManualEntry, deleteManualEntry, togglePaidStatus } = dataSlice.actions;
export default dataSlice.reducer;