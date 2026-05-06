# CLI E2E v2

End-to-end tests for the `metadata` CLI against a real OpenMetadata server and a real data source. Each test brings its source into a declared shape, runs CLI pipelines, asserts on what landed in OM.

## Run

```bash
docker compose -f docker/development/docker-compose.yml up -d
source env/bin/activate
cd ingestion
pytest tests/cli_e2e_v2/mysql -v
```

Each connector boots its own source via testcontainers. Docker is the only prerequisite — no DB ports, credentials, or grants to manage.

## Layout

```
tests/cli_e2e_v2/
  conftest.py     # session fixtures (uuid, server config)
  core/           # framework internals
  mysql/          # reference connector
  CONNECTORS.md   # how to add a new connector
```

## Debugging

Every CLI run writes three files to pytest's tmp_path; the runner logs the paths at INFO:

```
cfg_<pipeline>_<n>.yaml     # rendered config (secrets are ${refs})
status_<pipeline>_<n>.json  # status report — failures[] lives here
stdout_<pipeline>_<n>.log   # full stdout
```

First place to look on failure: the exception body, then the status JSON.

| Error | Fix |
|---|---|
| `CliExecutionError` | Inspect the embedded failures, stderr, status path |
| `StructuralMismatch` | Jump to the first diff; rest cascade |
| `401` / `Invalid token` | `unset OM_JWT_TOKEN` and rerun |
| `permission denied` from CLI | Add the missing GRANT to the connector's `conftest.py` |
| `Eventually timed out` | Raise `.eventually(120)` or set `E2E_POLL_VERBOSE=1` |

## Env toggles (rarely needed)

| Var | Default | Effect |
|---|---|---|
| `OM_SERVER_URL` | `http://localhost:8585/api` | OM server URL |
| `OM_JWT_TOKEN` | minted | Pre-minted token; bypasses admin login |
| `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD` | `admin@open-metadata.org` / `admin` | Admin for token minting |
| `E2E_POLL_VERBOSE` | unset | `=1` logs every poll attempt |
