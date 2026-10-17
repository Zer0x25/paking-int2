import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getSystemPrefersDark,
  readThemePreference,
  resolveEffectiveTheme,
  subscribeToSystemTheme,
  writeThemePreference,
  type EffectiveTheme,
  type ThemePreference,
} from "../utils/theme-preference";

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const effectiveTheme = resolveEffectiveTheme(preference, systemPrefersDark);

  useEffect(() => subscribeToSystemTheme(setSystemPrefersDark), []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = effectiveTheme === "dark" ? "#0b1020" : "#f5f7fb";
  }, [effectiveTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    effectiveTheme,
    setPreference(nextPreference) {
      writeThemePreference(nextPreference);
      setPreferenceState(nextPreference);
    },
  }), [effectiveTheme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme debe utilizarse dentro de ThemeProvider");
  return value;
}
