import type { User } from "@core/types/schema";
import type { ConfiguredLocalIdentity } from "../../services/local-credential-auth";
import type { AppEnvironment } from "../../types/app-environment";
import { requireD1 } from "../client";

type Bindings = AppEnvironment["Bindings"];

export async function ensureLocalIdentity(bindings: Bindings, identity: ConfiguredLocalIdentity): Promise<User> {
  const database = requireD1(bindings);
  const facility = await database.prepare(
    "SELECT id FROM facilities WHERE is_active = 1 ORDER BY CASE WHEN id = 'fac-default-01' THEN 0 ELSE 1 END, created_at, id LIMIT 1",
  ).first<{ id: string }>();
  const facilityId = facility?.id ?? null;
  const now = new Date().toISOString();
  const userId = `local-${crypto.randomUUID()}`;

  await database.batch([
    database.prepare(
      "INSERT OR IGNORE INTO users (id, username, full_name, role, facility_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(userId, identity.username, identity.fullName, identity.role, facilityId, now),
    database.prepare(
      "UPDATE users SET full_name = ?, role = ?, facility_id = CASE WHEN EXISTS (SELECT 1 FROM facilities WHERE id = users.facility_id AND is_active = 1) THEN users.facility_id ELSE ? END WHERE username = ? COLLATE NOCASE",
    ).bind(identity.fullName, identity.role, facilityId, identity.username),
  ]);

  const row = await database.prepare(
    "SELECT id, username, full_name, role, facility_id, created_at FROM users WHERE username = ? COLLATE NOCASE LIMIT 1",
  ).bind(identity.username).first<{
    id: string;
    username: string;
    full_name: string;
    role: User["role"];
    facility_id: string | null;
    created_at: string;
  }>();
  if (!row) throw new Error("No se pudo crear la identidad local en D1");
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    facilityId: row.facility_id,
    createdAt: row.created_at,
  };
}
