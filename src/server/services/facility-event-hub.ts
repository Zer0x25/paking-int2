import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { FacilityChangedEventSchema } from "../../shared/facility-events";

const ConnectionAttachmentSchema = z.object({
  facilityId: z.string().min(1),
  clientId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
}).strict();

export class FacilityEventHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/connect") return this.handleWebSocketConnection(request);
    if (url.pathname === "/publish" && request.method === "POST") return this.publish(request);
    return new Response("Not found", { status: 404 });
  }

  private handleWebSocketConnection(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (request.headers.get("Sec-WebSocket-Protocol") !== "parking-events-v1") {
      return new Response("Unsupported WebSocket protocol", { status: 400 });
    }
    const metadata = ConnectionAttachmentSchema.safeParse({
      facilityId: request.headers.get("X-Facility-Id"),
      clientId: request.headers.get("X-Client-Id"),
    });
    if (!metadata.success) return new Response("Invalid connection metadata", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(metadata.data);
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "parking-events-v1" },
    });
  }

  private async publish(request: Request): Promise<Response> {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "Invalid event" }, { status: 400 });
    }
    const parsed = FacilityChangedEventSchema.safeParse(input);
    if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });

    let delivered = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = ConnectionAttachmentSchema.safeParse(socket.deserializeAttachment());
      if (!attachment.success || attachment.data.facilityId !== parsed.data.facilityId) continue;
      try {
        socket.send(JSON.stringify({
          schemaVersion: 1,
          type: "facility.changed",
          facilityId: parsed.data.facilityId,
          changeId: parsed.data.changeId,
          sourceClientId: parsed.data.sourceClientId,
        }));
        socket.send(JSON.stringify(parsed.data));
        delivered += 1;
      } catch {
        // A closing socket does not block delivery to the other clients.
      }
    }
    return Response.json({ delivered });
  }

  webSocketMessage(socket: WebSocket): void {
    socket.close(1008, "Client messages are not accepted");
  }

  webSocketClose(): void {}

  webSocketError(): void {}
}
