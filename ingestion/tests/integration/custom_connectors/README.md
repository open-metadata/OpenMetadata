# Custom connector integration tests

One Custom Connector per service type that supports `sourcePythonClass`, each producing a small,
deterministic set of entities from memory. They reach no external system, so the only requirement
is a running OpenMetadata server on `http://localhost:8585`.

| Module | Service type | Produces |
|---|---|---|
| `custom_database.py` | `CustomDatabase` | database → 2 schemas → 3 tables with columns |
| `custom_dashboard.py` | `CustomDashboard` | 2 charts + 1 dashboard referencing them |
| `custom_messaging.py` | `CustomMessaging` | 2 topics with partitions and a message schema |
| `custom_mlmodel.py` | `CustomMlModel` | 1 model with features, hyper parameters, store |
| `custom_pipeline.py` | `CustomPipeline` | 1 pipeline with 3 chained tasks |
| `custom_search.py` | `CustomSearch` | 2 search indexes with typed fields |
| `custom_storage.py` | `CustomStorage` | root container + child container with a data model |
| `custom_drive.py` | `CustomDrive` | directory + file, spreadsheet + worksheet |

## Run the tests

```bash
source env/bin/activate
cd ingestion
python -m pytest tests/integration/custom_connectors -q
```

## Run one connector by hand

The connector modules are plain top-level modules, so put this directory on `PYTHONPATH` and point
`sourcePythonClass` at `<module>.<Class>`:

```yaml
source:
  type: custom-database
  serviceName: custom_database_demo
  serviceConnection:
    config:
      type: CustomDatabase
      sourcePythonClass: custom_database.CustomDatabaseSource
      connectionOptions:
        databaseName: my_catalog
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <ingestion-bot token>
```

```bash
PYTHONPATH=ingestion/tests/integration/custom_connectors metadata ingest -c workflow.yaml
```

`connectionOptions` values are `Dict[str, str]`; numeric options have to be parsed by the connector.

## Writing your own

Subclass `metadata.ingestion.api.steps.Source` and implement `create`, `prepare`, `test_connection`,
`close` and `_iter`. `_iter` yields `Either(right=<CreateXRequest>)`, starting with the service
request from `metadata.get_create_service_from_source(...)` so the service exists before its
children. Subclassing a `*ServiceSource` base instead additionally requires module-level
`get_connection` and `test_connection` functions next to the class.
