# API Error Contract

For unexpected server failures, all endpoints return the existing JSON envelope with an HTTP 500 and a generic Spanish message:

```json
{
  "error": "Error interno del servidor",
  "status": 500
}
```

Known validation errors, authentication/authorization failures, expected not-found cases, version conflicts, and business-rule conflicts keep their current status and user-facing explanation. Internal D1, Worker binding, credential configuration, and runtime exception messages must not be returned as a 500 response.

Server diagnostics are emitted as structured JSON. Request logs may include method, path without query string, status, and elapsed time. Error logs may include error name, message, and stack for debugging. Logs must not include request/response bodies, cookies, authorization headers, passwords, JWTs, vehicle plates, active parking sessions, or indexed data payloads.
