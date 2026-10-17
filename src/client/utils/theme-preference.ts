export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = Exclude<ThemePreference, "system">;

export const THEME_PREFERENCE_STORAGE_KEY = "smart-parking-theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ThemeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readThemePreference(storage: ThemeStorage | null = browserStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function writeThemePreference(preference: ThemePreference, storage: ThemeStorage | null = browserStorage()): void {
  if (!isThemePreference(preference)) return;
  try {
    storage?.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // The in-memory selection still applies when browser storage is blocked.
  }
}

export function resolveEffectiveTheme(preference: ThemePreference, systemPrefersDark: boolean): EffectiveTheme {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}

export function getSystemPrefersDark(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function subscribeToSystemTheme(
  onChange: (prefersDark: boolean) => void,
  queryList?: MediaQueryList
): () => void {
  let mediaQuery: MediaQueryList | undefined = queryList;
  try {
    if (!mediaQuery && typeof window !== "undefined") mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return () => undefined;
  }
  if (!mediaQuery) return () => undefined;

  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery?.removeEventListener("change", listener);
  }

  mediaQuery.addListener(listener);
  return () => mediaQuery?.removeListener(listener);
}
