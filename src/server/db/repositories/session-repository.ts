import type { ParkingSession } from "@core/types/schema";
import type { AppD1Database, AppEnvironment } from "../../types/app-environment";
import { requireD1 } from "../client";
import { createAuditStatement } from "./audit-repository";
import { parkingSessionFromRow, type ParkingSessionRow } from "./row-mappers";
import {
  commitFacilityMutation,
  insertIdempotentMutation,
  insertWhenFacilityVersionMatches,
  updateWhenFacilityVersionMatches,
} from "./write-transaction";

type Bindings = AppEnvironment["Bindings"];
type Actor = { userId: string };

function sessionColumns(): string {
  return "id, facility_id, business_unit_id, space_category_id, parking_area_id, license_plate, entry_time, exit_time, status, duration_minutes, operator_user_id, device_id, version";
}

function sessionValues(session: ParkingSession): unknown[] {
  return [session.id, session.facilityId, session.businessUnitId, session.spaceCategoryId,
    session.parkingAreaId ?? null, session.licensePlate, session.entryTime, session.exitTime,
    session.status, session.durationMinutes, session.operatorUserId, session.deviceId, session.version];
}

function createSessionStatement(database: AppD1Database, session: ParkingSession, nextFacilityVersion: number) {
  return insertWhenFacilityVersionMatches(database, "parking_sessions",
    ["id", "facility_id", "business_unit_id", "space_category_id", "parking_area_id", "license_plate", "entry_time", "exit_time", "status", "duration_minutes", "operator_user_id", "device_id", "version"],
    sessionValues(session), session.facilityId, nextFacilityVersion);
}

function updateSessionStatement(
  database: AppD1Database,
  session: ParkingSession,
  expectedVersion: number,
  nextFacilityVersion: number,
) {
  return updateWhenFacilityVersionMatches(database, "parking_sessions",
    ["business_unit_id = ?", "space_category_id = ?", "parking_area_id = ?", "license_plate = ?", "entry_time = ?", "exit_time = ?", "status = ?", "duration_minutes = ?", "operator_user_id = ?", "device_id = ?", "version = ?"],
    [session.businessUnitId, session.spaceCategoryId, session.parkingAreaId ?? null, session.licensePlate, session.entryTime,
      session.exitTime, session.status, session.durationMinutes, session.operatorUserId, session.deviceId, session.version],
    "id = ? AND facility_id = ? AND version = ? AND status = 'active'", [session.id, session.facilityId, expectedVersion],
    session.facilityId, nextFacilityVersion);
}

export async function listActiveSessions(bindings: Bindings, facilityId: string): Promise<ParkingSession[]> {
  const result = await requireD1(bindings).prepare(
    `SELECT ${sessionColumns()} FROM parking_sessions WHERE facility_id = ? AND status = 'active' ORDER BY entry_time DESC`,
  ).bind(facilityId).all<ParkingSessionRow>();
  return result.results.map(parkingSessionFromRow);
}

export async function getSession(bindings: Bindings, facilityId: string, sessionId: string): Promise<ParkingSession | null> {
  const row = await requireD1(bindings).prepare(
    `SELECT ${sessionColumns()} FROM parking_sessions WHERE facility_id = ? AND id = ? LIMIT 1`,
  ).bind(facilityId, sessionId).first<ParkingSessionRow>();
  return row ? parkingSessionFromRow(row) : null;
}

export async function findActiveSessionByPlate(bindings: Bindings, facilityId: string, licensePlate: string): Promise<ParkingSession | null> {
  const row = await requireD1(bindings).prepare(
    `SELECT ${sessionColumns()} FROM parking_sessions WHERE facility_id = ? AND license_plate = ? AND status = 'active' LIMIT 1`,
  ).bind(facilityId, licensePlate).first<ParkingSessionRow>();
  return row ? parkingSessionFromRow(row) : null;
}

export async function createSessionRecord(
  bindings: Bindings,
  input: { session: ParkingSession; facilityVersion: number; actor: Actor; mutation?: { fingerprint: string; result: unknown; processedAt: string } },
): Promise<void> {
  const database = requireD1(bindings);
  const { session, facilityVersion, actor, mutation } = input;
  const nextVersion = facilityVersion + 1;
  const statements = [];
  if (mutation) statements.push(insertIdempotentMutation(database, {
    id: session.id,
    facilityId: session.facilityId,
    mutationType: "VEHICLE_ENTRY",
    payloadFingerprint: mutation.fingerprint,
    result: mutation.result,
    processedAt: mutation.processedAt,
  }, nextVersion));
  statements.push(createSessionStatement(database, session, nextVersion));
  statements.push(createAuditStatement(database, {
    userId: actor.userId,
    facilityId: session.facilityId,
    action: "created",
    entityType: "parking_session",
    entityId: session.id,
    details: { after: session },
    mutationId: mutation ? session.id : null,
    createdAt: session.entryTime,
  }, nextVersion));
  await commitFacilityMutation(database, {
    facilityId: session.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: session.entryTime,
    statements,
  });
}

export async function updateSessionRecord(
  bindings: Bindings,
  input: {
    session: ParkingSession;
    before: ParkingSession;
    expectedSessionVersion: number;
    facilityVersion: number;
    actor: Actor;
    action: "exited" | "plate_updated";
    mutation?: { id: string; type: string; fingerprint: string; result: unknown; processedAt: string };
  },
): Promise<void> {
  const database = requireD1(bindings);
  const { session, before, expectedSessionVersion, facilityVersion, actor, action, mutation } = input;
  const nextVersion = facilityVersion + 1;
  const statements = [];
  if (mutation) statements.push(insertIdempotentMutation(database, {
    id: mutation.id,
    facilityId: session.facilityId,
    mutationType: mutation.type,
    payloadFingerprint: mutation.fingerprint,
    result: mutation.result,
    processedAt: mutation.processedAt,
  }, nextVersion));
  statements.push(updateSessionStatement(database, session, expectedSessionVersion, nextVersion));
  statements.push(createAuditStatement(database, {
    userId: actor.userId,
    facilityId: session.facilityId,
    action,
    entityType: "parking_session",
    entityId: session.id,
    details: { before, after: session },
    mutationId: mutation?.id ?? null,
    createdAt: session.exitTime ?? new Date().toISOString(),
  }, nextVersion));
  await commitFacilityMutation(database, {
    facilityId: session.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: session.exitTime ?? new Date().toISOString(),
    preconditionSql: "EXISTS (SELECT 1 FROM parking_sessions WHERE id = ? AND facility_id = ? AND version = ? AND status = 'active')",
    preconditionValues: [session.id, session.facilityId, expectedSessionVersion],
    statements,
  });
}
