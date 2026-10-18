# Release CLI Contract

## Local checks (no Cloudflare API calls)

```sh
npm run worker:preflight:staging
npm run worker:preflight:production
```

Each command validates the selected `[env.<target>]` in `wrangler.toml` and exits nonzero if a required section/binding is missing, `ENVIRONMENT` does not match, the D1 ID is a placeholder or not a UUID, the DO migration/binding is absent, Workers Logs/Traces or source maps are disabled, or the required secret-name set is incomplete. It prints missing field names, never secret values. It does not authenticate, read a remote database, create resources, or deploy.

## Release commands (remote read followed by explicit deploy)

```sh
npm run worker:deploy:staging
npm run worker:deploy:production
```

Each named command performs this sequence:

1. Validate local configuration for the exact named target. Failure stops before Cloudflare API use.
2. Build the application.
3. Use Wrangler to list only remote secret names for that target; compare them with `secrets.required`. Do not log secret values. Missing names stop the release before deployment.
4. Run `wrangler deploy --env <target>` only if all prior checks pass.

There is no general `worker:deploy` command targeting the top-level local environment. There is no automatic deployment from CI in this feature.

## Exit behavior

- `0`: selected command completed all of its stated checks.
- Nonzero: invalid/unknown target, missing local configuration, build failure, secret-name lookup failure, missing required remote secret name, or Wrangler deploy failure.
- Failure output may contain target and missing configuration/secret *names*. It must not print secret values, `.dev.vars`, authorization headers, JWTs, or request data.

## Local/CI packaging check

```sh
npm run worker:dry-run
```

Builds and packages the top-level local configuration only. A successful result does not validate Cloudflare account resources or production secrets and is not a remote deployment smoke test.
