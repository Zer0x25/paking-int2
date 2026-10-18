import { z } from "zod";

export const FacilityChangeScopeSchema = z.enum(["parking", "configuration"]);
export type FacilityChangeScope = z.infer<typeof FacilityChangeScopeSchema>;

export const FacilityChangedEventSchema = z.object({
  schemaVersion: z.literal(2),
  type: z.literal("facility.changed"),
  facilityId: z.string().min(1),
  scope: FacilityChangeScopeSchema,
  changeId: z.string().uuid(),
  sourceClientId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
}).strict();

export type FacilityChangedEvent = z.infer<typeof FacilityChangedEventSchema>;
