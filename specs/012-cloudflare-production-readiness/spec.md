# Feature Specification: Cloudflare Production Readiness

**Feature Branch**: `012-cloudflare-production-readiness`

**Created**: 2026-10-18

**Status**: Ready

**Input**: User request: create a prioritized backlog from the Cloudflare deployment review and start resolving the findings in the most efficient order.

## User Scenarios & Testing

### User Story 1 - Safe production release (Priority: P1)

As the application maintainer, I need a production release to use production-only configuration and data so a routine local or staging command cannot publish development settings or point at the wrong database.

**Why this priority**: The current default deployment command reads development configuration and a local D1 identifier. Publishing before separating targets risks an unavailable app or mixing environments.

**Independent Test**: Run target preflight with missing or placeholder resources and confirm it exits with actionable errors before Cloudflare access; inspect the release runner contract to confirm it checks the requested environment and required secret names before calling `wrangler deploy --env <target>`.

**Acceptance Scenarios**:

1. **Given** target configuration is missing or contains placeholders, **When** local preflight runs, **Then** it exits with actionable errors without contacting Cloudflare.
2. **Given** target configuration is valid, **When** a release is requested, **Then** it checks the required remote secret names without reading values and stops before deployment if any are missing.
3. **Given** target configuration and required secret names are valid, **When** the maintainer selects the named release command, **Then** the Worker receives that environment's values and its isolated D1 and Durable Object bindings.
4. **Given** local development is running, **When** the developer uses the local command, **Then** it continues to use local D1 and development credentials without contacting remote Cloudflare resources.

### User Story 2 - Verified deployment process (Priority: P1)

As the maintainer, I need repeatable checks and a deployment guide so I can verify the build, dependencies, bindings, migrations, secrets, and rollback path before serving real traffic.

**Why this priority**: The repository currently documents local setup and local migrations, while production resource provisioning and release steps are not documented.

**Independent Test**: Check that the runbook gives exact commands and observable outcomes for each step, then run the non-mutating local gates. The staging drill becomes executable once the external D1 IDs and Worker secrets are provisioned; production remains gated until its inputs are supplied.

**Acceptance Scenarios**:

1. **Given** a pull request changes application code, **When** CI runs, **Then** it checks tests, coverage, types, lint, dependency audit, build, and Wrangler packaging.
2. **Given** a release candidate is ready, **When** the maintainer follows the deployment guide, **Then** they can identify which environment, D1 database, secrets, hostname, and migration state will be used before deployment.
3. **Given** a deployment causes an application regression, **When** the maintainer follows the recovery guide, **Then** they can restore a known-good Worker version and recover D1 to an appropriate point in time without guessing commands.
4. **Given** a pull request passes CI, **When** it is merged, **Then** CI validates but does not deploy or mutate Cloudflare resources.

### User Story 3 - Diagnose production failures safely (Priority: P2)

As the maintainer, I need useful production diagnostics without exposing implementation details or credentials to users so failures can be investigated after release.

**Why this priority**: Cloudflare recommends observability and source maps before production; the application currently has no explicit Wrangler observability configuration.

**Independent Test**: Worker tests trigger controlled handled and unhandled errors and confirm generic client responses plus privacy-safe structured log records; Wrangler configuration explicitly enables Logs, Traces, and Worker source maps. Source-mapped dashboard traces are confirmed during the later staging drill.

**Acceptance Scenarios**:

1. **Given** an unexpected server error occurs, **When** a user receives the response, **Then** the response contains a generic message while diagnostic details remain available to authorized maintainers.
2. **Given** a Worker request is processed, **When** the maintainer inspects telemetry, **Then** requests, errors, and binding calls can be correlated without logging credentials, tokens, or vehicle data.

## Edge Cases

- A production D1 identifier is absent, malformed, or still set to the local placeholder.
- Some required Worker secrets are absent from production even though local `.dev.vars` is complete.
- A migration is pending, fails, or is applied to the wrong environment.
- The application hostname has not yet been chosen or is not routed to the intended Worker.
- A Worker build succeeds while an external production binding is unavailable; a packaging dry-run alone must not be treated as a production smoke test.
- A Worker rollback restores code but does not automatically roll back D1 data; the recovery guide must treat these as separate operations.
- The target account is on Workers Free, where D1 Time Travel recovery retention is limited to 7 days; legacy D1 storage may not support the same Time Travel path.

## Requirements

### Functional Requirements

