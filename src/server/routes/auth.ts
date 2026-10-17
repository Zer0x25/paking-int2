import { Hono } from "hono";
import { z } from "zod";
import { signJwt } from "../middleware/auth";
import type { AppEnvironment } from "../types/app-environment";
import {
  authenticateLocalCredential,
  LocalCredentialConfigurationError,
  readLocalCredentialConfiguration,
} from "../services/local-credential-auth";
import { ensureLocalIdentity } from "../db/repositories/user-repository";

export const authRoutes = new Hono<AppEnvironment>();

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/login
authRoutes.post("/login", async (c) => {
  const parsed = LoginSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Credenciales inválidas" }, 400);

  try {
    const configuration = readLocalCredentialConfiguration(c.env);
    const identity = authenticateLocalCredential(configuration, parsed.data.username, parsed.data.password);
    if (!identity) return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    const user = await ensureLocalIdentity(c.env, identity);
    const token = await signJwt({
      userId: user.id,
      username: user.username,
      role: user.role,
      facilityId: user.facilityId,
    }, configuration.jwtSecret, 86400);
    return c.json({ token, user });
  } catch (error) {
    if (error instanceof LocalCredentialConfigurationError) return c.json({ error: error.message }, 500);
    const message = error instanceof Error ? error.message : "Error interno al autenticar";
    return c.json({ error: message }, 500);
  }
});
