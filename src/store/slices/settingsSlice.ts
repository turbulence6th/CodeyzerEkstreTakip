import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

interface SettingsState {
  rentAmount: number | null;
  rentPaymentDay: number | null;
  lastRentEntryMonth: string | null; // YYYY-MM formatı
}

const initialState: SettingsState = {
  rentAmount: null,
  rentPaymentDay: null,
  lastRentEntryMonth: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setRentSettings: (state, action: PayloadAction<{ amount: number; paymentDay: number }>) => {
      state.rentAmount = action.payload.amount;
      state.rentPaymentDay = action.payload.paymentDay;
    },
    clearRentSettings: (state) => {
      state.rentAmount = null;
      state.rentPaymentDay = null;
    },
    setLastRentEntryMonth: (state, action: PayloadAction<string>) => {
      state.lastRentEntryMonth = action.payload;
    },
  },
});

export const { setRentSettings, clearRentSettings, setLastRentEntryMonth } = settingsSlice.actions;

export const selectRentSettings = (state: RootState) => state.settings;

export default settingsSlice.reducer;
