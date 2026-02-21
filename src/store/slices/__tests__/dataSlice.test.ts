import { configureStore } from '@reduxjs/toolkit';
import dataReducer, {
  addManualEntry,
  togglePaidStatus,
  selectAllDataWithDates,
  selectTotalDebt,
  selectGroupedLoans,
  deleteLoan,
  setUserAmount,
  clearUserAmount,
  updateItemDueDate,
  fetchAndProcessDataThunk,
} from '../dataSlice';
import type { ManualEntry } from '../../../types/manual-entry.types';
import type { ParsedStatement } from '../../../services/statement-parsing/types';
import { BANK_NAMES } from '../../../services/bank-registry';

// DisplayItem tipi (dataSlice'dakiyle aynı)
type DisplayItem = ParsedStatement | ManualEntry;

// Test için store tipi tanımla
interface TestRootState {
  data: ReturnType<typeof dataReducer>;
}

type TestStore = ReturnType<typeof configureStore<TestRootState>>;

describe('dataSlice - Manuel Kredi Girişi', () => {
  let store: TestStore;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        data: dataReducer,
      },
    });
  });

  describe('addManualEntry - Kredi Taksitleri', () => {
    it('should create installments when adding a loan entry', () => {
      const loanEntry: ManualEntry = {
        id: 'test_loan_1',
        description: 'İhtiyaç Kredisi',
        amount: 500,
        dueDate: new Date('2025-02-15'),
        source: 'manual',
        entryType: 'loan',
        installmentCount: 6,
      };

      store.dispatch(addManualEntry(loanEntry));

      const state = store.getState().data;

      // 6 taksit oluşturulmalı
      expect(state.items.length).toBe(6);

      // Taksitleri ID'ye göre sırala (items tarihe göre sıralandığı için karışık olabilir)
      const sortedItems = [...state.items].sort((a, b) => {
        const aNum = parseInt(a.id.split('_installment_')[1]);
        const bNum = parseInt(b.id.split('_installment_')[1]);
        return aNum - bNum;
      });

      // Her taksit kontrol edilmeli
      sortedItems.forEach((item, index) => {
        expect(item.id).toBe(`test_loan_1_installment_${index + 1}`);
        // Item manuel giriş olmalı (taksitler SerializableManualEntry)
        if ('description' in item) {
          expect(item.description).toBe(`İhtiyaç Kredisi - Taksit ${index + 1}/6`);
        }
        expect(item.amount).toBe(500);
        expect(item.entryType).toBe('debt');
        expect(item.source).toBe('manual');
        expect(item.isPaid).toBe(false);
      });

      // Tarihlerin her ay ilerlediğini kontrol et (sıralanmış liste üzerinden)
      const firstDate = new Date(sortedItems[0].dueDate);
      const secondDate = new Date(sortedItems[1].dueDate);

      expect(secondDate.getMonth()).toBe((firstDate.getMonth() + 1) % 12);
    });

    it('should add normal entry when entryType is debt', () => {
      const debtEntry: ManualEntry = {
        id: 'test_debt_1',
        description: 'Kira Ödemesi',
        amount: 5000,
        dueDate: new Date('2025-02-01'),
        source: 'manual',
        entryType: 'debt',
      };

      store.dispatch(addManualEntry(debtEntry));

      const state = store.getState().data;

      // Sadece 1 kayıt oluşturulmalı
      expect(state.items.length).toBe(1);
      expect(state.items[0].id).toBe('test_debt_1');
      if ('description' in state.items[0]) {
        expect(state.items[0].description).toBe('Kira Ödemesi');
      }
      expect(state.items[0].entryType).toBe('debt');
    });

    it('should add normal entry when entryType is expense', () => {
      const expenseEntry: ManualEntry = {
        id: 'test_expense_1',
        description: 'Market Alışverişi',
        amount: 1200,
        dueDate: new Date('2025-02-05'),
        source: 'manual',
        entryType: 'expense',
      };

      store.dispatch(addManualEntry(expenseEntry));

      const state = store.getState().data;

      expect(state.items.length).toBe(1);
      expect(state.items[0].entryType).toBe('expense');
    });

    it('should not create installments if installmentCount is missing for loan', () => {
      const loanEntryWithoutCount: ManualEntry = {
        id: 'test_loan_2',
        description: 'Hatalı Kredi',
        amount: 300,
        dueDate: new Date('2025-03-01'),
        source: 'manual',
        entryType: 'loan',
        // installmentCount yok
      };

      store.dispatch(addManualEntry(loanEntryWithoutCount));

      const state = store.getState().data;

      // Taksitler oluşturulmamalı, normal giriş olarak eklenmeliş
      expect(state.items.length).toBe(1);
      expect(state.items[0].id).toBe('test_loan_2');
    });
  });

  describe('selectAllDataWithDates - Taksit Filtreleme', () => {
    it('should filter installments to show only those within 1 month', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // İlk taksit bugün
      const firstInstallmentDate = new Date(today);

      const loanEntry: ManualEntry = {
        id: 'test_loan_filter',
        description: 'Test Kredisi',
        amount: 400,
        dueDate: firstInstallmentDate,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 12,
      };

      store.dispatch(addManualEntry(loanEntry));

      const state = store.getState() as any; // Test store'dan RootState'e cast
      const allItems: DisplayItem[] = selectAllDataWithDates(state);

      // 12 taksit oluşturuldu ama sadece 1 ay içindekiler gösterilmeli
      // İlk 2 taksit 1 ay içinde olmalı (bugün ve 1 ay sonra)
      expect(allItems.length).toBeLessThanOrEqual(2);
      expect(allItems.length).toBeGreaterThan(0);

      // Her taksit 1 ay içinde olmalı
      const oneMonthFromNow = new Date(today);
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      oneMonthFromNow.setHours(23, 59, 59, 999);

      allItems.forEach(item => {
        expect(item.dueDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
        expect(item.dueDate.getTime()).toBeLessThanOrEqual(oneMonthFromNow.getTime());
      });
    });

    it('should not filter non-installment entries', () => {
      const today = new Date();
      const farFutureDate = new Date(today);
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 1);

      const debtEntry: ManualEntry = {
        id: 'test_future_debt',
        description: 'Gelecek Borç',
        amount: 1000,
        dueDate: farFutureDate,
        source: 'manual',
        entryType: 'debt',
      };

      store.dispatch(addManualEntry(debtEntry));

      const state = store.getState() as any; // Test store'dan RootState'e cast
      const allItems: DisplayItem[] = selectAllDataWithDates(state);

      // Normal borçlar filtrelenmemeli, görünmeli
      expect(allItems.length).toBe(1);
      if ('description' in allItems[0]) {
        expect(allItems[0].description).toBe('Gelecek Borç');
      }
    });
  });

  describe('selectTotalDebt', () => {
    it('should calculate total debt only for installments visible on main screen (within 1 month)', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Kredi ekle (3 taksit: bugün, 1 ay sonra, 2 ay sonra)
      const loanEntry: ManualEntry = {
        id: 'test_loan_debt',
        description: 'Borç Kredisi',
        amount: 500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 3,
      };

      store.dispatch(addManualEntry(loanEntry));

      // Sadece 1 ay içindeki taksitler borç hesaplamasına dahil olmalı (2 * 500 = 1000)
      const state = store.getState() as any; // Test store'dan RootState'e cast
      const totalDebt = selectTotalDebt(state);
      expect(totalDebt).toBe(1000);
    });

    it('should not include expenses in total debt', () => {
      const expenseEntry: ManualEntry = {
        id: 'test_expense_debt',
        description: 'Harcama',
        amount: 2000,
        dueDate: new Date(),
        source: 'manual',
        entryType: 'expense',
      };

      store.dispatch(addManualEntry(expenseEntry));

      const state = store.getState() as any; // Test store'dan RootState'e cast
      const totalDebt = selectTotalDebt(state);
      expect(totalDebt).toBe(0);
    });

    it('should not include paid installments in total debt', () => {
      const today = new Date();

      const loanEntry: ManualEntry = {
        id: 'test_paid_loan',
        description: 'Ödenmiş Kredi',
        amount: 300,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      store.dispatch(addManualEntry(loanEntry));

      // İlk durumda 2 * 300 = 600
      let state = store.getState() as any; // Test store'dan RootState'e cast
      let totalDebt = selectTotalDebt(state);
      expect(totalDebt).toBe(600);

      // Bir taksiti ödenmiş olarak işaretle
      const firstInstallmentId = store.getState().data.items[0].id;
      store.dispatch(togglePaidStatus(firstInstallmentId));

      // Şimdi sadece 1 * 300 = 300 olmalı
      state = store.getState() as any; // Test store'dan RootState'e cast
      totalDebt = selectTotalDebt(state);
      expect(totalDebt).toBe(300);
    });
  });

  describe('selectGroupedLoans', () => {
    it('should group loan installments by loan ID', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const loanEntry: ManualEntry = {
        id: 'test_loan_group',
        description: 'Taşıt Kredisi',
        amount: 800,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 4,
      };

      store.dispatch(addManualEntry(loanEntry));

      const state = store.getState() as any;
      const groupedLoans = selectGroupedLoans(state);

      // 1 kredi grubu olmalı
      expect(groupedLoans.length).toBe(1);

      const loan = groupedLoans[0];
      expect(loan.loanId).toBe('test_loan_group');
      expect(loan.description).toBe('Taşıt Kredisi');
      expect(loan.monthlyAmount).toBe(800);
      expect(loan.totalInstallments).toBe(4);
      expect(loan.paidInstallments).toBe(0);
      expect(loan.installments.length).toBe(4);

      // Taksitlerin tarihe göre sıralı olduğunu kontrol et
      for (let i = 1; i < loan.installments.length; i++) {
        expect(loan.installments[i].dueDate.getTime()).toBeGreaterThan(
          loan.installments[i - 1].dueDate.getTime()
        );
      }
    });

    it('should count paid installments correctly', () => {
      const today = new Date();

      const loanEntry: ManualEntry = {
        id: 'test_loan_paid',
        description: 'Konut Kredisi',
        amount: 1000,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 3,
      };

      store.dispatch(addManualEntry(loanEntry));

      // İlk 2 taksiti ödenmiş olarak işaretle
      const dataState = store.getState().data;
      const sortedInstallments = [...dataState.items].sort((a, b) => {
        const aNum = parseInt(a.id.split('_installment_')[1]);
        const bNum = parseInt(b.id.split('_installment_')[1]);
        return aNum - bNum;
      });

      store.dispatch(togglePaidStatus(sortedInstallments[0].id));
      store.dispatch(togglePaidStatus(sortedInstallments[1].id));

      const state = store.getState() as any;
      const groupedLoans = selectGroupedLoans(state);

      expect(groupedLoans.length).toBe(1);
      expect(groupedLoans[0].paidInstallments).toBe(2);
      expect(groupedLoans[0].totalInstallments).toBe(3);
    });

    it('should handle multiple loans', () => {
      const today = new Date();

      const loan1: ManualEntry = {
        id: 'loan_1',
        description: 'İhtiyaç Kredisi',
        amount: 500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      const loan2: ManualEntry = {
        id: 'loan_2',
        description: 'Araç Kredisi',
        amount: 1500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 3,
      };

      store.dispatch(addManualEntry(loan1));
      store.dispatch(addManualEntry(loan2));

      const state = store.getState() as any;
      const groupedLoans = selectGroupedLoans(state);

      // 2 kredi grubu olmalı
      expect(groupedLoans.length).toBe(2);

      // İlk kredi kontrolü
      const firstLoan = groupedLoans.find(l => l.loanId === 'loan_1');
      expect(firstLoan).toBeDefined();
      expect(firstLoan!.description).toBe('İhtiyaç Kredisi');
      expect(firstLoan!.installments.length).toBe(2);

      // İkinci kredi kontrolü
      const secondLoan = groupedLoans.find(l => l.loanId === 'loan_2');
      expect(secondLoan).toBeDefined();
      expect(secondLoan!.description).toBe('Araç Kredisi');
      expect(secondLoan!.installments.length).toBe(3);
    });

    it('should not include non-installment entries', () => {
      const today = new Date();

      // Normal borç ekle
      const debtEntry: ManualEntry = {
        id: 'debt_1',
        description: 'Kira',
        amount: 5000,
        dueDate: today,
        source: 'manual',
        entryType: 'debt',
      };

      // Kredi ekle
      const loanEntry: ManualEntry = {
        id: 'loan_only',
        description: 'Test Kredisi',
        amount: 400,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      store.dispatch(addManualEntry(debtEntry));
      store.dispatch(addManualEntry(loanEntry));

      const state = store.getState() as any;
      const groupedLoans = selectGroupedLoans(state);

      // Sadece 1 kredi grubu olmalı (normal borç dahil değil)
      expect(groupedLoans.length).toBe(1);
      expect(groupedLoans[0].loanId).toBe('loan_only');
    });
  });

  describe('deleteLoan', () => {
    it('should delete all installments of a loan', () => {
      const today = new Date();

      const loanEntry: ManualEntry = {
        id: 'loan_to_delete',
        description: 'Silinecek Kredi',
        amount: 600,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 5,
      };

      store.dispatch(addManualEntry(loanEntry));

      // 5 taksit oluşturulmalı
      let state = store.getState().data;
      expect(state.items.length).toBe(5);

      // Krediyi sil
      store.dispatch(deleteLoan('loan_to_delete'));

      // Tüm taksitler silinmeli
      state = store.getState().data;
      expect(state.items.length).toBe(0);
    });

    it('should only delete specified loan, not others', () => {
      const today = new Date();

      const loan1: ManualEntry = {
        id: 'keep_loan',
        description: 'Kalacak Kredi',
        amount: 300,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      const loan2: ManualEntry = {
        id: 'delete_loan',
        description: 'Silinecek Kredi',
        amount: 400,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 3,
      };

      store.dispatch(addManualEntry(loan1));
      store.dispatch(addManualEntry(loan2));

      // Toplam 5 taksit olmalı (2 + 3)
      let state = store.getState().data;
      expect(state.items.length).toBe(5);

      // Sadece ikinci krediyi sil
      store.dispatch(deleteLoan('delete_loan'));

      // Sadece 2 taksit kalmalı (ilk kredinin)
      state = store.getState().data;
      expect(state.items.length).toBe(2);

      // Kalan taksitlerin doğru krediye ait olduğunu kontrol et
      state.items.forEach(item => {
        expect(item.id).toContain('keep_loan');
      });
    });

    it('should not delete non-loan entries', () => {
      const today = new Date();

      // Normal borç ekle
      const debtEntry: ManualEntry = {
        id: 'debt_entry',
        description: 'Normal Borç',
        amount: 1000,
        dueDate: today,
        source: 'manual',
        entryType: 'debt',
      };

      // Kredi ekle
      const loanEntry: ManualEntry = {
        id: 'loan_entry',
        description: 'Kredi',
        amount: 500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      store.dispatch(addManualEntry(debtEntry));
      store.dispatch(addManualEntry(loanEntry));

      // 1 borç + 2 taksit = 3 item olmalı
      let state = store.getState().data;
      expect(state.items.length).toBe(3);

      // Krediyi sil
      store.dispatch(deleteLoan('loan_entry'));

      // Sadece normal borç kalmalı
      state = store.getState().data;
      expect(state.items.length).toBe(1);
      expect(state.items[0].id).toBe('debt_entry');
      if ('description' in state.items[0]) {
        expect(state.items[0].description).toBe('Normal Borç');
      }
    });

    it('should handle deleting non-existent loan gracefully', () => {
      const today = new Date();

      const loanEntry: ManualEntry = {
        id: 'existing_loan',
        description: 'Var Olan Kredi',
        amount: 500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 2,
      };

      store.dispatch(addManualEntry(loanEntry));

      let state = store.getState().data;
      const initialLength = state.items.length;

      // Olmayan bir krediyi silmeye çalış
      store.dispatch(deleteLoan('non_existent_loan'));

      // Hiçbir şey silinmemeli
      state = store.getState().data;
      expect(state.items.length).toBe(initialLength);
    });
  });

  describe('userAmount - Elle Tutar Girme', () => {
    // Otomatik kayıtları (statement) simüle etmek için yardımcı fonksiyon
    const createStoreWithStatements = (statements: any[]) => {
      return configureStore({
        reducer: { data: dataReducer },
        preloadedState: {
          data: {
            items: statements,
            error: null,
            lastUpdated: Date.now(),
          },
        },
      });
    };

    const makeStatement = (overrides: Partial<any> = {}) => ({
      id: 'stmt_1',
      bankName: BANK_NAMES.YAPI_KREDI,
      dueDate: new Date().toISOString(),
      amount: null,
      last4Digits: '1234',
      source: 'email',
      isPaid: false,
      entryType: 'debt',
      originalMessage: { id: 'msg1', sender: 'test@test.com', subject: 'Ekstre', date: new Date().toISOString(), plainBody: null, htmlBody: null },
      ...overrides,
    });

    it('should set userAmount on a statement item', () => {
      const stmt = makeStatement();
      const testStore = createStoreWithStatements([stmt]);

      testStore.dispatch(setUserAmount({ id: 'stmt_1', amount: 1500.50 }));

      const state = testStore.getState().data;
      expect((state.items[0] as any).userAmount).toBe(1500.50);
    });

    it('should clear userAmount from a statement item', () => {
      const stmt = makeStatement({ userAmount: 2000 });
      const testStore = createStoreWithStatements([stmt]);

      // Önce userAmount'un var olduğunu doğrula
      expect((testStore.getState().data.items[0] as any).userAmount).toBe(2000);

      testStore.dispatch(clearUserAmount('stmt_1'));

      const state = testStore.getState().data;
      expect((state.items[0] as any).userAmount).toBeUndefined();
    });

    it('should not set userAmount on a manual entry item', () => {
      const testStore = createStoreWithStatements([]);

      // Manuel kayıt ekle
      const manualEntry: ManualEntry = {
        id: 'manual_1',
        description: 'Test Kayıt',
        amount: 500,
        dueDate: new Date(),
        source: 'manual',
        entryType: 'debt',
      };
      testStore.dispatch(addManualEntry(manualEntry));

      // Manuel kayıtta userAmount ayarlamaya çalış - statement olmadığı için uygulanmamalı
      testStore.dispatch(setUserAmount({ id: 'manual_1', amount: 999 }));

      const state = testStore.getState().data;
      expect((state.items[0] as any).userAmount).toBeUndefined();
    });

    it('should use userAmount in selectTotalDebt when amount is null', () => {
      const stmt = makeStatement({ amount: null, userAmount: 3000 });
      const testStore = createStoreWithStatements([stmt]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      expect(totalDebt).toBe(3000);
    });

    it('should use userAmount over amount in selectTotalDebt when both exist', () => {
      const stmt = makeStatement({ amount: 1000, userAmount: 2500 });
      const testStore = createStoreWithStatements([stmt]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      expect(totalDebt).toBe(2500);
    });

    it('should fall back to amount when userAmount is not set', () => {
      const stmt = makeStatement({ amount: 1800 });
      const testStore = createStoreWithStatements([stmt]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      expect(totalDebt).toBe(1800);
    });

    it('should treat amount as 0 when both amount and userAmount are absent', () => {
      const stmt = makeStatement({ amount: null });
      const testStore = createStoreWithStatements([stmt]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      expect(totalDebt).toBe(0);
    });

    it('should include userAmount in selectAllDataWithDates output', () => {
      const stmt = makeStatement({ amount: null, userAmount: 4500 });
      const testStore = createStoreWithStatements([stmt]);

      const items = selectAllDataWithDates(testStore.getState() as any);
      expect(items.length).toBe(1);
      expect((items[0] as any).userAmount).toBe(4500);
    });

    it('should not affect paid items in total debt even with userAmount', () => {
      const stmt = makeStatement({ amount: null, userAmount: 5000, isPaid: true });
      const testStore = createStoreWithStatements([stmt]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      expect(totalDebt).toBe(0);
    });

    it('should handle multiple statements with mixed userAmount and amount', () => {
      const stmt1 = makeStatement({ id: 'stmt_1', amount: null, userAmount: 1000 });
      const stmt2 = makeStatement({ id: 'stmt_2', amount: 2000, last4Digits: '5678' });
      const stmt3 = makeStatement({ id: 'stmt_3', amount: null, last4Digits: '9012' }); // Ne amount ne userAmount
      const testStore = createStoreWithStatements([stmt1, stmt2, stmt3]);

      const totalDebt = selectTotalDebt(testStore.getState() as any);
      // 1000 (userAmount) + 2000 (amount) + 0 (null, no userAmount) = 3000
      expect(totalDebt).toBe(3000);
    });
  });

  describe('Deduplikasyon - Manuel ve Email Kayıtları', () => {
    // Otomatik kayıtları (statement) simüle etmek için yardımcı fonksiyon
    const createStoreWithItems = (items: any[]) => {
      return configureStore({
        reducer: { data: dataReducer },
        preloadedState: {
          data: {
            items,
            error: null,
            lastUpdated: Date.now(),
          },
        },
      });
    };

    const makeSerializedStatement = (overrides: Partial<any> = {}) => ({
      id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bankName: BANK_NAMES.AKBANK,
      dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
      amount: 2500,
      last4Digits: '1234',
      source: 'email',
      isPaid: false,
      entryType: 'debt',
      originalMessage: { id: 'msg1', sender: 'test@akbank.com', subject: 'Ekstre', date: new Date().toISOString(), plainBody: null, htmlBody: null },
      ...overrides,
    });

    it('should remove manual entry when matching email entry arrives', () => {
      // Manuel kayıt ile store oluştur (screenshot'tan eklenmiş gibi)
      const manualEntry = {
        id: 'manual_akbank_1',
        description: 'Akbank - ****1234',
        amount: 2500,
        dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
        source: 'manual' as const,
        isPaid: false,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      // Email'den gelen aynı ekstre
      const emailStatement = makeSerializedStatement();

      // fetchAndProcessDataThunk.fulfilled action'ını simüle et
      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      // Sadece 1 kayıt olmalı (email kaydı)
      expect(state.items.length).toBe(1);
      expect(state.items[0].source).toBe('email');
      expect((state.items[0] as any).bankName).toBe(BANK_NAMES.AKBANK);
    });

    it('should transfer isPaid from manual to email entry during deduplication', () => {
      // Ödenmiş olarak işaretlenmiş manuel kayıt
      const manualEntry = {
        id: 'manual_akbank_paid',
        description: 'Akbank - ****5678',
        amount: 3000,
        dueDate: new Date('2026-03-20T09:00:00.000Z').toISOString(),
        source: 'manual' as const,
        isPaid: true,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      // Email'den gelen aynı ekstre (isPaid: false)
      const emailStatement = makeSerializedStatement({
        last4Digits: '5678',
        dueDate: new Date('2026-03-20T09:00:00.000Z').toISOString(),
        amount: 3000,
        isPaid: false,
      });

      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      expect(state.items.length).toBe(1);
      expect(state.items[0].source).toBe('email');
      // isPaid durumu manuel kayıttan aktarılmış olmalı
      expect(state.items[0].isPaid).toBe(true);
    });

    it('should not remove manual entries that do not match email entries', () => {
      // Farklı banka veya kart numarasına sahip manuel kayıt
      const manualEntry = {
        id: 'manual_different',
        description: 'Akbank - ****9999',
        amount: 1500,
        dueDate: new Date('2026-03-25T09:00:00.000Z').toISOString(),
        source: 'manual' as const,
        isPaid: false,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      // Farklı kart numarası olan email kaydı
      const emailStatement = makeSerializedStatement({
        last4Digits: '1234',
        dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
      });

      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      // 2 kayıt olmalı: 1 manuel + 1 email
      expect(state.items.length).toBe(2);
    });

    it('should not remove non-bank manual entries', () => {
      // Banka adı olmayan manuel kayıt
      const manualEntry = {
        id: 'manual_kira',
        description: 'Kira Ödemesi',
        amount: 5000,
        dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
        source: 'manual' as const,
        isPaid: false,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      const emailStatement = makeSerializedStatement();

      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      // 2 kayıt olmalı: "Kira Ödemesi" kaldırılmamalı
      expect(state.items.length).toBe(2);
      const manualItems = state.items.filter(i => i.source === 'manual');
      expect(manualItems.length).toBe(1);
    });

    it('should handle deduplication with amount differences (OCR vs email)', () => {
      // Screenshot'tan farklı tutar algılanmış olabilir
      const manualEntry = {
        id: 'manual_diff_amount',
        description: 'Akbank - ****1234',
        amount: 2499, // OCR hatalı okuma
        dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
        source: 'manual' as const,
        isPaid: false,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      // Email'den gelen doğru tutar
      const emailStatement = makeSerializedStatement({
        amount: 2500,
      });

      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      // Tutar farklı olsa da banka+kart+tarih eşleştiği için deduplikasyon yapılmalı
      expect(state.items.length).toBe(1);
      expect(state.items[0].source).toBe('email');
      expect((state.items[0] as any).amount).toBe(2500); // Doğru tutar korunmalı
    });

    it('should not deduplicate when dueDate differs', () => {
      const manualEntry = {
        id: 'manual_diff_date',
        description: 'Akbank - ****1234',
        amount: 2500,
        dueDate: new Date('2026-04-15T09:00:00.000Z').toISOString(), // Farklı ay
        source: 'manual' as const,
        isPaid: false,
        entryType: 'debt' as const,
      };

      const testStore = createStoreWithItems([manualEntry]);

      const emailStatement = makeSerializedStatement({
        dueDate: new Date('2026-03-15T09:00:00.000Z').toISOString(),
      });

      testStore.dispatch({
        type: fetchAndProcessDataThunk.fulfilled.type,
        payload: { items: [emailStatement], totalItems: 1 },
      });

      const state = testStore.getState().data;

      // Tarih farklı olduğu için 2 kayıt kalmalı
      expect(state.items.length).toBe(2);
    });
  });

  describe('updateItemDueDate', () => {
    it('should update the dueDate of an installment', () => {
      const today = new Date();

      const loanEntry: ManualEntry = {
        id: 'loan_date_update',
        description: 'Tarih Test Kredisi',
        amount: 500,
        dueDate: today,
        source: 'manual',
        entryType: 'loan',
        installmentCount: 3,
      };

      store.dispatch(addManualEntry(loanEntry));

      const state = store.getState().data;
      const firstInstallment = state.items.find(i => i.id === 'loan_date_update_installment_1');
      expect(firstInstallment).toBeDefined();

      // Yeni tarih: 2 gün sonrası
      const newDate = new Date(today);
      newDate.setDate(newDate.getDate() + 2);
      const newDateIso = newDate.toISOString();

      store.dispatch(updateItemDueDate({ id: 'loan_date_update_installment_1', dueDate: newDateIso }));

      const updatedState = store.getState().data;
      const updatedItem = updatedState.items.find(i => i.id === 'loan_date_update_installment_1');
      expect(updatedItem).toBeDefined();
      expect(updatedItem!.dueDate).toBe(newDateIso);
    });

    it('should maintain sort order after dueDate update', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // İki ayrı borç ekle
      const entry1: ManualEntry = {
        id: 'sort_test_1',
        description: 'Erken Borç',
        amount: 100,
        dueDate: new Date(today.getTime() + 86400000), // yarın
        source: 'manual',
        entryType: 'debt',
      };

      const entry2: ManualEntry = {
        id: 'sort_test_2',
        description: 'Geç Borç',
        amount: 200,
        dueDate: new Date(today.getTime() + 86400000 * 10), // 10 gün sonra
        source: 'manual',
        entryType: 'debt',
      };

      store.dispatch(addManualEntry(entry1));
      store.dispatch(addManualEntry(entry2));

      // entry1'in tarihini 20 gün sonrasına güncelle (entry2'den sonraya)
      const newDate = new Date(today.getTime() + 86400000 * 20);
      store.dispatch(updateItemDueDate({ id: 'sort_test_1', dueDate: newDate.toISOString() }));

      const state = store.getState().data;
      // En yeniden eskiye sıralı olduğu için entry1 (artık daha geç) ilk sırada olmalı
      expect(state.items[0].id).toBe('sort_test_1');
      expect(state.items[1].id).toBe('sort_test_2');
    });
  });
});
