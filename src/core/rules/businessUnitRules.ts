import type {
  BusinessUnit,
  CreateBusinessUnitInput,
  UpdateBusinessUnitInput,
} from "../types/schema";
import { BusinessRuleError } from "../errors/business-rule-error";

function priorityForQuotaType(quotaType: BusinessUnit["quotaType"]): number {
  if (quotaType === "guaranteed") return 1;
  if (quotaType === "contractual") return 2;
  return 3;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function assertCodeAvailable(
  facilityId: string,
  code: string,
  businessUnits: BusinessUnit[],
  exceptId?: string,
): void {
  const normalizedCode = normalizeCode(code);
  const duplicate = businessUnits.some((unit) =>
    unit.facilityId === facilityId && unit.id !== exceptId && normalizeCode(unit.code) === normalizedCode,
  );
  if (duplicate) throw new BusinessRuleError(`El código "${normalizedCode}" ya está asignado a otra unidad de la instalación`);
}

export function createBusinessUnit(
  input: CreateBusinessUnitInput,
  facilityId: string,
  businessUnits: BusinessUnit[],
  id: string,
): BusinessUnit {
  assertCodeAvailable(facilityId, input.code, businessUnits);
  return {
    id,
    facilityId,
    name: input.name.trim(),
    code: normalizeCode(input.code),
    priorityLevel: priorityForQuotaType(input.quotaType),
    quotaType: input.quotaType,
    defaultQuota: input.defaultQuota,
    isActive: true,
    version: 1,
  };
}

export interface UpdateBusinessUnitParams {
  current: BusinessUnit;
  updates: UpdateBusinessUnitInput;
  businessUnits: BusinessUnit[];
}

export function updateBusinessUnit({ current, updates, businessUnits }: UpdateBusinessUnitParams): BusinessUnit {
  if (current.version !== updates.version) {
    throw new BusinessRuleError("La versión de la unidad cambió desde la última carga; actualiza la lista e inténtalo nuevamente");
  }
  if (!current.isActive) throw new BusinessRuleError("No se puede editar una unidad inactiva");
  assertCodeAvailable(current.facilityId, updates.code, businessUnits, current.id);

  return {
    ...current,
    name: updates.name.trim(),
    code: normalizeCode(updates.code),
    priorityLevel: priorityForQuotaType(updates.quotaType),
    quotaType: updates.quotaType,
    defaultQuota: updates.defaultQuota,
    version: current.version + 1,
  };
}

export function deactivateBusinessUnit(
  current: BusinessUnit,
  expectedVersion: number,
  dependencies: string[],
): BusinessUnit {
  if (current.version !== expectedVersion) {
    throw new BusinessRuleError("La versión de la unidad cambió desde la última carga; actualiza la lista e inténtalo nuevamente");
  }
  if (!current.isActive) throw new BusinessRuleError("La unidad ya está inactiva");
  if (dependencies.length > 0) {
    throw new BusinessRuleError(`No se puede retirar la unidad mientras tenga ${dependencies.join(", ")}`);
  }

  return { ...current, isActive: false, version: current.version + 1 };
}
