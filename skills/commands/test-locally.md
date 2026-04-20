---
name: test-locally
description: Build everything and bring up a local Docker deployment with all components so you can test a connector in the UI
argument-hint: "[--skip-maven] [--database mysql|postgresql]"
---

# Test Connector Locally

Build, deploy, and test a connector in a full local OpenMetadata stack.

## What This Does

1. Runs code generation (Python Pydantic models from JSON Schema)
2. Builds the Java backend + UI (unless `--skip-maven`)
3. Builds the ingestion Docker image with your new connector
4. Starts all services: MySQL/PostgreSQL, Elasticsearch, OpenMetadata Server, Airflow
5. Loads sample data and triggers search indexing
6. Opens the UI at http://localhost:8585

## Steps

### Step 1: Activate the environment

```bash
source env/bin/activate
```

### Step 2: Run code generation

```bash
make generate
```

This generates Python Pydantic models from the JSON Schema you created/modified.

### Step 3: Build and deploy

**Full build** (first time, or if Java/UI changes were made):

```bash
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r true
```

**Skip Maven** (ingestion-only changes — much faster, ~2-3 minutes):

```bash
./docker/run_local_docker.sh -m ui -d mysql -s true -i true -r false
```

### Step 4: Wait for services

The script automatically:
- Waits for Elasticsearch to be healthy
- Triggers sample data DAGs
- Triggers search re-indexing

This takes 3-5 minutes on first run.

### Step 5: Test in the UI

1. Open http://localhost:8585
2. Go to **Settings** → **Services** → select your service type (Database, Dashboard, etc.)
3. Click **Add New Service**
4. Select your connector from the dropdown
5. Fill in connection details and click **Test Connection**
6. If test passes, run metadata ingestion

### Ports

| Service | URL |
|---------|-----|
| OpenMetadata UI + API | http://localhost:8585 |
| Airflow | http://localhost:8080 (admin / admin) |
| MySQL | localhost:3306 |
| Elasticsearch | http://localhost:9200 |

### Tear Down

```bash
cd docker/development && docker compose down -v
```

### Rebuild After Changes

If you modify connector code and want to redeploy:

```bash
# Stop existing containers
cd docker/development && docker compose down

# Rebuild with skip-maven (fast)
cd ../.. && ./docker/run_local_docker.sh -m ui -d mysql -s true -i true -r false
```

### Troubleshooting

**Connector not in dropdown?**
- Check you added it to the service schema enum (`{serviceType}Service.json`)
- Run `mvn clean install -pl openmetadata-spec` and rebuild without `-s true`

**Test connection fails?**
- Check `test_fn` keys match test connection JSON step names
- Check container logs: `docker compose -f docker/development/docker-compose.yml logs ingestion`

**Build fails?**
- Run `make py_format` to fix Python formatting
- Run `mvn spotless:apply` to fix Java formatting
