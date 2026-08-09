import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, darkColors, lightColors } from "../theme";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme_mode";

interface ThemeContextValue {
  colors: Colors;
  mode: ThemeMode;
  scheme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "system" || stored === "light" || stored === "dark") {
          setModeState(stored);
        }
      } catch {
        // Fall back to system mode.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const scheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const colors = scheme === "dark" ? darkColors : lightColors;

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo(
    () => ({ colors, mode, scheme, setMode }),
    [colors, mode, scheme]
  );

  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
