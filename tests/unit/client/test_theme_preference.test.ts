import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_PREFERENCE_STORAGE_KEY,
  getSystemPrefersDark,
  readThemePreference,
  resolveEffectiveTheme,
  subscribeToSystemTheme,
  writeThemePreference,
} from "@client/utils/theme-preference";

const createStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme preference", () => {
  it("defaults to system and validates stored values", () => {
    expect(readThemePreference(createStorage())).toBe("system");
    expect(readThemePreference(createStorage({ [THEME_PREFERENCE_STORAGE_KEY]: "light" }))).toBe("light");
    expect(readThemePreference(createStorage({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(readThemePreference(createStorage({ [THEME_PREFERENCE_STORAGE_KEY]: "neon" }))).toBe("system");
  });

  it("resolves explicit choices and follows the system only in system mode", () => {
    expect(resolveEffectiveTheme("system", false)).toBe("light");
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
  });

  it("persists explicit selection and tolerates unavailable storage", () => {
    const storage = createStorage();
    writeThemePreference("light", storage);
    expect(storage.setItem).toHaveBeenCalledWith(THEME_PREFERENCE_STORAGE_KEY, "light");

    const failingStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readThemePreference(failingStorage)).toBe("system");
    expect(() => writeThemePreference("dark", failingStorage)).not.toThrow();
  });

  it("falls back when browser storage cannot be accessed", () => {
    const windowWithBlockedStorage = Object.defineProperty({}, "localStorage", {
      get: () => { throw new Error("blocked"); },
    });
    vi.stubGlobal("window", windowWithBlockedStorage);

    expect(readThemePreference()).toBe("system");
    expect(() => writeThemePreference("dark")).not.toThrow();
    expect(readThemePreference(null)).toBe("system");
  });

  it("falls back to light when the system media query is unavailable", () => {
    vi.stubGlobal("window", {
      matchMedia: () => { throw new Error("unavailable"); },
    });

    expect(getSystemPrefersDark()).toBe(false);
    expect(() => subscribeToSystemTheme(vi.fn())()).not.toThrow();
  });

  it("notifies callers about system preference changes and can unsubscribe", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQuery = {
      addEventListener: vi.fn((_type: string, callback: (event: MediaQueryListEvent) => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    const onChange = vi.fn();
    const unsubscribe = subscribeToSystemTheme(onChange, mediaQuery);

    listener?.({ matches: true } as MediaQueryListEvent);
    expect(onChange).toHaveBeenCalledWith(true);
    unsubscribe();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("supports older browsers with addListener and removeListener", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQuery = {
      addListener: vi.fn((callback: (event: MediaQueryListEvent) => void) => { listener = callback; }),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
    const onChange = vi.fn();
    const unsubscribe = subscribeToSystemTheme(onChange, mediaQuery);

    listener?.({ matches: false } as MediaQueryListEvent);
    expect(onChange).toHaveBeenCalledWith(false);
    unsubscribe();
    expect(mediaQuery.removeListener).toHaveBeenCalledWith(listener);
  });
});
