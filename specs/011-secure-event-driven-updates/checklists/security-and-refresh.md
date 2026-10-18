# Requirements Checklist: Seguridad y actualización por cambios

**Purpose**: Validate that security, view refresh, notification privacy, and recovery requirements are complete enough to implement.
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)
**Review Ownership**: Requirements-quality review; checked items mean the requirement is sufficiently specified, not that code is implemented.

## Access control

- [x] CHK001 Does the specification identify the public routes and require authentication for data routes?
- [x] CHK002 Does it define the difference between unauthenticated access, wrong role, and wrong facility?
- [x] CHK003 Does it identify which configuration operations require administrator role?
- [x] CHK004 Does it cover expired credentials while the app is open?
- [x] CHK013 Does it prevent shared browser caches from replaying private data across sessions or facilities?

## View-scoped reads

- [x] CHK005 Does each view have an explicit rule for which data it reads?
- [x] CHK006 Does it prohibit requests before authentication and time-based polling?
- [x] CHK007 Does it define what happens when a change arrives for a hidden view?

## Notifications and recovery

- [x] CHK008 Does the event contract define enough metadata to scope and validate an invalidation?
- [x] CHK009 Does it explicitly exclude credentials, plates, and full business records from messages?
- [x] CHK010 Does it define behavior after disconnect, reconnect, and offline sync?
- [x] CHK011 Does the contract describe cross-device updates rather than only same-browser tabs?
- [x] CHK012 Does it define publication as occurring only after persistence succeeds?
- [x] CHK014 Does it preserve offline gate operation using facility-scoped local snapshots?

## Notes

- The detailed implementation choice and Workers Free constraints are documented in `plan.md`, `research.md`, and ADR-017.
