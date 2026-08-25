---
name: test-locally
description: Build and deploy a full local OpenMetadata stack with Docker to test your connector in the UI. Handles code generation, build optimization, health checks, and guided testing.
user-invocable: true
argument-hint: "[--skip-maven] [--rebuild] [--teardown]"
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
- `--rebuild`: Tear down existing containers and rebuild
- `--teardown` or `--down`: Just stop and remove containers
- No arguments: Auto-detect what changed and choose the optimal build strategy

## Process

### Step 0: Handle Teardown

If the user asked to tear down / stop:

```bash
cd docker/development && docker compose down -v
```

Report success and exit.

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
docker compose -f docker/development/docker-compose.yml ps --format json 2>/dev/null | head -5
```

If containers are already running:
- Ask the user if they want to rebuild or just open the UI
- If rebuild, tear down first: `cd docker/development && docker compose down`

### Step 6: Build and Deploy

**Full build**:
```bash
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r true
```

**Fast rebuild** (ingestion-only):
```bash
./docker/run_local_docker.sh -m ui -d mysql -s true -i true -r false
```

Tell the user which strategy was chosen and why. The build takes:
- Full build: ~5-8 minutes
- Fast rebuild: ~2-3 minutes

### Step 7: Wait for Health

The `run_local_docker.sh` script handles waiting internally. After it completes, verify the services are up:

```bash
# Check OpenMetadata server is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:8585/api/v1/system/version

# Check Elasticsearch
curl -s -o /dev/null -w "%{http_code}" http://localhost:9200
```

### Step 8: Guide the User

Once services are up, tell the user:

```
The local OpenMetadata stack is running.

Services:
  - OpenMetadata UI:  http://localhost:8585
  - Airflow:          http://localhost:8080 (admin / admin)
  - Elasticsearch:    http://localhost:9200
  - MySQL:            localhost:3306

To test your connector:
  1. Open http://localhost:8585
  2. Go to Settings -> Services -> {your service type}
  3. Click "Add New Service"
  4. Select your connector from the dropdown
  5. Fill in connection details and click "Test Connection"
  6. If test passes, run metadata ingestion

To tear down when done:
  /test-locally --teardown
```

## Troubleshooting

If the user reports issues, check these:

**Connector not in dropdown?**
```bash
# Check service schema registration
grep -l "YourConnector" openmetadata-spec/src/main/resources/json/schema/entity/services/*Service.json

# Need to rebuild without skip-maven
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r true
```

**Test connection fails?**
```bash
# Check ingestion container logs
docker compose -f docker/development/docker-compose.yml logs ingestion --tail 50

# Check test_fn keys match test connection JSON
cat openmetadata-service/src/main/resources/json/data/testConnections/{service_type}/{name}.json
```

**Container won't start?**
```bash
# Check Docker resources (need at least 6GB memory)
docker system info | grep "Total Memory"

# Check port conflicts
lsof -i :8585 -i :8080 -i :9200 -i :3306 | grep LISTEN

# Full reset
cd docker/development && docker compose down -v && docker system prune -f
```

**Build fails?**
```bash
# Format first, then rebuild
make py_format
mvn spotless:apply
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r true
```
