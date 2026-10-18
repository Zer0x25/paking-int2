import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { parkingRoutes } from "./routes/parking";
import { dashboardRoutes } from "./routes/dashboard";
import { facilityRoutes } from "./routes/facilities";
import { syncRoutes } from "./routes/sync";
import { realtimeRoutes } from "./routes/realtime";
import type { AppEnvironment } from "./types/app-environment";
import { apiSecurityMiddleware } from "./middleware/auth";
import { publishFacilityChange } from "./middleware/change-notification";

const app = new Hono<AppEnvironment>();

// Global Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Client-Id"],
  })
);
app.use("/api/*", apiSecurityMiddleware());
app.use("/api/*", publishFacilityChange());

// Global Error Handler
app.onError((err, c) => {
  console.error("Server Error:", err);
  return c.json(
    {
      error: err.message || "Error interno del servidor",
      status: 500,
    },
    500
  );
});

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    service: "parking-management-worker",
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.route("/api/auth", authRoutes);
app.route("/api/parking-sessions", parkingRoutes);
app.route("/api/facilities", facilityRoutes);
app.route("/api/facilities", dashboardRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/events", realtimeRoutes);

export default app;
export { FacilityEventHub } from "./services/facility-event-hub";
