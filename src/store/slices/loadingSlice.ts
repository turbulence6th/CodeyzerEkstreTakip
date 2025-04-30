import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LoadingState {
  isActive: boolean;
  message: string | null;
}

const initialState: LoadingState = {
  isActive: false,
  message: null,
};

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    startGlobalLoading: (state, action: PayloadAction<string | undefined>) => {
      state.isActive = true;
      state.message = action.payload || 'Lütfen bekleyin...';
    },
    stopGlobalLoading: (state) => {
      state.isActive = false;
      state.message = null;
    },
  },
});

export const { startGlobalLoading, stopGlobalLoading } = loadingSlice.actions;

export default loadingSlice.reducer; 