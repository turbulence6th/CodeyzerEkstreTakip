import { configureStore } from '@reduxjs/toolkit';
import dataReducer, {
  addManualEntry,
  togglePaidStatus,
  selectAllDataWithDates,
  selectTotalDebt,
} from '../dataSlice';
import type { ManualEntry } from '../../../types/manual-entry.types';
import type { ParsedStatement } from '../../../services/sms-parsing/types';

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
    it('should calculate total debt including unpaid installments within 1 month', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Kredi ekle
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

      // Tüm taksitler borç hesaplamasına dahil olmalı (3 * 500 = 1500)
      const state = store.getState() as any; // Test store'dan RootState'e cast
      const totalDebt = selectTotalDebt(state);
      expect(totalDebt).toBe(1500);
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
});
