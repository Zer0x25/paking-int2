import React from "react";
import { useTheme } from "./ThemeProvider";

export const ThemeSelector: React.FC = () => {
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-selector">
      <label htmlFor="theme-preference">Tema visual</label>
      <select
        id="theme-preference"
        name="theme-preference"
        value={preference}
        onChange={(event) => setPreference(event.target.value as "system" | "light" | "dark")}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </div>
  );
};