- **FR-001**: The release process MUST distinguish development, staging, and production Worker identity, configuration, D1 data, Durable Object namespace, and credentials.
- **FR-002**: Local preflight MUST fail before Cloudflare network access when the selected environment, D1 identifier, or hostname mode is missing, malformed, or unresolved. The release command MUST check required remote secret names before deployment and MUST NOT read or print their values.
- **FR-003**: The ordinary development command MUST remain local-only and MUST NOT select a remote database.
- **FR-004**: Production authentication values and signing keys MUST be provisioned as Cloudflare secrets and MUST NOT be committed to the repository or printed by release checks.
- **FR-005**: The release guide MUST document creating isolated D1 databases, reviewing migration status, applying migrations to the selected remote database, and using D1 recovery facilities within the Free-tier retention window.
- **FR-006**: The application MUST serve the SPA and API from the configured Workers Static Assets and Worker deployment without exposing private API responses to shared caches.
- **FR-007**: Staging and production Workers MUST have configured request logs, traces, and uploaded Worker source maps; structured logging MUST avoid credentials, tokens, vehicle plates, and parking-session data.
- **FR-008**: Unexpected API failures MUST return the same generic 500 contract across uncaught errors and route-level catch blocks while preserving useful diagnostic details in server-side telemetry.
- **FR-009**: Automated checks MUST run unit and Worker tests at the configured 85% coverage threshold, type checks, lint, dependency audit, build, and local Wrangler packaging before a change is eligible for release. CI MUST NOT deploy.
- **FR-010**: The release guide MUST explain the chosen Worker hostname or custom domain, environment-specific deployment selection, smoke checks, Worker version rollback, and D1 point-in-time recovery; for the target Free tier it MUST state the 7-day retention limit and require confirmation that the D1 storage version supports Time Travel.
- **FR-011**: Compatibility-date updates MUST be reviewed and tested as an intentional runtime change, including existing Durable Object and Static Assets behavior.
- **FR-012**: No production Cloudflare resource may be created, migrated, or deployed by this feature without actual account-specific identifiers and a separately authorized remote operation.

### Key Entities

- **Deployment environment**: A named development, staging, or production target with its own Worker configuration, service bindings, variables, and credentials.
- **Release candidate**: A source revision that has passed the repository's build, quality, dependency, and packaging checks.
- **Database migration**: A versioned change to the parking application's D1 schema that must be applied to one explicitly selected environment.
- **Production secret**: A credential or signing key available to the production Worker at runtime and stored outside version control.
- **Recovery point**: A known Worker version and D1 point in time that can be used to restore service after a release failure.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In 100% of local preflight checks with missing or placeholder target inputs, the release process stops before making any Cloudflare API call; missing remote secret names stop before deployment.
- **SC-002**: Development, staging, and production checks show distinct Worker environment values, Worker identities, and D1 identifiers, with no local identifier selected for staging or production.
- **SC-003**: Every pull request receives a visible pass/fail result for tests, the required coverage threshold, type checking, lint, dependency audit, build, and Worker packaging.
- **SC-004**: Induced unexpected errors from a request, authentication, read, and write path return no internal exception text to clients; maintainers can locate structured diagnostic records and source-mapped Worker stacks.
- **SC-005**: The runbook contains exact commands and observable success criteria for a staging release and separate Worker/D1 recovery drill; absent account inputs are explicitly listed as blockers to performing the drill.
- **SC-006**: The release checklist explicitly identifies any Cloudflare account input that is still absent; no unresolved production prerequisite is reported as deployment-ready.

## Assumptions

- The repository's existing GitHub Actions workflow remains the CI provider; Cloudflare Workers Builds is not required for this iteration.
- Production deployment remains a deliberate maintainer action. This feature prepares and guards that action but does not publish the application.
- Staging and production use separate Cloudflare D1 databases and Worker environments.
- The initial target may use a `workers.dev` hostname; a custom domain is added only after its exact hostname and account ownership are supplied.
- Until a custom domain is selected, staging and production use their generated workers.dev names and explicitly enable workers.dev access.
- The selected login model remains the currently approved two-role credential configuration, stored locally in `.dev.vars` for development and as separate Cloudflare secrets for remote environments.
- Account-specific D1 identifiers, custom domain, Cloudflare account credentials, and production secret values are not available in this repository and will remain explicit external prerequisites.
- Cloudflare Workers Free is the deployment target; backup/recovery instructions must not imply a 30-day D1 Time Travel window.

## Out of Scope

- Creating Cloudflare resources, applying remote migrations, adding production secret values, changing DNS, or deploying to production.
- Replacing the current authentication model with individual user management or an external identity provider.
- Changing application business rules unrelated to production deployment readiness.
