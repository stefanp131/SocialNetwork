import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type UiState = {
  values: Record<string, unknown>;
};

const initialState: UiState = {
  values: {},
};

const uiStateSlice = createSlice({
  name: 'uiState',
  initialState,
  reducers: {
    setUiValue(state, action: PayloadAction<{ key: string; value: unknown }>) {
      state.values[action.payload.key] = action.payload.value;
    },
    clearUiState(state) {
      state.values = {};
    },
  },
});

export const { setUiValue, clearUiState } = uiStateSlice.actions;
export default uiStateSlice.reducer;
