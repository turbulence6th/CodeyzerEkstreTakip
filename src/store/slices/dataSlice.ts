import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { ParsedStatement } from '../../services/statement-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types.ts';
import { statementProcessor } from '../../services/statement-parsing/statement-processor';
import { startGlobalLoading, stopGlobalLoading } from './loadingSlice';
import type { RootState } from '../index';

// Type guard importları eklendi
import { isStatement, isManualEntry as isTypeGuardManualEntry } from '../../utils/typeGuards';
import { addMonths } from '../../utils/formatting'; // addMonths import edildi

// DisplayItem tipi artık ParsedLoan içermiyor.
type DisplayItem = ParsedStatement | ManualEntry;

// --- Serialize edilmiş veri tipi (isPaid eklendi) ---
type SerializableStatement = Omit<ParsedStatement, 'dueDate'> & { id: string; dueDate: string; isPaid?: boolean; userAmount?: number; entryType: 'debt'; };
// SerializableLoan artık state'te saklanmayacak.
type SerializableManualEntry = Omit<ManualEntry, 'dueDate'> & { dueDate: string; source: 'manual'; isPaid?: boolean; entryType: 'debt' | 'expense' | 'loan'; installmentCount?: number; };
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
    const { user: userInfo } = state.auth;

    // Giriş kontrolü
    if (!userInfo) {
      return rejectWithValue("Lütfen önce Google ile giriş yapın.");
    }

    dispatch(startGlobalLoading("Veriler işleniyor..."));
    try {
      console.log("[Thunk] Fetching and parsing statements...");
      const parsedStatements = await statementProcessor.fetchAndParseStatements();
      console.log("[Thunk] Statement fetching completed.");

      const fetchedItems: (ParsedStatement)[] = [...parsedStatements];
      console.log(`Parsed ${parsedStatements.length} statements.`);

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
    // Kullanıcının elle tutar girmesi için reducer
    setUserAmount: (state, action: PayloadAction<{ id: string; amount: number }>) => {
        const { id, amount } = action.payload;
        const item = state.items.find(i => i.id === id);
        if (item && isSerializableStatement(item)) {
            item.userAmount = amount;
            console.log(`Item ${id} userAmount set to: ${amount}`);
        } else {
            console.warn(`Item with ID ${id} not found or not a statement for setting userAmount.`);
        }
    },
    // Kullanıcının girdiği tutarı kaldırma reducer'ı
    clearUserAmount: (state, action: PayloadAction<string>) => {
        const itemId = action.payload;
        const item = state.items.find(i => i.id === itemId);
        if (item && isSerializableStatement(item)) {
            delete item.userAmount;
            console.log(`Item ${itemId} userAmount cleared.`);
        } else {
            console.warn(`Item with ID ${itemId} not found or not a statement for clearing userAmount.`);
        }
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
    // Manuel Giriş: Kredi taksit mantığı eklendi
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

        // Eğer kredi ise, taksitleri oluştur
        if (newEntry.entryType === 'loan' && newEntry.installmentCount && newEntry.installmentCount > 0) {
            const baseDate = newEntry.dueDate instanceof Date ? newEntry.dueDate : new Date(newEntry.dueDate);

            for (let i = 0; i < newEntry.installmentCount; i++) {
                const installmentDate = addMonths(baseDate, i);
                const installmentDateString = installmentDate.toISOString();
                const installmentId = `${newEntry.id}_installment_${i + 1}`;

                const installmentEntry: SerializableManualEntry = {
                    id: installmentId,
                    description: `${newEntry.description} - Taksit ${i + 1}/${newEntry.installmentCount}`,
                    amount: newEntry.amount,
                    dueDate: installmentDateString,
                    source: 'manual',
                    isPaid: false,
                    entryType: 'debt', // Taksitler borç olarak işaretlenir
                };

                state.items.push(installmentEntry);
            }

            state.error = null;
            sortItemsByDate(state.items);
            console.log(`Loan entry added with ${newEntry.installmentCount} installments: ${newEntry.id}`);
        } else {
            // Normal giriş (borç veya harcama)
            const serializedEntry: SerializableManualEntry = {
                ...newEntry,
                id: newEntry.id,
                dueDate: dueDateString,
                source: 'manual',
                isPaid: newEntry.isPaid || false,
                entryType: newEntry.entryType,
                installmentCount: newEntry.installmentCount,
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
    // Tüm krediyi (tüm taksitlerini) silme
    deleteLoan: (state, action: PayloadAction<string>) => {
       const loanIdToDelete = action.payload;
       const initialLength = state.items.length;

       // Bu krediye ait tüm taksitleri sil
       state.items = state.items.filter(item => {
         if (isSerializableManualEntry(item) && item.description.includes('Taksit')) {
           // ID pattern kontrolü: loanId_installment_X
           return !item.id.startsWith(`${loanIdToDelete}_installment_`);
         }
         return true;
       });

       const deletedCount = initialLength - state.items.length;
       if (deletedCount > 0) {
           console.log(`Loan deleted with ${deletedCount} installments: ${loanIdToDelete}`);
           state.error = null;
       } else {
           console.warn(`Loan with ID ${loanIdToDelete} not found for deletion.`);
       }
    },
    // Verileri import et (cihazlar arası aktarım için)
    importData: (state, action: PayloadAction<{ items: SerializableDisplayItem[], merge: boolean }>) => {
       const { items: importedItems, merge } = action.payload;

       if (merge) {
         // Mevcut verilere ekle (aynı ID varsa atla)
         const existingIds = new Set(state.items.map(item => item.id));
         const newItems = importedItems.filter(item => !existingIds.has(item.id));
         state.items.push(...newItems);
         console.log(`Imported ${newItems.length} new items (merged)`);
       } else {
         // Tüm verileri değiştir
         state.items = importedItems;
         console.log(`Imported ${importedItems.length} items (replaced)`);
       }

       sortItemsByDate(state.items);
       state.error = null;
       state.lastUpdated = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAndProcessDataThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchAndProcessDataThunk.fulfilled, (state, action: PayloadAction<FetchDataResult>) => {
        // Mevcut öğelerin isPaid durumlarını ve userAmount değerlerini haritada sakla.
        // ID'ler stabil olmadığı için, stabil bir anahtar kullan.
        const paidStatusMap = new Map<string, boolean>();
        const userAmountMap = new Map<string, number>();
        state.items.forEach(item => {
            // Manuel girişler için ID stabil.
            if(isSerializableManualEntry(item)) {
                if (item.isPaid) paidStatusMap.set(item.id, true);
            } else if (isSerializableStatement(item)) {
                // Otomatik girişler için stabil anahtar oluştur.
                try {
                    const deserializedItem = {
                        ...item,
                        dueDate: new Date(item.dueDate)
                    }
                    const key = createStableKey(deserializedItem as any);
                    if (item.isPaid) paidStatusMap.set(key, true);
                    if (item.userAmount !== undefined) userAmountMap.set(key, item.userAmount);
                } catch(e) {
                     console.error("Error creating stable key for existing item:", item, e);
                }
            }
        });

        // Thunk'tan gelen yeni otomatik kayıtlar
        const newAutomaticEntries = action.payload.items;

        // Yeni otomatik kayıtlara eski isPaid durumunu ve userAmount değerini uygula
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

            const updates: Partial<typeof item> = {};
            if (paidStatusMap.has(key)) updates.isPaid = true;
            if (userAmountMap.has(key)) updates.userAmount = userAmountMap.get(key);

            return Object.keys(updates).length > 0 ? { ...item, ...updates } : item;
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

// Memoized selector: Tarihleri dönüştür ve 1 ay içindeki taksitleri filtrele
export const selectAllDataWithDates = createSelector(
  [selectAllData],
  (items): DisplayItem[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    oneMonthFromNow.setHours(23, 59, 59, 999);

    return items.map(item => {
        try {
            if (isSerializableStatement(item)) {
                return { ...item, dueDate: new Date(item.dueDate), isPaid: !!item.isPaid, userAmount: item.userAmount, entryType: 'debt' } as DisplayItem;
            } else if (isSerializableManualEntry(item)) {
                 return { ...item, dueDate: new Date(item.dueDate), isPaid: !!item.isPaid, entryType: item.entryType } as DisplayItem;
            }
        } catch (e) {
             console.error("Error converting item dates in selector:", item, e);
        }
        console.warn("Unknown or problematic item type in selectAllDataWithDates, returning null:", item);
        return null;
    })
    .filter((item): item is DisplayItem => item !== null)
    .filter(item => {
        // Kredi taksitlerini filtrele (description'da "Taksit" geçiyorsa)
        if (isTypeGuardManualEntry(item) && item.description.includes('Taksit')) {
            // Sadece 1 ay içindeki taksitleri göster
            return item.dueDate >= today && item.dueDate <= oneMonthFromNow;
        }
        // Diğer kayıtlar için filtreleme yok
        return true;
    });
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
        currentAmount = item.userAmount ?? item.amount ?? 0;
      } else if (isSerializableManualEntry(item)) {
        currentAmount = item.amount;
      }
      return total + currentAmount;
    }, 0);
  }
);

// Kredi gruplama tipi
export interface LoanGroup {
  loanId: string; // Ana kredi ID'si (taksitlerdeki ortak prefix)
  description: string; // Kredi açıklaması
  monthlyAmount: number; // Aylık taksit tutarı
  totalInstallments: number; // Toplam taksit sayısı
  paidInstallments: number; // Ödenen taksit sayısı
  installments: ManualEntry[]; // Tüm taksitler (tarihlere göre sıralı)
}

// Kredileri gruplandıran selector
export const selectGroupedLoans = createSelector(
  [selectAllData],
  (items): LoanGroup[] => {
    const loanMap = new Map<string, LoanGroup>();

    items.forEach(item => {
      // Sadece taksitleri işle
      if (isSerializableManualEntry(item) && item.description.includes('Taksit')) {
        // Taksit ID'sinden ana kredi ID'sini çıkar (örn: "loan123_installment_1" -> "loan123")
        const match = item.id.match(/^(.+)_installment_\d+$/);
        if (match) {
          const loanId = match[1];

          // Açıklamadan kredi adını çıkar (örn: "İhtiyaç Kredisi - Taksit 1/12" -> "İhtiyaç Kredisi")
          const descMatch = item.description.match(/^(.+) - Taksit \d+\/(\d+)$/);
          const loanDescription = descMatch ? descMatch[1] : item.description;
          const totalInstallments = descMatch ? parseInt(descMatch[2]) : 1;

          if (!loanMap.has(loanId)) {
            loanMap.set(loanId, {
              loanId,
              description: loanDescription,
              monthlyAmount: item.amount,
              totalInstallments,
              paidInstallments: 0,
              installments: []
            });
          }

          const loanGroup = loanMap.get(loanId)!;

          // Tarihi deserialize et
          const installment: ManualEntry = {
            ...item,
            dueDate: new Date(item.dueDate)
          };

          loanGroup.installments.push(installment);
          if (item.isPaid) {
            loanGroup.paidInstallments++;
          }
        }
      }
    });

    // Taksitleri tarihe göre sırala ve array'e çevir
    return Array.from(loanMap.values()).map(loan => ({
      ...loan,
      installments: loan.installments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    }));
  }
);


// Yeni action'ı export et
export const { clearData, addManualEntry, deleteManualEntry, togglePaidStatus, deleteLoan, importData, setUserAmount, clearUserAmount } = dataSlice.actions;
export default dataSlice.reducer;