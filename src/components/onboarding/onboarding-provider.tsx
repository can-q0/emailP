"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

interface OnboardingState {
  isLoaded: boolean;
  onboardingCompleted: boolean;
  completedTours: string[];
  isDemoMode: boolean;
}

interface OnboardingContextValue extends OnboardingState {
  showWelcome: boolean;
  setShowWelcome: (v: boolean) => void;
  showGoLive: boolean;
  setShowGoLive: (v: boolean) => void;
  activeTour: string | null;
  startTour: (tourId: string) => void;
  completeTour: (tourId: string) => void;
  cancelTour: () => void;
  startDemoMode: () => Promise<void>;
  startTourOnly: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  goLive: (cleanDemo: boolean) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  isRestart: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [state, setState] = useState<OnboardingState>({
    isLoaded: false,
    onboardingCompleted: true, // default to true to prevent flash
    completedTours: [],
    isDemoMode: false,
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [isRestart, setIsRestart] = useState(false);

  // Fetch onboarding state
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        const completed = data.onboardingCompleted ?? false;
        const tours: string[] = (() => {
          try {
            return JSON.parse(data.completedTours || "[]");
          } catch {
            return [];
          }
        })();

        setState({
          isLoaded: true,
          onboardingCompleted: completed,
          completedTours: tours,
          isDemoMode: data.isDemoMode ?? false,
        });

        // Show welcome wizard if not yet onboarded, then immediately mark as shown
        if (!completed) {
          setShowWelcome(true);
          // Mark as completed in DB so refresh won't show it again
          fetch("/api/onboarding", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingCompleted: true }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        setState((s) => ({ ...s, isLoaded: true }));
      });
  }, [status]);

  const patchOnboarding = useCallback(async (data: Record<string, unknown>) => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, []);

  const startTour = useCallback((tourId: string) => {
    setActiveTour(tourId);
  }, []);

  const completeTour = useCallback(
    async (tourId: string) => {
      setActiveTour(null);
      const newTours = [...new Set([...state.completedTours, tourId])];
      setState((s) => ({ ...s, completedTours: newTours }));
      await patchOnboarding({ completedTours: JSON.stringify(newTours) });

      // Show Go Live modal after dashboard tour if in demo mode
      if (tourId === "dashboard" && state.isDemoMode) {
        setTimeout(() => setShowGoLive(true), 300);
      }
    },
    [state.completedTours, state.isDemoMode, patchOnboarding]
  );

  const cancelTour = useCallback(() => {
    setActiveTour(null);
  }, []);

  const startDemoMode = useCallback(async () => {
    setShowWelcome(false);

    // Seed demo data
    try {
      await fetch("/api/onboarding/seed-demo", { method: "POST" });
    } catch {
      // Demo data seeding is best-effort
    }

    setState((s) => ({ ...s, isDemoMode: true, onboardingCompleted: true }));
    await patchOnboarding({ isDemoMode: true, onboardingCompleted: true });

    // Start the dashboard tour after a short delay for page to render
    setTimeout(() => setActiveTour("dashboard"), 500);
  }, [patchOnboarding]);

  const startTourOnly = useCallback(async () => {
    setShowWelcome(false);
    setState((s) => ({ ...s, onboardingCompleted: true }));
    await patchOnboarding({ onboardingCompleted: true });
    setTimeout(() => setActiveTour("dashboard"), 500);
  }, [patchOnboarding]);

  const completeOnboarding = useCallback(async () => {
    setState((s) => ({ ...s, onboardingCompleted: true }));
    await patchOnboarding({ onboardingCompleted: true });
  }, [patchOnboarding]);

  const skipOnboarding = useCallback(async () => {
    setShowWelcome(false);
    setState((s) => ({ ...s, onboardingCompleted: true }));
    await patchOnboarding({ onboardingCompleted: true });
  }, [patchOnboarding]);

  const goLive = useCallback(async (cleanDemo: boolean) => {
    if (cleanDemo) {
      await fetch("/api/onboarding/go-live", { method: "POST" });
    } else {
      await patchOnboarding({ isDemoMode: false });
    }
    setState((s) => ({ ...s, isDemoMode: false }));
    setShowGoLive(false);
  }, [patchOnboarding]);

  const resetOnboarding = useCallback(async () => {
    setState((s) => ({
      ...s,
      onboardingCompleted: false,
      completedTours: [],
    }));
    await patchOnboarding({
      onboardingCompleted: false,
      completedTours: JSON.stringify([]),
    });
    setIsRestart(true);
    setShowWelcome(true);
  }, [patchOnboarding]);

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        showWelcome,
        setShowWelcome,
        showGoLive,
        setShowGoLive,
        activeTour,
        startTour,
        completeTour,
        cancelTour,
        startDemoMode,
        startTourOnly,
        completeOnboarding,
        skipOnboarding,
        goLive,
        resetOnboarding,
        isRestart,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
