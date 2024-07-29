---
This guide will help you setup the Ingestion framework and connectors
---

![Python version 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

OpenMetadata Ingestion is a simple framework to build connectors and ingest metadata of various systems through
OpenMetadata APIs. It could be used in an orchestration framework(e.g. Apache Airflow) to ingest metadata.
**Prerequisites**

- Python &gt;= 3.8.x

### Docs

Please refer to the documentation here https://docs.open-metadata.org/connectors

<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=c1a30c7c-6dc7-4928-95bf-6ee08ca6aa6a" />

## Testing

We use `pytest` for testing. To run the tests, you can use the following command:

```bash
make install_dev install_test generate run_python_tests
```

Tests are generally seperated into two categories:

### Unit tests

Unit tests are written to test the individual components of the code. They are generally written in
the [`tests/unit`](./tests/unit) directory. No external systems are used in these tests and any external
dependencies are mocked. This is mostly for checking logic of internal functions oif the ingestion framework.

### Integration tests

Integration tests are written to test the integration of the ingestion framework with external systems. They are
generally written in the [`tests/integration`](./tests/integration) directory. These tests require external systems
to be running and are generally slower than unit tests but provide a more comprehensive test of the ingestion framework.

Integration tests make use of:
- [pytest fixtures](https://docs.pytest.org/en/7.1.x/explanation/fixtures.html#about-fixtures)
in order to provide common setup and teardown for the tests and are generally defined in `conftest.py` files.
- [testcontainers](https://github.com/testcontainers/testcontainers-python) for esternal systems.
- OpenMetadata instance which can be deployed using the quick start docker composer or the
`./docker/run_local_docker.sh` script.

### Adding New Tests

If you're adding a new connector, we encourage you to write both unit and integration tests for the connector. You
can copy the example of the postgres connector tests in the 
[`unit`](./tests/unit/topology/database/test_postgres.py) 
and [`integration`](./tests/integration/ingestion/source/database/postgres/test_metadata.py) tests.

### TopologyRunner

All the Ingestion Workflows run through the TopologyRunner.

The flow is depicted in the images below.

**TopologyRunner Standard Flow**

![image](../openmetadata-docs/images/v1.4/features/ingestion/workflows/metadata/multithreading/single-thread-flow.png)

**TopologyRunner Multithread Flow**

![image](../openmetadata-docs/images/v1.4/features/ingestion/workflows/metadata/multithreading/multi-thread-flow.png)
