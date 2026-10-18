import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types/app-environment";

let requestSequence = 0;

function normalizePath(path: string): string {
  return path
    .replace(/^(\/api\/facilities\/)[^/]+/, "$1:facilityId")
    .replace(/^(\/api\/parking-sessions\/)(?!active(?:\/|$)|entry(?:\/|$)|exit(?:\/|$))[^/]+/, "$1:sessionId")
    .replace(/^(\/api\/events\/)[^/]+/, "$1:facilityId");
}

function createRequestId(): string {
  requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `req-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

export async function requestLoggingMiddleware(c: Context<AppEnvironment>, next: Next): Promise<void> {
  const requestId = createRequestId();
  const startedAt = performance.now();
  c.set("requestId", requestId);

  try {
    await next();
  } finally {
    const path = normalizePath(new URL(c.req.url).pathname);
    console.info(JSON.stringify({
      event: "http.request",
      requestId,
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    }));
  }
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b(password|passwd|secret|token|authorization|cookie|session(?:id)?|plate|license[_-]?plate|user(?:name|id)?|facilityid)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[redacted]")
    .replace(/\b[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}\b/gi, "[redacted-plate]")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "[redacted-id]");
}

export function logServerError(c: Context<AppEnvironment>, error: unknown, status = 500): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof SyntaxError
    ? "Request parsing failed"
    : error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack?.split("\n").slice(1).join("\n") : undefined;

  console.error(JSON.stringify({
    event: "server.error",
    requestId: c.get("requestId") || "req-unassigned",
    method: c.req.method,
    path: normalizePath(new URL(c.req.url).pathname),
    status,
    error: {
      name: redactDiagnosticText(name),
      message: redactDiagnosticText(message),
      ...(stack ? { stack: redactDiagnosticText(stack) } : {}),
    },
  }));
}
