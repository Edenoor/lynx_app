import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useState,
} from "react";

import { OnboardingAction, OnboardingState } from "./types";

import {
  saveOnboardingCompleted,
  loadOnboardingCompleted,
  clearOnboardingCompleted,
} from "./OnboardingPersistence";

import { clearOnboardingDir } from "./OnboardingStorage";
import { UserContext } from "../context/UserContext";

const initialState: OnboardingState = {
  acceptedTerms: false,
  files: {},
  completedLocal: false,
  vehicle: { type: null, brand: null, model: null, plate: null },
};

function reducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "ACCEPT_TERMS":
      return { ...state, acceptedTerms: action.value };

    case "SET_FILE":
      return { ...state, files: { ...state.files, [action.key]: action.file } };

    case "SET_COMPLETED_LOCAL":
      return { ...state, completedLocal: action.value };

    case "SET_VEHICLE":
      return { ...state, vehicle: action.value };

    case "RESET":
      void clearOnboardingDir();
      return { ...initialState };

    default:
      return state;
  }
}

type Ctx = {
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
  loading: boolean;
  userKey: string | null;
  resetForCurrentUser: () => Promise<void>;
};

const OnboardingCtx = createContext<Ctx | null>(null);

function pickUserKey(user: any): string | null {
  const id =
    typeof user?.id === "string"
      ? user.id.trim()
      : String(user?.id ?? "").trim();

  if (id) return id;

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email) return email;

  const username =
    typeof user?.username === "string" ? user.username.trim() : "";
  if (username) return username;

  return null;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(true);

  const { user } = useContext(UserContext);
  const userKey = pickUserKey(user);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);

      dispatch({ type: "RESET" });

      if (!userKey) {
        if (!cancelled) setLoading(false);
        return;
      }

      const completed = await loadOnboardingCompleted(userKey);

      if (cancelled) return;

      dispatch({ type: "SET_COMPLETED_LOCAL", value: completed });
      setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [userKey]);

  useEffect(() => {
    if (loading) return;
    if (!userKey) return;

    saveOnboardingCompleted(userKey, state.completedLocal);
  }, [state.completedLocal, userKey, loading]);

  const resetForCurrentUser = async () => {
    void clearOnboardingDir();
    dispatch({ type: "RESET" });

    if (userKey) {
      await clearOnboardingCompleted(userKey);
    }
  };

  const value = useMemo(
    () => ({
      state,
      dispatch,
      loading,
      userKey,
      resetForCurrentUser,
    }),
    [state, loading, userKey]
  );

  if (loading) return null;

  return (
    <OnboardingCtx.Provider value={value}>{children}</OnboardingCtx.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingCtx);

  if (!ctx) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }

  return ctx;
}