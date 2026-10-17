import { normalizeLicensePlate, validateEntryAttempt } from "@core/models/parking-session";
import type { ParkingSession, SyncMutation } from "@core/types/schema";

export function getLocalEntryValidationError(
  licensePlate: string,
  facilityId: string,
  localSessions: ParkingSession[]
): string | null {
  const validation = validateEntryAttempt(licensePlate, facilityId, localSessions);
  return validation.isValid ? null : validation.error || "No se pudo validar la patente localmente";
}

export function findStaleActiveSessionIds({
  facilityId,
  remoteSessions,
  localSessions,
  pendingMutations,
}: {
  facilityId: string;
  remoteSessions: ParkingSession[];
  localSessions: ParkingSession[];
  pendingMutations: SyncMutation[];
}): string[] {
  const remoteActiveIds = new Set(
    remoteSessions
      .filter((session) => session.facilityId === facilityId && session.status === "active")
      .map((session) => session.id)
  );
  const pendingLocalIds = new Set(
    pendingMutations.flatMap((mutation) => {
      if (mutation.type === "VEHICLE_ENTRY") return [mutation.id];
      if (mutation.type === "VEHICLE_PLATE_UPDATE") return [mutation.payload.sessionId];
      return [];
    })
  );

  return localSessions
    .filter((session) =>
      session.facilityId === facilityId &&
      session.status === "active" &&
      !remoteActiveIds.has(session.id) &&
      !pendingLocalIds.has(session.id)
    )
    .map((session) => session.id);
}

export function mergeActiveParkingSessions({
  facilityId,
  remoteSessions,
  localSessions,
  pendingMutations,
}: {
  facilityId: string;
  remoteSessions: ParkingSession[];
  localSessions: ParkingSession[];
  pendingMutations: SyncMutation[];
}): ParkingSession[] {
  const localById = new Map(localSessions.map((session) => [session.id, session]));
  const pendingExitIds = new Set(
    pendingMutations.flatMap((mutation) =>
      mutation.type === "VEHICLE_EXIT" && mutation.payload.sessionId
        ? [mutation.payload.sessionId]
        : []
    )
  );
  const pendingEntryIds = new Set(
    pendingMutations.flatMap((mutation) =>
      mutation.type === "VEHICLE_ENTRY" ? [mutation.id] : []
    )
  );
  const pendingPlateIds = new Set(
    pendingMutations.flatMap((mutation) =>
      mutation.type === "VEHICLE_PLATE_UPDATE" ? [mutation.payload.sessionId] : []
    )
  );

  const merged = new Map<string, ParkingSession>();
  for (const session of remoteSessions) {
    if (session.facilityId === facilityId && session.status === "active" && !pendingExitIds.has(session.id)) {
      merged.set(session.id, session);
    }
  }

  for (const localSession of localSessions) {
    if (localSession.facilityId !== facilityId) continue;
    if (localSession.status === "completed") {
      if (pendingExitIds.has(localSession.id)) merged.delete(localSession.id);
      continue;
    }

    if (pendingEntryIds.has(localSession.id) && !merged.has(localSession.id)) {
      merged.set(localSession.id, localSession);
      continue;
    }
    if (pendingPlateIds.has(localSession.id)) {
      const existing = merged.get(localSession.id);
      if (existing) merged.set(localSession.id, { ...existing, licensePlate: localSession.licensePlate, version: localSession.version });
    }
  }

  // Older offline exits contain only a plate, so remove their matching server row until sync resolves.
  const pendingExitPlates = pendingMutations.flatMap((mutation) =>
    mutation.type === "VEHICLE_EXIT" && !mutation.payload.sessionId && mutation.payload.licensePlate
      ? [normalizeLicensePlate(mutation.payload.licensePlate)]
      : []
  );
  for (const [id, session] of merged) {
    if (pendingExitPlates.includes(normalizeLicensePlate(session.licensePlate))) merged.delete(id);
  }

  return [...merged.values()].sort((a, b) => b.entryTime.localeCompare(a.entryTime));
}
