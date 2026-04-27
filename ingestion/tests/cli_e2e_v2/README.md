# CLI E2E v2

End-to-end tests that exercise the `metadata` CLI against a real OpenMetadata server and real data sources. Each test module brings its source into a declared shape (tables, seeds, views, stored procedures), runs one or more CLI pipelines, then asserts on what ended up in OM.

## Quick start

```bash
# 1. OM stack up
docker compose -f docker/development/docker-compose.yml up -d

# 2. Your source up (MySQL is the pilot — use the openmetadata_mysql container it ships)
# 3. Env vars
export E2E_MYSQL_HOST_PORT=localhost:3306
export E2E_MYSQL_USER=openmetadata_user
export E2E_MYSQL_PASSWORD=openmetadata_password

# 4. Run the pilot suite
source env/bin/activate
cd ingestion
pytest tests/cli_e2e_v2/mysql -v
```

First-time MySQL privileges (one-time grant on the Docker container's root):

```sql
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
GRANT SELECT, EXECUTE, SHOW VIEW ON e2e.* TO 'openmetadata_user'@'%';
GRANT SHOW_ROUTINE ON *.* TO 'openmetadata_user'@'%';
FLUSH PRIVILEGES;
```

## Environment toggles

| Var | Default | Effect |
|---|---|---|
| `OM_SERVER_URL` | `http://localhost:8585/api` | Which OM server tests hit |
| `OM_JWT_TOKEN` | *(unset → minted)* | Bypass bot-token minting with a pre-minted JWT |
| `OM_ADMIN_EMAIL` | `admin@open-metadata.org` | Admin used during bot-token minting |
| `OM_ADMIN_PASSWORD` | `admin` | Admin password (raw; framework base64-encodes it for login) |
| `E2E_<CONNECTOR>_*` | — | Per-connector DSN (see `CONNECTORS.md`) |
| `E2E_POLL_VERBOSE` | unset | `=1` logs every `retry_until` attempt at INFO — use when a poll is flaking and you can't tell why |

## Where artifacts go

Every CLI invocation writes three files to the pytest tmp_path:

```
/tmp/pytest-of-<user>/pytest-current/<test_or_fixture_dir>/
  cfg_<pipeline>_<n>.yaml     # rendered config (secrets are ${refs}, not literal)
  status_<pipeline>_<n>.json  # the CLI's status report — failures[] lives here
  stdout_<pipeline>_<n>.log   # full CLI stdout (progress + workflow summary)
```

`<n>` increments per test to keep multiple invocations (e.g. metadata + profiler in the same test) separate. The `CliRunner` logs the full trio at INFO on every run.

## Session posture banner

At session start you'll see:

```
==== CLI E2E v2 session start ====
session uuid: 4dbbf8db
server url:   http://localhost:8585/api
token source: minted
==================================
```

- `session uuid` — suffixed into every OM service name so parallel runs never collide. Grep for it in OM to find this session's services.
- `server url` — which OM instance was hit (not always obvious when you have several running).
- `token source` — `env` means `OM_JWT_TOKEN` was exported; `minted` means the framework ran the admin-login → bot-token flow against the server above.

## Common failure modes

### `CliExecutionError: metadata CLI exited with code N`

The exception message already includes:
- the full `argv` of the subprocess,
- the `config` path (rendered YAML — inspect if filters / pipeline options look wrong),
- the `status` path (with `exists=True/False`) — if the status file exists, the first few step failures are pre-extracted into the exception body,
- the captured `stdout` + `stderr`.

First-look order: step failures block (if present) → stderr tail → status JSON for the full `failures[]` list.

### `StructuralMismatch: N diffs (M columns, K tables, ...)`

Category summary on the header, path-sorted body grouped by owning entity (table / procedure / view). Each diff shows `expected: X` / `actual: Y` on indented lines. Jump to the first diff; the rest usually cascade from it.

### `401 Public key mismatch` / `Invalid token`

The JWT you're using wasn't signed by THIS server. Two fixes:
- **If `token source: env`**: the exported `OM_JWT_TOKEN` is stale. `unset OM_JWT_TOKEN` and rerun — the framework will mint a fresh one against the server.
- **If `token source: minted`** and it *still* fails: the server restarted between minting and the API call. Rerun; the next session mints afresh.

### `TokenMintError: failed to mint ingestion-bot token`

The admin login hop failed. Either:
- The OM server is down (`docker compose up -d`).
- Admin creds differ from defaults — set `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD`.
- Something is wedged — export a pre-minted `OM_JWT_TOKEN` to bypass minting entirely.

### `AccessDenied` / `permission denied` inside a CLI run

The scoped ingest user is missing a privilege. Do NOT change the framework — grant the privilege directly on the source. For MySQL, see the Quick start grants above; for other connectors see `CONNECTORS.md`.

### Filter variant `AssertionError: no expected_tables entry for filter scenario 'X'`

A new scenario was added to `COMMON_FILTER_SCENARIOS` but your connector's `_EXPECTED_TABLES_BY_VARIANT` dict is missing an entry. Add one — the error message names the exact key.

### Eventually timed out

A polled assertion (profile, lineage, FK, entity count) didn't converge in 60s. Options:
- Increase the timeout in the test: `.eventually(120)`.
- Export `E2E_POLL_VERBOSE=1` and rerun — you'll see every attempt's failure message with timestamps, which usually pinpoints whether the data never materialized vs. is flapping.

## Layout

```
tests/cli_e2e_v2/
  README.md                 # you are here
  CONNECTORS.md             # how to add a new connector
  conftest.py               # session-wide fixtures (session_uuid, om_server_config, ...)
  core/
    config/                 # WorkflowConfig builder + pipeline options + env + server
    expected/               # Expected* dataclasses + differ + type_map + derive
    fluent/                 # om_client + EntityAssert / TableAssert / ... (see __init__ docstring for the assertion catalog)
    runner/                 # CliRunner + Status + errors
    source/                 # SqlBaselineEnforcer + orchestrator + common baseline
    fixtures.py             # per-connector fixture helpers
    filter_scenarios.py     # portable filter-parametrize matrix
  mysql/                    # pilot connector — reference implementation
```

## Adding a new connector

See `CONNECTORS.md` — seven-file scaffold, env-var convention, admin-vs-ingest creds rule, common trouble sources.
