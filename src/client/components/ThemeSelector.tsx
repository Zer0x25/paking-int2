import React from "react";
import { useTheme } from "./ThemeProvider";

export const ThemeSelector: React.FC = () => {
  const { effectiveTheme, setPreference } = useTheme();
  const nextTheme = effectiveTheme === "dark" ? "light" : "dark";
  const currentThemeLabel = effectiveTheme === "dark" ? "oscuro" : "claro";
  const nextThemeLabel = nextTheme === "dark" ? "oscuro" : "claro";

  return (
    <div className="theme-selector">
      <button
        type="button"
        className="theme-toggle"
        aria-label={`Tema actual ${currentThemeLabel}. Cambiar a tema ${nextThemeLabel}`}
        title={`Tema ${currentThemeLabel}. Cambiar a ${nextThemeLabel}`}
        onClick={() => setPreference(nextTheme)}
      >
        {effectiveTheme === "dark" ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />
          </svg>
        )}
      </button>
    </div>
  );
};
