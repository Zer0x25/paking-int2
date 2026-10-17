import type { EventBooking, UpdateEventBookingInput } from "@core/types/schema";

const excludedStatuses = new Set(["cancelled", "completed"]);

function isCommitmentActive(event: EventBooking): boolean {
  return !excludedStatuses.has(event.status);
}

function getInterval(event: EventBooking): { start: number; end: number } {
  return {
    start: Date.parse(event.startTime),
    end: Date.parse(event.endTime),
  };
}

export function validateEventBookingCapacity(
  candidate: EventBooking,
  existingEvents: EventBooking[],
  facilityCapacity: number,
  guaranteedQuota: number,
): void {
  if (!isCommitmentActive(candidate)) return;

  const candidateRange = getInterval(candidate);
  const overlappingEvents = existingEvents.filter((event) => {
    if (event.id === candidate.id || !isCommitmentActive(event)) return false;
    const range = getInterval(event);
    return range.start < candidateRange.end && candidateRange.start < range.end;
  });

  const checkpoints = [
    candidateRange.start,
    ...overlappingEvents
      .map((event) => getInterval(event).start)
      .filter((start) => start > candidateRange.start && start < candidateRange.end),
  ];

  for (const instant of checkpoints) {
    const committed = guaranteedQuota + candidate.reservedSlots + overlappingEvents
      .filter((event) => {
        const range = getInterval(event);
        return range.start <= instant && instant < range.end;
      })
      .reduce((sum, event) => sum + event.reservedSlots, 0);

    if (committed > facilityCapacity) {
      throw new Error(
        `Los compromisos simultáneos (${committed} cupos) superan la capacidad disponible del recinto (${facilityCapacity})`,
      );
    }
  }
}

export interface UpdateEventBookingParams {
  current: EventBooking;
  updates: UpdateEventBookingInput;
  events: EventBooking[];
  facilityCapacity: number;
  guaranteedQuota: number;
}

export function updateEventBooking({
  current,
  updates,
  events,
  facilityCapacity,
  guaranteedQuota,
}: UpdateEventBookingParams): EventBooking {
  if (updates.version !== current.version) {
    throw new Error("La versión de la reserva cambió desde la última carga; actualiza la lista e inténtalo nuevamente");
  }
  if (current.status === "cancelled" || current.status === "completed") {
    throw new Error("La reserva ya no se puede editar porque está cerrada");
  }

  const updated: EventBooking = {
    ...current,
    title: updates.title,
    businessUnitId: updates.businessUnitId,
    reservedSlots: updates.reservedSlots,
    startTime: updates.startTime,
    endTime: updates.endTime,
    version: current.version + 1,
  };

  validateEventBookingCapacity(updated, events, facilityCapacity, guaranteedQuota);
  return updated;
}

export function cancelEventBooking(current: EventBooking, expectedVersion: number): EventBooking {
  if (current.version !== expectedVersion) {
    throw new Error("La versión de la reserva cambió desde la última carga; actualiza la lista e inténtalo nuevamente");
  }
  if (current.status === "cancelled" || current.status === "completed") {
    throw new Error("La reserva ya está cerrada");
  }

  return { ...current, status: "cancelled", version: current.version + 1 };
}

export function isEventVisible(event: EventBooking, currentTime: Date): boolean {
  if (event.status === "cancelled" || event.status === "completed") return false;

  const end = new Date(event.endTime);
  if (!Number.isFinite(end.getTime())) return false;

  const lastVisibleInstant = new Date(end);
  lastVisibleInstant.setDate(lastVisibleInstant.getDate() + 1);
  lastVisibleInstant.setHours(23, 59, 59, 999);
  return currentTime.getTime() <= lastVisibleInstant.getTime();
}
