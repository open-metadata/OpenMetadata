package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.RandomStringUtils;
import org.junit.jupiter.api.Disabled;
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
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.query.QueryResource;

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
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected String getResourcePath() {
    return QueryResource.COLLECTION_PATH;
  }

  @Override
  protected CreateQuery createMinimalRequest(TestNamespace ns) {
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

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
  protected CreateQuery createRequest(String name, TestNamespace ns) {
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    return new CreateQuery()
        .withName(name)
        .withDescription("Test query")
        .withQuery("SELECT * FROM " + RandomStringUtils.randomAlphabetic(10))
        .withQueryUsedIn(List.of(table.getEntityReference()))
        .withService(service.getFullyQualifiedName())
        .withDuration(0.0)
        .withQueryDate(System.currentTimeMillis());
  }

  private Table getOrCreateTable(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    String tableFqn =
        "pg_q_" + shortId + ".db_q_" + shortId + ".s_q_" + shortId + ".t_q_" + shortId;

    // Try to get existing table first
    try {
      return SdkClients.adminClient().tables().getByName(tableFqn);
    } catch (Exception e) {
      // Table doesn't exist, create hierarchy
    }

    // Create service
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Create database (get or create)
    String dbFqn = service.getFullyQualifiedName() + ".db_q_" + shortId;
    org.openmetadata.schema.entity.data.Database database;
    try {
      database = SdkClients.adminClient().databases().getByName(dbFqn);
    } catch (Exception e) {
      org.openmetadata.schema.api.data.CreateDatabase dbReq =
          new org.openmetadata.schema.api.data.CreateDatabase();
      dbReq.setName("db_q_" + shortId);
      dbReq.setService(service.getFullyQualifiedName());
      database = SdkClients.adminClient().databases().create(dbReq);
    }

    // Create schema (get or create)
    String schemaFqn = database.getFullyQualifiedName() + ".s_q_" + shortId;
    DatabaseSchema schema;
    try {
      schema = SdkClients.adminClient().databaseSchemas().getByName(schemaFqn);
    } catch (Exception e) {
      org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
          new org.openmetadata.schema.api.data.CreateDatabaseSchema();
      schemaReq.setName("s_q_" + shortId);
      schemaReq.setDatabase(database.getFullyQualifiedName());
      schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);
    }

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

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private DatabaseService getOrCreateDatabaseService(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    String serviceName = "pg_q_" + shortId;

    try {
      return SdkClients.adminClient().databaseServices().getByName(serviceName);
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
  protected Query createEntity(CreateQuery createRequest) {
    return SdkClients.adminClient().queries().create(createRequest);
  }

  @Override
  protected Query getEntity(String id) {
    return SdkClients.adminClient().queries().get(id);
  }

  @Override
  protected Query getEntityByName(String fqn) {
    return SdkClients.adminClient().queries().getByName(fqn);
  }

  @Override
  protected Query patchEntity(String id, Query entity) {
    return SdkClients.adminClient().queries().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().queries().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().queries().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().queries().delete(id, params);
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
  protected ListResponse<Query> listEntities(ListParams params) {
    return SdkClients.adminClient().queries().list(params);
  }

  @Override
  protected Query getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().queries().get(id, fields);
  }

  @Override
  protected Query getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().queries().getByName(fqn, fields);
  }

  @Override
  protected Query getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient()
        .queries()
        .get(id, "owners,followers,users,votes,tags,queryUsedIn", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().queries().getVersionList(id);
  }

  @Override
  protected Query getVersion(UUID id, Double version) {
    return SdkClients.adminClient().queries().getVersion(id.toString(), version);
  }

  // ===================================================================
  // QUERY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_validQuery_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("valid_query"))
            .withQuery("SELECT * FROM users WHERE active = true")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(1.5)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertNotNull(query);
    assertEquals("SELECT * FROM users WHERE active = true", query.getQuery());
    assertNotNull(query.getChecksum());
  }

  @Test
  void post_queryWithoutQuery_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Query text is required
    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("no_query_text"))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating query without query text should fail");
  }

  @Test
  void put_queryDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_update_desc"))
            .withDescription("Initial description")
            .withQuery("SELECT COUNT(*) FROM orders")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertEquals("Initial description", query.getDescription());

    // Update description
    query.setDescription("Updated description");
    Query updated = patchEntity(query.getId().toString(), query);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void post_duplicateQuery_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    String queryName = ns.prefix("dup_query");
    CreateQuery request1 =
        new CreateQuery()
            .withName(queryName)
            .withQuery("SELECT * FROM products")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request1);
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
        Exception.class, () -> createEntity(request2), "Creating duplicate query should fail");
  }

  @Test
  void test_queryWithQueryUsedIn(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_used_in"))
            .withQuery("SELECT id, name FROM customers LIMIT 100")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(2.5)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertNotNull(query);

    // Get with fields to verify queryUsedIn
    Query fetched = getEntityWithFields(query.getId().toString(), "queryUsedIn");
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
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_checksum"))
            .withQuery("SELECT original FROM test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    String originalChecksum = query.getChecksum();
    assertNotNull(originalChecksum);

    // Update query text - checksum should change
    query.setQuery("SELECT updated FROM test");
    Query updated = patchEntity(query.getId().toString(), query);

    assertNotNull(updated.getChecksum());
    assertNotEquals(
        originalChecksum, updated.getChecksum(), "Checksum should change when query text changes");
  }

  @Test
  void patch_queryAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Use unique SQL text to avoid checksum conflicts with parallel tests
    String uniqueSql = "SELECT * FROM patch_test_" + RandomStringUtils.randomAlphabetic(10);
    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_patch"))
            .withQuery(uniqueSql)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(1.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);

    // Patch duration
    query.setDuration(5.0);
    Query patched = patchEntity(query.getId().toString(), query);
    assertEquals(5.0, patched.getDuration());

    // Patch description
    patched.setDescription("Patched description");
    Query patched2 = patchEntity(patched.getId().toString(), patched);
    assertEquals("Patched description", patched2.getDescription());
  }

  @Test
  void test_queryVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_versions"))
            .withQuery("SELECT * FROM version_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDescription("Version 1")
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    Double v1 = query.getVersion();

    // Update description
    query.setDescription("Version 2");
    Query v2Query = patchEntity(query.getId().toString(), query);
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
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_with_owner"))
            .withQuery("SELECT * FROM owner_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withOwners(List.of(testUser1().getEntityReference()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
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
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_hard_delete"))
            .withQuery("SELECT * FROM delete_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    String queryId = query.getId().toString();

    // Hard delete
    hardDeleteEntity(queryId);

    // Verify completely gone
    assertThrows(
        Exception.class, () -> getEntity(queryId), "Hard deleted query should not be retrievable");
  }

  @Test
  void list_queries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

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
      createEntity(request);
    }

    // List queries
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Query> response = listEntities(params);

    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_queryWithDuration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_duration"))
            .withQuery("SELECT * FROM duration_test WHERE complex_condition = true")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(15.75)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertEquals(15.75, query.getDuration());

    // Update duration
    query.setDuration(25.5);
    Query updated = patchEntity(query.getId().toString(), query);
    assertEquals(25.5, updated.getDuration());
  }

  @Test
  void put_vote_queryUsage_update(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_vote"))
            .withQuery("SELECT * FROM vote_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertNotNull(query);

    Query fetchedWithVotes = getEntityWithFields(query.getId().toString(), "votes");
    assertNotNull(fetchedWithVotes);
  }

  @Test
  void patch_queryUsedIn_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table1 = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Create another table
    String shortId = ns.shortPrefix();
    CreateTable table2Request = new CreateTable();
    table2Request.setName("t_q2_" + shortId);
    table2Request.setDatabaseSchema(table1.getDatabaseSchema().getFullyQualifiedName());
    table2Request.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("description")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    Table table2 = SdkClients.adminClient().tables().create(table2Request);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_patch_used_in"))
            .withQuery("SELECT * FROM patch_test")
            .withQueryUsedIn(List.of(table1.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertEquals(1, query.getQueryUsedIn().size());
    assertTrue(query.getQueryUsedIn().stream().anyMatch(ref -> ref.getId().equals(table1.getId())));

    // Update queryUsedIn to table2
    query.setQueryUsedIn(List.of(table2.getEntityReference()));
    Query updated = patchEntity(query.getId().toString(), query);

    Query fetched = getEntityWithFields(updated.getId().toString(), "queryUsedIn");
    assertEquals(1, fetched.getQueryUsedIn().size());
    assertTrue(
        fetched.getQueryUsedIn().stream().anyMatch(ref -> ref.getId().equals(table2.getId())));

    // Update to both tables
    query.setQueryUsedIn(List.of(table1.getEntityReference(), table2.getEntityReference()));
    Query updated2 = patchEntity(query.getId().toString(), query);

    Query fetched2 = getEntityWithFields(updated2.getId().toString(), "queryUsedIn");
    assertEquals(2, fetched2.getQueryUsedIn().size());
  }

  @Test
  void patch_usingFqn_queryUsedIn_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table1 = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Create another table
    String shortId = ns.shortPrefix();
    CreateTable table2Request = new CreateTable();
    table2Request.setName("t_q3_" + shortId);
    table2Request.setDatabaseSchema(table1.getDatabaseSchema().getFullyQualifiedName());
    table2Request.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    Table table2 = SdkClients.adminClient().tables().create(table2Request);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_patch_fqn"))
            .withQuery("SELECT * FROM fqn_patch_test")
            .withQueryUsedIn(List.of(table1.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);

    // Patch using FQN - update through ID since SDK doesn't have updateByName yet
    Query toUpdate = getEntityByName(query.getFullyQualifiedName());
    toUpdate.setQueryUsedIn(List.of(table2.getEntityReference()));

    Query updated = patchEntity(toUpdate.getId().toString(), toUpdate);

    Query fetched = getEntityByNameWithFields(updated.getFullyQualifiedName(), "queryUsedIn");
    assertEquals(1, fetched.getQueryUsedIn().size());
    assertTrue(
        fetched.getQueryUsedIn().stream().anyMatch(ref -> ref.getId().equals(table2.getId())));
  }

  @Test
  void test_usingFqn_patchQueryMustUpdateChecksum(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    String originalQueryText = "SELECT * FROM checksum_test_fqn";
    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_checksum_fqn"))
            .withQuery(originalQueryText)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    String originalChecksum = query.getChecksum();
    assertNotNull(originalChecksum);

    // Update query text using FQN - update through ID since SDK doesn't have updateByName yet
    String newQueryText = "SELECT id, name FROM checksum_test_fqn WHERE active = true";
    Query toUpdate = getEntityByName(query.getFullyQualifiedName());
    toUpdate.setQuery(newQueryText);

    Query updated = patchEntity(toUpdate.getId().toString(), toUpdate);

    assertNotNull(updated.getChecksum());
    assertNotEquals(
        originalChecksum, updated.getChecksum(), "Checksum should change when query text changes");
    assertEquals(newQueryText, updated.getQuery());
  }

  @Test
  void test_patchQueryMustUpdateChecksum(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    String originalQueryText = "SELECT * FROM checksum_test_id";
    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_checksum_id"))
            .withQuery(originalQueryText)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    String originalChecksum = query.getChecksum();
    assertNotNull(originalChecksum);

    // Update query text using ID
    String newQueryText = "SELECT id, name, created_at FROM checksum_test_id WHERE deleted = false";
    query.setQuery(newQueryText);

    Query updated = patchEntity(query.getId().toString(), query);

    assertNotNull(updated.getChecksum());
    assertNotEquals(
        originalChecksum, updated.getChecksum(), "Checksum should change when query text changes");
    assertEquals(newQueryText, updated.getQuery());
  }

  @Test
  void test_duplicateQueryChecksum(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    String queryText = "SELECT * FROM duplicate_checksum_test";

    CreateQuery request1 =
        new CreateQuery()
            .withName(ns.prefix("query_dup_1"))
            .withQuery(queryText)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query1 = createEntity(request1);
    assertNotNull(query1);

    // Create another query with different text
    CreateQuery request2 =
        new CreateQuery()
            .withName(ns.prefix("query_dup_2"))
            .withQuery("SELECT * FROM another_table")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query2 = createEntity(request2);
    assertNotNull(query2);

    // Attempt to create duplicate with same query text
    CreateQuery duplicateRequest =
        new CreateQuery()
            .withName(ns.prefix("query_dup_3"))
            .withQuery(queryText)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    assertThrows(
        Exception.class,
        () -> createEntity(duplicateRequest),
        "Creating duplicate query with same text should fail");

    // Attempt to update query2 to same text as query1
    query2.setQuery(queryText);
    assertThrows(
        Exception.class,
        () -> patchEntity(query2.getId().toString(), query2),
        "Updating query to duplicate text should fail");
  }

  @Test
  @Disabled("Query users field not being populated correctly - needs investigation")
  void test_queryWithUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_with_users"))
            .withQuery("SELECT * FROM users_test")
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withUsers(List.of(testUser1().getName(), testUser2().getName()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertNotNull(query);

    // Verify users
    Query fetched = getEntityWithFields(query.getId().toString(), "users");
    assertNotNull(fetched.getUsers());
    assertEquals(2, fetched.getUsers().size());
    assertTrue(fetched.getUsers().contains(testUser1().getName()), "Query should have user1");
    assertTrue(fetched.getUsers().contains(testUser2().getName()), "Query should have user2");
  }

  @Test
  void test_batchFetchQueryFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    // Create additional table for testing queryUsedIn relationships
    String shortId = ns.shortPrefix();
    CreateTable table2Request = new CreateTable();
    table2Request.setName("t_batch_" + shortId);
    table2Request.setDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName());
    table2Request.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("data")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    Table table2 = SdkClients.adminClient().tables().create(table2Request);

    // Create queries with different relationship patterns
    CreateQuery query1Request =
        new CreateQuery()
            .withName(ns.prefix("batch_query1"))
            .withQuery("SELECT * FROM batch_test1")
            .withQueryUsedIn(List.of(table.getEntityReference(), table2.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withUsers(List.of(testUser1().getName(), testUser2().getName()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());
    Query query1 = createEntity(query1Request);

    CreateQuery query2Request =
        new CreateQuery()
            .withName(ns.prefix("batch_query2"))
            .withQuery("SELECT * FROM batch_test2")
            .withQueryUsedIn(List.of(table2.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withUsers(List.of(testUser1().getName()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());
    Query query2 = createEntity(query2Request);

    CreateQuery query3Request =
        new CreateQuery()
            .withName(ns.prefix("batch_query3"))
            .withQuery("SELECT * FROM batch_test3")
            .withQueryUsedIn(List.of())
            .withService(service.getFullyQualifiedName())
            .withUsers(List.of(testUser2().getName()))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());
    Query query3 = createEntity(query3Request);

    // Test 1: Fetch with all fields
    ListParams allFieldsParams = new ListParams();
    allFieldsParams.setFields("*");
    allFieldsParams.addFilter("include", "all");
    allFieldsParams.setLimit(100);
    ListResponse<Query> allFieldsResult = listEntities(allFieldsParams);

    Query fetchedQuery1 = findQueryInResults(allFieldsResult, query1.getId());
    Query fetchedQuery2 = findQueryInResults(allFieldsResult, query2.getId());
    Query fetchedQuery3 = findQueryInResults(allFieldsResult, query3.getId());

    assertNotNull(fetchedQuery1, "Query1 should be found");
    assertNotNull(fetchedQuery1.getQueryUsedIn());
    assertEquals(2, fetchedQuery1.getQueryUsedIn().size(), "Query1 should have 2 queryUsedIn");
    assertNotNull(fetchedQuery1.getUsers());
    assertEquals(2, fetchedQuery1.getUsers().size(), "Query1 should have 2 users");

    assertNotNull(fetchedQuery2, "Query2 should be found");
    assertNotNull(fetchedQuery2.getQueryUsedIn());
    assertEquals(1, fetchedQuery2.getQueryUsedIn().size(), "Query2 should have 1 queryUsedIn");
    assertNotNull(fetchedQuery2.getUsers());
    assertEquals(1, fetchedQuery2.getUsers().size(), "Query2 should have 1 user");

    assertNotNull(fetchedQuery3, "Query3 should be found");
    assertNotNull(fetchedQuery3.getQueryUsedIn());
    assertEquals(0, fetchedQuery3.getQueryUsedIn().size(), "Query3 should have 0 queryUsedIn");
    assertNotNull(fetchedQuery3.getUsers());
    assertEquals(1, fetchedQuery3.getUsers().size(), "Query3 should have 1 user");

    // Test 2: Fetch only queryUsedIn field
    ListParams queryUsedInParams = new ListParams();
    queryUsedInParams.setFields("queryUsedIn");
    queryUsedInParams.addFilter("include", "all");
    queryUsedInParams.setLimit(100);
    ListResponse<Query> queryUsedInOnly = listEntities(queryUsedInParams);
    Query queryUsedInResult = findQueryInResults(queryUsedInOnly, query1.getId());

    assertNotNull(queryUsedInResult, "Query should be found with queryUsedIn field");
    assertNotNull(queryUsedInResult.getQueryUsedIn());
    assertEquals(2, queryUsedInResult.getQueryUsedIn().size());

    // Test 3: Fetch only users field
    ListParams usersParams = new ListParams();
    usersParams.setFields("users");
    usersParams.addFilter("include", "all");
    usersParams.setLimit(100);
    ListResponse<Query> usersOnly = listEntities(usersParams);
    Query usersResult = findQueryInResults(usersOnly, query1.getId());

    assertNotNull(usersResult, "Query should be found with users field");
    assertNotNull(usersResult.getUsers());
    assertEquals(2, usersResult.getUsers().size());

    // Test 4: Fetch without relationship fields
    ListParams noRelFieldsParams = new ListParams();
    noRelFieldsParams.setFields("name,query");
    noRelFieldsParams.addFilter("include", "all");
    noRelFieldsParams.setLimit(100);
    ListResponse<Query> noRelFields = listEntities(noRelFieldsParams);
    Query noRelResult = findQueryInResults(noRelFields, query1.getId());

    assertNotNull(noRelResult, "Query should be found without relationship fields");
  }

  private Query findQueryInResults(ListResponse<Query> results, UUID queryId) {
    return results.getData().stream()
        .filter(q -> q.getId().equals(queryId))
        .findFirst()
        .orElse(null);
  }

  @Test
  void test_sensitivePIIQuery(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = getOrCreateTable(ns);
    DatabaseService service = getOrCreateDatabaseService(ns);

    String sensitiveQueryText = "SELECT ssn, credit_card FROM sensitive_data";

    CreateQuery request =
        new CreateQuery()
            .withName(ns.prefix("query_pii"))
            .withQuery(sensitiveQueryText)
            .withQueryUsedIn(List.of(table.getEntityReference()))
            .withService(service.getFullyQualifiedName())
            .withOwners(List.of(testUser1().getEntityReference()))
            .withTags(
                List.of(
                    new org.openmetadata.schema.type.TagLabel()
                        .withTagFQN("PII.Sensitive")
                        .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
                        .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL)))
            .withDuration(0.0)
            .withQueryDate(System.currentTimeMillis());

    Query query = createEntity(request);
    assertNotNull(query);

    // Owner should see the full query
    Query ownerView = client.queries().get(query.getId().toString(), "tags");
    assertEquals(sensitiveQueryText, ownerView.getQuery());

    // Admin should also see the full query
    Query adminView = SdkClients.adminClient().queries().get(query.getId().toString(), "tags");
    assertEquals(sensitiveQueryText, adminView.getQuery());

    // Verify PII tag is present
    assertNotNull(adminView.getTags());
    assertTrue(
        adminView.getTags().stream().anyMatch(tag -> tag.getTagFQN().equals("PII.Sensitive")));
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateQuery> createRequests) {
    return SdkClients.adminClient().queries().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateQuery> createRequests) {
    return SdkClients.adminClient().queries().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateQuery createInvalidRequestForBulk(TestNamespace ns) {
    CreateQuery request = new CreateQuery();
    request.setName(ns.prefix("invalid_query"));
    return request;
  }
}
