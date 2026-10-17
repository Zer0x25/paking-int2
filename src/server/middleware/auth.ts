import type { Context, Next } from "hono";
import type { UserRole } from "@core/types/schema";
import type { AppEnvironment } from "../types/app-environment";

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  facilityId?: string | null;
  exp: number;
}

// Simple deterministic HMAC-SHA256 JWT implementation via WebCrypto
async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signJwt(payload: Omit<TokenPayload, "exp">, secret: string, expiresInSeconds = 86400): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const enc = new TextEncoder();
  const encodedHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJwt(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const enc = new TextEncoder();
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const signature = base64UrlDecode(sigB64);

    const key = await getKey(secret);
    const isValid = await crypto.subtle.verify("HMAC", key, signature as unknown as BufferSource, enc.encode(dataToVerify));
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as TokenPayload;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export function authMiddleware(requiredRole?: UserRole) {
  return async (c: Context<AppEnvironment>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Token de autorización requerido" }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env?.JWT_SECRET || "supersecret_jwt_key_local_development";
    const payload = await verifyJwt(token, secret);

    if (!payload) {
      return c.json({ error: "Token inválido o expirado" }, 401);
    }

    if (requiredRole && payload.role !== requiredRole && payload.role !== "admin") {
      return c.json({ error: "Permisos insuficientes para esta operación" }, 403);
    }

    c.set("user", payload);
    await next();
  };
}
