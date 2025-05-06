import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { ParsedStatement, ParsedLoan } from '../../services/sms-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types.ts';
import { statementProcessor } from '../../services/sms-parsing/sms-processor';
import { startGlobalLoading, stopGlobalLoading } from './loadingSlice';
import type { RootState } from '../index';
// Type guard importları eklendi
import { isStatement, isLoan, isManualEntry as isTypeGuardManualEntry } from '../../utils/typeGuards'; 
// import { Capacitor } from '@capacitor/core'; // Capacitor import edildi

// DisplayItem tipini eski haline getir
type DisplayItem = ParsedStatement | ParsedLoan | ManualEntry;

// --- Serialize edilmiş veri tipi (isPaid kaldırıldı) ---
type SerializableStatement = Omit<ParsedStatement, 'dueDate'> & { id: string; dueDate: string; }; // id eklendi, isPaid kaldırıldı
type SerializableLoan = Omit<ParsedLoan, 'firstPaymentDate'> & { id: string; firstPaymentDate: string | null; }; // id eklendi, isPaid kaldırıldı
type SerializableManualEntry = Omit<ManualEntry, 'dueDate'> & { dueDate: string; source: 'manual'; }; // isPaid kaldırıldı
type SerializableDisplayItem = SerializableStatement | SerializableLoan | SerializableManualEntry;

// Thunk dönüş tipi: items artık isPaid içermiyor
interface FetchDataResult {
  items: (SerializableStatement | SerializableLoan)[]; // Yeni otomatik kayıtlar (isPaid içermez)
  totalItems: number;
}

// Tip kontrol fonksiyonları (isPaid kontrolü kaldırıldı)
function isSerializableStatement(item: SerializableDisplayItem): item is SerializableStatement {
  return typeof item.source === 'string' && item.source !== 'manual' && typeof (item as SerializableStatement).dueDate === 'string';
}
function isSerializableLoan(item: SerializableDisplayItem): item is SerializableLoan {
     return item && typeof item === 'object' && item.source !== 'manual' && ('firstPaymentDate' in item) && (typeof item.firstPaymentDate === 'string' || item.firstPaymentDate === null);
}
function isSerializableManualEntry(item: SerializableDisplayItem): item is SerializableManualEntry {
    return item.source === 'manual';
}

// Veri Getirme ve İşleme Thunk'ı (isPaid mantığı kaldırıldı)
export const fetchAndProcessDataThunk = createAsyncThunk<
  FetchDataResult, // Thunk artık isPaid içermeyen yeni otomatik kayıtları döndürür
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

      const fetchedItems: (ParsedStatement | ParsedLoan)[] = [...parsedStatements, ...parsedLoans];
      console.log(`Parsed ${parsedStatements.length} statements and ${parsedLoans.length} loans.`);

      // --- YENİ OTOMATİK KAYITLARI SERIALIZE ET (isPaid OLMADAN) ---
      const serializableFetchedItems: (SerializableStatement | SerializableLoan)[] = [];
      for (const item of fetchedItems) {
          let serializableOriginalMessage: any = item.originalMessage;
           if (item.originalMessage && item.originalMessage.date instanceof Date) {
               serializableOriginalMessage = {
                   ...item.originalMessage,
                   date: item.originalMessage.date.toISOString()
               };
           }

          // ID'yi oluştur (parser'dan gelmiyorsa)
          const generatedId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          // baseItem oluşturmaya gerek kalmadı, doğrudan item kullanabiliriz

          // Type guard'lar ile kontrol
          if (isStatement(item)) { // ParsedStatement kontrolü
              const serializedItem: SerializableStatement = {
                  ...item, // Spread ParsedStatement özellikleri
                  id: generatedId,
                  dueDate: item.dueDate.toISOString(), // Guard sayesinde güvenli erişim
                  originalMessage: serializableOriginalMessage,
              };
              serializableFetchedItems.push(serializedItem);
          } else if (isLoan(item)) { // ParsedLoan kontrolü
               const serializedItem: SerializableLoan = {
                   ...item, // Spread ParsedLoan özellikleri
                   id: generatedId,
                   // Guard sayesinde güvenli erişim, Date kontrolü hala gerekli
                   firstPaymentDate: item.firstPaymentDate instanceof Date ? item.firstPaymentDate.toISOString() : null, 
                   originalMessage: serializableOriginalMessage,
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
                        : isSerializableLoan(a) ? a.firstPaymentDate : null;
      const dateStringB = isSerializableManualEntry(b) ? b.dueDate
                        : isSerializableStatement(b) ? b.dueDate
                        : isSerializableLoan(b) ? b.firstPaymentDate : null;

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
    // Manuel Giriş: isPaid mantığı kaldırıldı
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

        // SerializableManualEntry (isPaid olmadan)
        const serializedEntry: SerializableManualEntry = {
            ...newEntry,
            id: newEntry.id,
            dueDate: dueDateString,
            source: 'manual',
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
        // Mevcut manuel kayıtları koru
        const existingManualEntries = state.items.filter(isSerializableManualEntry);

        // Thunk'tan gelen yeni otomatik kayıtlar (isPaid içermez)
        const newAutomaticEntries = action.payload.items;

        // Mevcut manuel kayıtları ve YENİ otomatik kayıtları birleştir
        state.items = [...existingManualEntries, ...newAutomaticEntries];

        state.error = null;
        state.lastUpdated = Date.now();
        sortItemsByDate(state.items);
        console.log(`Data slice updated (Filter Disabled). Total items: ${state.items.length} (Manual: ${existingManualEntries.length}, New Auto: ${newAutomaticEntries.length})`);
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
  (items): DisplayItem[] => { // Dönen tip DisplayItem[] (isPaid yok)
    return items.map(item => {
        try {
            if (isSerializableStatement(item)) {
                return { ...item, dueDate: new Date(item.dueDate) } as DisplayItem;
            } else if (isSerializableLoan(item)) {
                return { ...item, firstPaymentDate: item.firstPaymentDate ? new Date(item.firstPaymentDate) : null } as DisplayItem;
            } else if (isSerializableManualEntry(item)) {
                 return { ...item, dueDate: new Date(item.dueDate) } as DisplayItem;
            }
        } catch (e) {
             console.error("Error converting item dates in selector:", item, e);
        }
        console.warn("Unknown or problematic item type in selectAllDataWithDates, returning null:", item);
        return null;
    }).filter((item): item is DisplayItem => item !== null);
  }
);

// Yeni action'ı export et
export const { clearData, addManualEntry, deleteManualEntry } = dataSlice.actions;
export default dataSlice.reducer;