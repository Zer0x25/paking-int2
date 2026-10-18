export const SESSION_EXPIRED_EVENT = "smart-parking:session-expired";

let pageClientId: string | undefined;

function createPageClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getPageClientId(): string {
  pageClientId ??= createPageClientId();
  return pageClientId;
}

export function getTokenExpirationMs(token: string): number | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function signalExpiredSession(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = typeof localStorage === "undefined" ? null : localStorage.getItem("auth_token");
  if (!token) {
    signalExpiredSession();
    throw new Error("No hay una sesión autenticada");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Client-Id", getPageClientId());
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) signalExpiredSession();
  return response;
}
