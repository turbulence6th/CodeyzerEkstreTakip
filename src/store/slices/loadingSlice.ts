import { createSlice } from '@reduxjs/toolkit';

interface LoadingState {
  isActive: boolean;
}

const initialState: LoadingState = {
  isActive: false,
};

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    startGlobalLoading: (state) => {
      state.isActive = true;
    },
    stopGlobalLoading: (state) => {
      state.isActive = false;
    },
  },
});

export const { startGlobalLoading, stopGlobalLoading } = loadingSlice.actions;

export default loadingSlice.reducer; 