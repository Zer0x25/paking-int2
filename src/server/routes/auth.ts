import { Hono } from "hono";
import { z } from "zod";
import { signJwt } from "../middleware/auth";
import type { UserRole } from "@core/types/schema";
import type { AppEnvironment } from "../types/app-environment";

export const authRoutes = new Hono<AppEnvironment>();

export interface SeedUser {
  id: string;
  username: string;
  passwordPlainText: string;
  fullName: string;
  role: UserRole;
  facilityId: string;
}

export const seedUsers: SeedUser[] = [
  {
    id: "user-admin-01",
    username: "admin",
    passwordPlainText: "admin123",
    fullName: "Administrador del Sistema",
    role: "admin",
    facilityId: "fac-default-01",
  },
  {
    id: "user-op-01",
    username: "operador",
    passwordPlainText: "operador123",
    fullName: "Operador de Garita Principal",
    role: "operator",
    facilityId: "fac-default-01",
  },
];

export async function authenticateUser(username: string, password: string):Promise<SeedUser | null> {
  const user = seedUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.passwordPlainText === password
  );
  return user || null;
}

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/login
authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Credenciales inválidas" }, 400);
  }

  const user = await authenticateUser(parsed.data.username, parsed.data.password);
  if (!user) {
    return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
  }

  const secret = c.env?.JWT_SECRET || "supersecret_jwt_key_local_development";
  const token = await signJwt(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      facilityId: user.facilityId,
    },
    secret,
    86400
  );

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      facilityId: user.facilityId,
    },
  });
});
