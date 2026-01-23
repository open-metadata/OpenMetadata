# OpenMetadata Integration Tests

This module contains SDK-based integration tests that run against a real OpenMetadata server using Testcontainers. Tests execute in parallel and are isolated using `TestNamespace`.

## Quick Start

```bash
# Run all tests with MySQL + Elasticsearch (default)
mvn test -pl :openmetadata-integration-tests

# Run with PostgreSQL + OpenSearch
mvn test -pl :openmetadata-integration-tests -Ppostgres-opensearch

# Run a specific test
mvn test -pl :openmetadata-integration-tests -Dtest="TableResourceIT"
```

## Available Profiles

| Profile | Database | Search Engine |
|---------|----------|---------------|
| `mysql-elasticsearch` (default) | MySQL 8.3.0 | Elasticsearch 8.11.4 |
| `postgres-opensearch` | PostgreSQL 15 | OpenSearch 2.19.0 |
| `postgres-elasticsearch` | PostgreSQL 15 | Elasticsearch 8.11.4 |
| `mysql-opensearch` | MySQL 8.3.0 | OpenSearch 2.19.0 |

## Writing a New Integration Test

### 1. Create the Test Class

Extend `BaseEntityIT` for entity CRUD tests or create a standalone test class:

```java
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;

public class MyFeatureIT extends BaseEntityIT<Table, CreateTable> {

  @Override
  protected String getEntityType() {
    return "table";
  }

  @Override
  protected Table createEntity(CreateTable request) {
    return SdkClients.adminClient().tables().create(request);
  }

  @Override
  protected CreateTable createRequest(String name, TestNamespace ns) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(SharedEntities.getSchema().getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
  }

  @Test
  void myCustomTest(TestNamespace ns) throws Exception {
    CreateTable request = createRequest(ns.prefix("myTable"), ns);
    Table table = createEntity(request);

    assertNotNull(table.getId());
    assertEquals(request.getName(), table.getName());
  }
}
```

### 2. Key Concepts

#### TestNamespace

Every test method receives a `TestNamespace` parameter that provides unique prefixes for entity names:

```java
@Test
void myTest(TestNamespace ns) {
  String uniqueName = ns.prefix("myEntity");  // e.g., "abc123_myEntity"
}
```

This ensures tests don't conflict when running in parallel.

#### SdkClients

Get pre-configured SDK clients for different users:

```java
OpenMetadataClient adminClient = SdkClients.adminClient();
OpenMetadataClient user1Client = SdkClients.user1Client();
OpenMetadataClient botClient = SdkClients.botClient();
```

#### SharedEntities

Access pre-created entities for tests:

```java
DatabaseService service = SharedEntities.getService();
Database database = SharedEntities.getDatabase();
DatabaseSchema schema = SharedEntities.getSchema();
User adminUser = SharedEntities.getAdminUser();
```

### 3. BaseEntityIT Features

When extending `BaseEntityIT`, you get these tests automatically:

| Test | Description |
|------|-------------|
| `post_entityCreate_200` | Create entity successfully |
| `get_entity_200_OK` | Get entity by ID |
| `get_entityByName_200` | Get entity by FQN |
| `get_entityNotFound_404` | Get non-existent entity |
| `put_entityCreate_200` | Create via PUT |
| `patch_entityAttributes_200` | Patch entity attributes |
| `delete_entityAsAdmin_200` | Delete entity |
| `get_entityListWithPagination_200` | List with pagination |
| `test_sdkCRUDOperations` | Full CRUD via SDK |
| ... and 30+ more |

### 4. Controlling Test Behavior

Use flags to customize which inherited tests run:

```java
public class MyEntityIT extends BaseEntityIT<MyEntity, CreateMyEntity> {
  {
    supportsPatch = true;          // Enable PATCH tests
    supportsTags = true;           // Enable tag tests
    supportsOwner = true;          // Enable owner tests
    supportsSearchIndex = true;    // Enable search tests
    supportsDomains = true;        // Enable domain tests
  }
}
```

### 5. Best Practices

1. **Use `TestNamespace.prefix()`** for all entity names to ensure uniqueness
2. **Don't clean up entities** - TestNamespace isolation handles this
3. **Use specific imports** - No wildcard imports (`import static ....*`)
4. **Keep tests independent** - Don't rely on order of execution
5. **Use Awaitility for async operations** - Not `Thread.sleep()`

```java
Awaitility.await()
    .atMost(Duration.ofSeconds(30))
    .pollInterval(Duration.ofMillis(500))
    .until(() -> someCondition());
```

6. **Avoid single-line comments** - Write self-documenting code

## Project Structure

```
openmetadata-integration-tests/
├── src/test/java/org/openmetadata/it/
│   ├── auth/           # JWT token generation
│   ├── env/            # Test infrastructure (TestSuiteBootstrap)
│   ├── factories/      # Entity factory classes
│   ├── tests/          # Integration test classes
│   └── util/           # Utilities (SdkClients, TestNamespace)
└── src/test/resources/
    ├── openmetadata-secure-test.yaml  # Test config
    └── *.der                          # JWT keys
```

## Test Infrastructure

Tests use `TestSuiteBootstrap` (a JUnit `LauncherSessionListener`) that:

1. Starts database container (MySQL or PostgreSQL)
2. Starts search container (Elasticsearch or OpenSearch)
3. Starts Fuseki SPARQL container (for RDF tests)
4. Starts the OpenMetadata application
5. Initializes `SharedEntities`

All containers are started **once** per test run and shared across all tests.

## Running in CI

GitHub workflows run these tests on every PR:

- `integration-tests-mysql-elasticsearch.yml` - MySQL + Elasticsearch
- `integration-tests-postgres-opensearch.yml` - PostgreSQL + OpenSearch

Tests require the "safe to test" label on PRs.
