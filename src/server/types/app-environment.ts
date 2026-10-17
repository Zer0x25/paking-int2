import type { UserRole } from "@core/types/schema";

export interface AppEnvironment {
  Bindings: {
    PARKING_DB?: unknown;
    JWT_SECRET?: string;
    ENVIRONMENT?: string;
  };
  Variables: {
    user: {
      userId: string;
      username: string;
      role: UserRole;
      facilityId?: string | null;
      exp: number;
    };
  };
}
