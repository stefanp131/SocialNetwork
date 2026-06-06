import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type UserProfile = {
  name: string;
  profileImage: string;
};

type AppState = {
  token: string | null;
  username: string;
  currentUserProfile: UserProfile;
  unreadMessages: number;
};

const initialState: AppState = {
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username') || '',
  currentUserProfile: { name: '', profileImage: '' },
  unreadMessages: 0,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
    setUsername(state, action: PayloadAction<string>) {
      state.username = action.payload;
    },
    setCurrentUserProfile(state, action: PayloadAction<UserProfile>) {
      state.currentUserProfile = action.payload;
    },
    setUnreadMessages(state, action: PayloadAction<number>) {
      state.unreadMessages = action.payload;
    },
    clearSession(state) {
      state.token = null;
      state.username = '';
      state.currentUserProfile = { name: '', profileImage: '' };
      state.unreadMessages = 0;
    },
  },
});

export const {
  setToken,
  setUsername,
  setCurrentUserProfile,
  setUnreadMessages,
  clearSession,
} = appSlice.actions;

export default appSlice.reducer;
