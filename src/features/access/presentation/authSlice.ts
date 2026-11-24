import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthSession } from "../domain/auth";

export type AuthPhase =
  | "loading"
  | "signed_out"
  | "signed_in"
  | "error"
  | "unconfigured";

export interface AuthState {
  phase: AuthPhase;
  session: AuthSession | null;
  error: string | null;
}

const initialState: AuthState = {
  phase: "loading",
  session: null,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoading(state) {
      state.phase = "loading";
      state.error = null;
    },
    setSession(state, action: PayloadAction<AuthSession | null>) {
      state.phase = action.payload ? "signed_in" : "signed_out";
      state.session = action.payload;
      state.error = null;
    },
    setAuthError(state, action: PayloadAction<string>) {
      state.phase = "error";
      state.session = null;
      state.error = action.payload;
    },
    setUnconfigured(state, action: PayloadAction<string>) {
      state.phase = "unconfigured";
      state.session = null;
      state.error = action.payload;
    },
  },
});

export const { setAuthError, setLoading, setSession, setUnconfigured } =
  authSlice.actions;
export default authSlice.reducer;
