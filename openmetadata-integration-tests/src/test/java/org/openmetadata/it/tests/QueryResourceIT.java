package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.RandomStringUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Query entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds query-specific tests for query
 * attributes and usage.
 *
 * <p>Migrated from: org.openmetadata.service.resources.query.QueryResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class QueryResourceIT extends BaseEntityIT<Query, CreateQuery> {

  // Query has special name handling (null names allowed, uses checksum)
  // Query doesn't support dataProducts field
  // Query API doesn't expose include parameter for soft delete operations
  {
    supportsNameLengthValidation = false;
    supportsDataProducts = false;
    supportsSoftDelete = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateQuery createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    return new CreateQuery()
        .withName(ns.prefix("query"))
        .withDescription("Test query created by integration test")
        .withQuery("SELECT * FROM " + RandomStringUtils.randomAlphabetic(10))
        .withQueryUsedIn(List.of(table.getEntityReference()))
        .withService(service.getFullyQualifiedName())
        .withDuration(0.0)
        .withQueryDate(System.currentTimeMillis());
  }

  @Override
  protected CreateQuery createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    return new CreateQuery()
        .withName(name)
        .withDescription("Test query")
        .withQuery("SELECT * FROM " + RandomStringUtils.randomAlphabetic(10))
        .withQueryUsedIn(List.of(table.getEntityReference()))
        .withService(service.getFullyQualifiedName())
        .withDuration(0.0)
        .withQueryDate(System.currentTimeMillis());
  }

  private Table getOrCreateTable(TestNamespace ns, OpenMetadataClient client) {
    String shortId = ns.shortPrefix();

    // Create service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg_q_" + shortId)
            .connection(conn)
            .description("Test Postgres service for Query tests")
            .create();

    // Create database
    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db_q_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database = client.databases().create(dbReq);

    // Create schema
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_q_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    // Create table
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_q_" + shortId);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return client.tables().create(tableRequest);
  }

  private DatabaseService getOrCreateDatabaseService(TestNamespace ns, OpenMetadataClient client) {
    String shortId = ns.shortPrefix();
    String serviceName = "pg_q_" + shortId;

    try {
      return client.databaseServices().getByName(serviceName);
    } catch (Exception e) {
      org.openmetadata.schema.services.connections.database.PostgresConnection conn =
          org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
              .hostPort("localhost:5432")
              .username("test")
              .build();

      return org.openmetadata.sdk.fluent.DatabaseServices.builder()
          .name(serviceName)
          .connection(conn)
          .description("Test Postgres service for Query tests")
          .create();
    }
  }

  @Override
  protected Query createEntity(CreateQuery createRequest, OpenMetadataClient client) {
    return client.queries().create(createRequest);
  }

  @Override
  protected Query getEntity(String id, OpenMetadataClient client) {
    return client.queries().get(id);
  }

  @Override
  protected Query getEntityByName(String fqn, OpenMetadataClient client) {
    return client.queries().getByName(fqn);
  }

  @Override
  protected Query patchEntity(String id, Query entity, OpenMetadataClient client) {
    return client.queries().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.queries().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.queries().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.queries().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "query";
  }

  @Override
  protected void validateCreatedEntity(Query entity, CreateQuery createRequest) {
    assertEquals(createRequest.getQuery(), entity.getQuery());
    assertNotNull(entity.getChecksum(), "Query must have a checksum");

    if (createRequest.getName() != null) {
      assertEquals(createRequest.getName(), entity.getName());
    }

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<Query> listEntities(ListParams params, OpenMetadataClient client) {
    return client.queries().list(params);
  }

  @Override
  protected Query getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.queries().get(id, fields);
  }

  @Override
  protected Query getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.queries().getByName(fqn, fields);
  }

  @Override
  protected Query getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.queries().get(id, "owners,followers,users,votes,tags,queryUsedIn", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.queries().getVersionList(id);
  }

  @Override
  protected Query getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.queries().getVersion(id.toString(), version);
  }

  // ===================================================================
  // QUERY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_validQuery_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("valid_query"))
            .withQuery("SELECT * FROM users WHERE active = true")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(1.5)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    assertNotNull(query);
    assertEquals("SELECT * FROM users WHERE active = true", query.getQuery());
    assertNotNull(query.getChecksum());
  }

  @Test
  void post_queryWithoutQuery_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    // Query text is required
    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("no_query_text"))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating query without query text should fail");
  }

  @Test
  void put_queryDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_update_desc"))
            .withDescription("Initial description")
            .withQuery("SELECT COUNT(*) FROM orders")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    assertEquals("Initial description", query.getDescription());

    // Update description
    query.setDescription("Updated description");
    Query updated = patchEntity(query.getId().toString(), query, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void post_duplicateQuery_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    String queryName = ns.prefix("dup_query");
    CreateQuery request1 =
        new CreateQuery()
            .withName(queryName)
            .withQuery("SELECT * FROM products")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request1, client);
    assertNotNull(query);

    // Attempt to create duplicate
    CreateQuery request2 =
        new CreateQuery()
            .withName(queryName)
            .withQuery("SELECT * FROM products") // same query text
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate query should fail");
  }

  @Test
  void test_queryWithQueryUsedIn(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_used_in"))
            .withQuery("SELECT id, name FROM customers LIMIT 100")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(2.5)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    assertNotNull(query);

    // Get with fields to verify queryUsedIn
    Query fetched = getEntityWithFields(query.getId().toString(), "queryUsedIn", client);
    assertNotNull(fetched.getQueryUsedIn());
    assertFalse(fetched.getQueryUsedIn().isEmpty());

    // Verify table reference is present
    List<EntityReference> queryUsedIn = fetched.getQueryUsedIn();
    assertTrue(
        queryUsedIn.stream().anyMatch(ref -> ref.getId().equals(table.getId())),
        "Query should reference the table it was used in");
  }

  @Test
  void test_queryChecksumUpdatesWithQueryText(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_checksum"))
            .withQuery("SELECT original FROM test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    String originalChecksum = query.getChecksum();
    assertNotNull(originalChecksum);

    // Update query text - checksum should change
    query.setQuery("SELECT updated FROM test");
    Query updated = patchEntity(query.getId().toString(), query, client);

    assertNotNull(updated.getChecksum());
    assertNotEquals(
        originalChecksum, updated.getChecksum(), "Checksum should change when query text changes");
  }

  @Test
  void patch_queryAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_patch"))
            .withQuery("SELECT * FROM patch_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(1.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);

    // Patch duration
    query.setDuration(5.0);
    Query patched = patchEntity(query.getId().toString(), query, client);
    assertEquals(5.0, patched.getDuration());

    // Patch description
    patched.setDescription("Patched description");
    Query patched2 = patchEntity(patched.getId().toString(), patched, client);
    assertEquals("Patched description", patched2.getDescription());
  }

  @Test
  void test_queryVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_versions"))
            .withQuery("SELECT * FROM version_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDescription("Version 1")
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    Double v1 = query.getVersion();

    // Update description
    query.setDescription("Version 2");
    Query v2Query = patchEntity(query.getId().toString(), query, client);
    assertTrue(v2Query.getVersion() > v1);

    // Get version history
    EntityHistory history = client.queries().getVersionList(query.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_queryWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_with_owner"))
            .withQuery("SELECT * FROM owner_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withOwners(List.of(testUser1().getEntityReference()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    assertNotNull(query);

    // Verify owner
    Query fetched = client.queries().get(query.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertTrue(fetched.getOwners().stream().anyMatch(o -> o.getId().equals(testUser1().getId())));
  }

  @Test
  void test_queryHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_hard_delete"))
            .withQuery("SELECT * FROM delete_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    String queryId = query.getId().toString();

    // Hard delete
    hardDeleteEntity(queryId, client);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntity(queryId, client),
        "Hard deleted query should not be retrievable");
  }

  @Test
  void list_queries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    // Create multiple queries
    for (int i = 0; i < 3; i++) {
      CreateQuery request =
          new CreateQuery()
              .withName(ns.prefix("query_list_" + i))
              .withQuery("SELECT " + i + " FROM test_" + i)
              .withQueryUsedIn(List.of(table.getEntityReference()))
              .withService(service.getFullyQualifiedName())
              .withDuration(0.0)
              .withQueryDate(System.currentTimeMillis());
      createEntity(request, client);
    }

    // List queries
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Query> response = listEntities(params, client);

    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_queryWithDuration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns, client);
    DatabaseService service = getOrCreateDatabaseService(ns, client);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_duration"))
            .withQuery("SELECT * FROM duration_test WHERE complex_condition = true")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(15.75)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request, client);
    assertEquals(15.75, query.getDuration());

    // Update duration
    query.setDuration(25.5);
    Query updated = patchEntity(query.getId().toString(), query, client);
    assertEquals(25.5, updated.getDuration());
  }
}
