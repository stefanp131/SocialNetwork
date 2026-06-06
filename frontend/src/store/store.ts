import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import uiReducer from './uiStateSlice';

export const store = configureStore({
  reducer: {
    app: appReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
