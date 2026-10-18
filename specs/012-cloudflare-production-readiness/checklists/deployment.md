# Deployment Requirements Checklist: Cloudflare Production Readiness

**Purpose**: Review whether the release-safety requirements are complete, clear, and testable before implementation.
**Created**: 2026-10-18
**Feature**: [spec.md](../spec.md)
**Review Ownership**: Reviewer-owned requirement-quality review. Checked items mean the requirement is clear and complete; they do not mean implementation is complete.

## Target isolation

- [x] CHK001 [Completeness] Does each named environment define its Worker identity, `ENVIRONMENT` value, D1, Durable Object binding/migration, and secret-name set? [Spec §FR-001]
- [x] CHK002 [Clarity] Does local preflight distinguish missing static configuration from remote secret-name verification? [Spec §FR-002]
- [x] CHK003 [Edge Cases] Does the requirement forbid the local placeholder D1 ID in staging and production? [Spec §Edge Cases]

## Security and observability

- [x] CHK004 [Consistency] Do generic 500s preserve intentional validation, authorization, not-found, and business conflict messages? [Spec §FR-008]
- [x] CHK005 [Completeness] Are both request and error log fields bounded to exclude request bodies, credentials, and parking/session data? [Spec §FR-007, contracts/api-errors.md]
- [x] CHK006 [Clarity] Does the requirement separately enable Logs, Traces, and Worker source maps? [Spec §FR-007]

## Release and recovery

- [x] CHK007 [Measurability] Are the CI gates named and tied to the repository's 85% coverage floor? [Spec §FR-009]
- [x] CHK008 [Boundary] Does the spec prohibit CI from deploying and keep actual account mutations outside this feature? [Spec §FR-012, Assumptions]
- [x] CHK009 [Completeness] Does the runbook treat Worker-version rollback and D1 point-in-time restore as separate actions? [Spec §FR-010, Edge Cases]
- [x] CHK010 [Edge Cases] Does the release path remain blocked if remote secret names are missing without revealing secret values? [Spec §FR-002, contracts/release-cli.md]

## Notes

- The chosen initial hostname mode is workers.dev; a custom hostname remains a later account-specific decision.
- No unresolved requirement ambiguity remains for repository-side work. Cloudflare account identifiers and secret values are intentionally external inputs.
