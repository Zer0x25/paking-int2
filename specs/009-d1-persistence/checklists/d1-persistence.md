# Persistence Requirements Checklist: Persistencia Central de la Aplicación

**Purpose**: Revisión de requisitos de seguridad, durabilidad, concurrencia y operación offline antes de implementar
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)

## Durability and data scope

- [ ] CHK001 Does the specification name every server-owned entity that must survive a Worker restart?
- [ ] CHK002 Does it distinguish server persistence from the browser's IndexedDB cache and pending outbox?
- [ ] CHK003 Does local initialization define exactly when baseline records are inserted and protect user-created records from overwrite?
- [ ] CHK004 Does it state what happens when the D1 binding is missing or a write fails?

## Integrity and concurrency

- [ ] CHK005 Does each aggregate mutation preserve the existing capacity, quota, lifecycle, and reference rules?
- [ ] CHK006 Does the specification define behavior for concurrent writes and stale entity versions?
- [ ] CHK007 Does it require the domain change, audit entry, and successful sync receipt to commit together?
- [ ] CHK008 Does the offline flow define stable idempotency behavior for duplicate and conflicting mutation IDs?

## Authentication and audit

- [ ] CHK009 Does the specification keep passwords out of D1 and exclude default credentials or JWT signing secrets from tracked source?
- [ ] CHK010 Does local credential bootstrap identify an ignored local secret source and fail closed when it is absent?
- [ ] CHK011 Does audit retain actor, action, entity, and timestamp after the in-memory stores are removed?
- [ ] CHK012 Does authentication preserve admin/operator access rules for every persisted route?

## Local operations and scope

- [ ] CHK013 Can a clean local D1 setup apply migrations and seed only development data without a remote resource?
- [ ] CHK014 Are production database creation, production data migration, and deployment explicitly outside this feature?
- [ ] CHK015 Does verification include Worker runtime tests, migration replay, restart persistence, offline retry, and a real browser flow?
- [ ] CHK016 Does the local Worker launcher replace only a prior instance of this checkout, preserve port 8787, and refuse to terminate an unrelated listener?

## Notes

- Leave items unchecked until a reviewer confirms the requirements are unambiguous and complete.
- This checklist evaluates requirements quality; it does not mark implementation complete.
