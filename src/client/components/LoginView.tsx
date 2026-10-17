import React, { useState } from "react";
import type { User } from "@core/types/schema";
import { ThemeSelector } from "./ThemeSelector";

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (user: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch {
      setError("No se pudo conectar al servidor de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "75vh",
      }}
    >
      <div className="glass-panel login-card" style={{ width: "100%", maxWidth: "420px", padding: "2.5rem" }}>
        <div className="login-toolbar"><ThemeSelector /></div>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 className="brand-title" style={{ justifyContent: "center", fontSize: "1.75rem", marginBottom: "0.5rem" }}>
            Smart Parking
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Sistema Inteligente de Gestión de Estacionamientos
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="Usuario local"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "1rem" }}
          >
            {loading ? "Iniciando sesión..." : "Ingresar"}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "var(--color-danger-surface)",
              color: "var(--color-danger)",
              borderRadius: "8px",
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

      </div>
    </div>
  );
};
