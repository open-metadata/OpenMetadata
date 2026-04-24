# Kestra Integration Tests

Integration tests for the Kestra pipeline connector. These tests spin up a real Kestra instance via Docker (testcontainers) and validate end-to-end ingestion into a running OpenMetadata server.

## Prerequisites

- Docker installed and running
- A running OpenMetadata instance at `http://localhost:8585` (e.g. via `docker compose up`)
- Python dependencies: `testcontainers`, `requests`

## Running the tests

```bash
# From the repo root
cd ingestion
pytest tests/integration/kestra/test_kestra_integration.py -v -m integration
```

Or with the full integration suite:

```bash
pytest tests/integration/ -v -m integration
```

## What the tests cover

| Test | Description |
|------|-------------|
| `test_pipeline_ingestion` | Seeds a Kestra flow with 2 tasks, runs ingestion, asserts the `Pipeline` entity exists in OM with the correct FQN and task count |
| `test_execution_status_ingestion` | Triggers a Kestra execution, waits for terminal state, re-runs ingestion, asserts `PipelineStatus` records exist |
| `test_lineage_ingestion` | Pre-creates OM table entities, seeds a flow with `openmetadata.table.input`/`output` labels, runs ingestion, asserts lineage edges exist |

## Notes

- Tests are skipped automatically if Docker is unavailable.
- The Kestra container uses `kestra/kestra:latest` with `server standalone --worker-thread 128`.
- The health check polls `GET /api/v1/flows/search?q=*` with a 120-second timeout.
- All tests use `pytest.mark.integration` — ensure your pytest config includes this marker.
