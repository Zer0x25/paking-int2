# Quickstart: Capacidad por Tipo de Espacio

## Local setup

1. Apply the local D1 migrations and seed data: `npm run db:local:init`.
2. Start Vite and the Worker using the repository's local development commands.
3. Sign in as an administrator and open **Configuración**.

## Facility acceptance path

1. Create a facility with 35 total spaces and 2 Accessible spaces.
2. Confirm the summary shows 33 Standard and 2 Accessible.
3. Attempt an Accessible value greater than 35 and confirm the form rejects it.
4. Change an existing facility's Accessible count and confirm Standard recalculates without changing the total.

## Area acceptance path

1. Add an area with 20 Standard and 1 Accessible space.
2. Add another area with 10 Standard and 1 Accessible space.
3. Confirm the facility shows 3 unassigned Standard and 0 unassigned Accessible spaces.
4. Attempt to allocate one extra Accessible space and confirm the change is rejected.
5. Attempt to lower a type below its active occupancy and confirm the save is rejected.

## Gate and dashboard acceptance path

1. Confirm only Standard and Accessible appear for new vehicle entries.
2. Fill Standard capacity and verify a Standard entry cannot use Accessible capacity.
3. Fill Accessible capacity and verify another Accessible request displays the fallback warning; an explicit Standard selection succeeds only if Standard space remains.
4. Confirm the dashboard and area cards report category capacity, occupancy and remaining spaces consistent with active sessions.

## Automated validation

Run the focused unit and Worker suites for allocation, facility configuration and parking entry, then run `npm run typecheck`, `npm run lint`, `npm run build` and the repository coverage gate before review.
