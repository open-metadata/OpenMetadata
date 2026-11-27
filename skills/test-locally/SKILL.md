---
name: test-locally
description: Build and deploy a full local OpenMetadata stack with Docker to test your connector in the UI. Handles code generation, build optimization, health checks, and guided testing.
user-invocable: true
argument-hint: "[--skip-maven] [--database mysql|postgresql] [--rebuild] [--teardown]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Test Connector Locally

Build, deploy, and test a connector in a full local OpenMetadata stack with Docker.

## When to Activate

When a user asks to "test locally", "start docker", "deploy locally", "test in the UI", "bring up the stack", or "run local docker".

## Arguments

- `--skip-maven` or `--fast`: Skip the Maven build (use when only ingestion Python code changed)
- `--database mysql|postgresql`: Select the database and its matching search service. A new deployment defaults to MySQL.
- `--rebuild`: Tear down existing containers and rebuild
- `--teardown` or `--down`: Stop the selected stack and remove its Compose-managed volumes
- No arguments: Auto-detect what changed and choose the optimal build strategy

## Process

### Step 0: Select the stack

Run commands from the repo root. Use the selected row for every shell call, including troubleshooting. Set `database`, `compose_file` and `db_port` in the shell that runs the command. If the deployment used Compose overlays, pass the same additional `-f` files in the same order.

| `database` | `compose_file` | `db_port` | Search service |
|---|---|---|---|
| `mysql` | `docker/development/docker-compose.yml` | `3306` | Elasticsearch |
| `postgresql` | `docker/development/docker-compose-postgres.yml` | `5432` | OpenSearch |

For teardown or reset, use the database selected at launch. If the request omits `--database` and the stack is unknown, ask which database to stop before running Compose. For `--teardown` or `--down`, stop the selected stack and remove its Compose-managed volumes. Database files in the host bind mount survive this command:

```bash
docker compose -f "$compose_file" down -v
```

For teardown, report the result and exit. For deployment, continue below.

### Step 1: Check Prerequisites

Verify the environment is ready:

```bash
# Check Docker is running
docker info > /dev/null 2>&1 || echo "Docker is not running"

# Check docker compose is available
docker compose version > /dev/null 2>&1 || echo "docker compose not found"

# Check we're in the repo root
test -f docker/run_local_docker.sh || echo "Not in OpenMetadata repo root"
```

If any check fails, tell the user what to fix and stop.

### Step 2: Activate Environment

```bash
source env/bin/activate
```

### Step 3: Run Code Generation

Always run code generation to ensure models are up to date:

```bash
make generate
```

If `make generate` fails, check if the venv is set up:
```bash
make install_dev generate
```

### Step 4: Detect Build Strategy

Decide whether to skip the Maven build. Check what files changed:

```bash
# Check for Java/schema/UI changes since last build
git diff --name-only HEAD~5 | grep -E "^(openmetadata-spec|openmetadata-service|openmetadata-ui)" | head -5
```

**Skip Maven if**:
- User passed `--skip-maven` or `--fast`
- Only files under `ingestion/` changed (Python-only changes)
- No changes to `openmetadata-spec/`, `openmetadata-service/`, or `openmetadata-ui/`

**Full build if**:
- JSON Schema files changed (`openmetadata-spec/`)
- Java service code changed (`openmetadata-service/`)
- UI code changed (`openmetadata-ui/`)
- First time running (no existing Docker images)
- User explicitly asked for full build

### Step 5: Check for Running Containers

```bash
docker compose -f "$compose_file" ps --all
```

If a stack is already running, offer to reuse it. The launcher stops both development Compose configurations before starting the selected one, so confirm a switch before replacing an active stack.

### Step 6: Build and Deploy

**Full build**

This resets the local database files in `docker/development/docker-volume/`, which both stacks share.
```bash
./docker/run_local_docker.sh -m ui -d "$database" -s false -i true -r true
```

**Fast rebuild** (ingestion-only, keeps local database data)
```bash
./docker/run_local_docker.sh -m ui -d "$database" -s true -i true -r false
```

Tell the user which strategy was chosen and why. The build takes:
- Full build: ~5-8 minutes
- Fast rebuild: ~2-3 minutes

### Step 7: Wait for Health

The `run_local_docker.sh` script handles waiting internally. After it completes, verify the services are up:

```bash
# Check OpenMetadata server is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:8585/api/v1/system/version

# Check search cluster health (Elasticsearch or OpenSearch)
curl -fsS http://localhost:9200/_cluster/health
```

### Step 8: Guide the User

Once services are up, fill in the selected row's service names and database port in this summary:

```
The local OpenMetadata stack is running.

Services:
  - OpenMetadata UI:  http://localhost:8585
  - Airflow:          http://localhost:8080 (admin / admin)
  - <search service>: http://localhost:9200
  - <database>:       localhost:<db_port>

To test your connector:
  1. Open http://localhost:8585
  2. Go to Settings -> Services -> {your service type}
  3. Click "Add New Service"
  4. Select your connector from the dropdown
  5. Fill in connection details and click "Test Connection"
  6. If test passes, run metadata ingestion

To tear down when done:
  /test-locally --database <database> --teardown
```

## Troubleshooting

If the user reports issues, check these:

**Connector not in dropdown?**
```bash
# Check service schema registration
grep -l "YourConnector" openmetadata-spec/src/main/resources/json/schema/entity/services/*Service.json

# Need to rebuild without skip-maven
./docker/run_local_docker.sh -m ui -d "$database" -s false -i true -r true
```

**Test connection fails?**
```bash
# Check ingestion container logs
docker compose -f "$compose_file" logs --tail 50 ingestion

# Check test_fn keys match test connection JSON
cat openmetadata-service/src/main/resources/json/data/testConnections/{service_type}/{name}.json
```

**Container won't start?**
```bash
# Check Docker resources (need at least 6GB memory)
docker system info | grep "Total Memory"

# Check port conflicts
lsof -i :8585 -i :8080 -i :9200 -i ":$db_port" | grep LISTEN
```

**Build fails?**
```bash
# Format first, then rebuild
make py_format
mvn spotless:apply
./docker/run_local_docker.sh -m ui -d "$database" -s false -i true -r true
```
