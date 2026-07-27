package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;

/**
 * Integration tests for the scope-level stale-deletion endpoint ({@code PUT
 * /v1/tables/deleteStale}).
 *
 * <p>The connector finishes ingesting a scope and sends the set of FQNs it saw. The server
 * soft-deletes the live entities in that scope that are not in the set, and never deletes anything
 * for an empty scope or when every entity was seen.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkDeleteStaleIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  @Test
  void test_deletesTablesNotInSeenSet(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<String> tableFqns = createTables(ns, schemaFqn, 5);

    List<String> seen = tableFqns.subList(0, 3);
    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(seen));

    assertEquals(2, result.getNumberOfRowsPassed().intValue(), "the 2 unseen tables are stale");
    Set<String> deleted = deletedFqns(result);
    assertEquals(Set.copyOf(tableFqns.subList(3, 5)), deleted, "only unseen tables soft-deleted");

    for (String fqn : seen) {
      assertFalse(isDeleted(fqn), "seen table " + fqn + " must remain live");
    }
    for (String fqn : tableFqns.subList(3, 5)) {
      assertTrue(isDeleted(fqn), "unseen table " + fqn + " must be soft-deleted");
    }
  }

  @Test
  void test_dryRun_reportsButDeletesNothing(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<String> tableFqns = createTables(ns, schemaFqn, 4);

    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(tableFqns.subList(0, 2))
                .withDryRun(true));

    assertTrue(Boolean.TRUE.equals(result.getDryRun()), "result is flagged dryRun");
    assertEquals(Set.copyOf(tableFqns.subList(2, 4)), deletedFqns(result), "stale tables reported");
    for (String fqn : tableFqns) {
      assertFalse(isDeleted(fqn), "dryRun must not delete anything: " + fqn);
    }
  }

  @Test
  void test_allTablesSeen_deletesNothing(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<String> tableFqns = createTables(ns, schemaFqn, 3);

    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(tableFqns));

    assertEquals(0, result.getNumberOfRowsPassed().intValue(), "nothing stale when all seen");
    for (String fqn : tableFqns) {
      assertFalse(isDeleted(fqn), "table " + fqn + " must remain live");
    }
  }

  @Test
  void test_emptyScope_deletesNothing(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);

    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(new ArrayList<>()));

    assertEquals(
        0,
        result.getNumberOfRowsProcessed().intValue(),
        "an empty scope must never be treated as fully stale");
  }

  @Test
  void test_emptySeenFqns_withPopulatedScope_deletesNothing(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<String> tableFqns = createTables(ns, schemaFqn, 3);

    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(new ArrayList<>()));

    assertEquals(
        0,
        result.getNumberOfRowsProcessed().intValue(),
        "an empty seenFqns must never mark a populated scope as fully stale");
    for (String fqn : tableFqns) {
      assertFalse(isDeleted(fqn), "table " + fqn + " must remain live when seenFqns is empty");
    }
  }

  @Test
  void test_databaseScope_spansAllSchemas(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, service);
    String databaseFqn = schemaA.getFullyQualifiedName();
    databaseFqn = databaseFqn.substring(0, databaseFqn.lastIndexOf('.'));
    DatabaseSchema schemaB = DatabaseSchemaTestFactory.create(databaseFqn, ns.prefix("schemaB"));

    List<String> schemaATables = createTables(ns, schemaA.getFullyQualifiedName(), 2);
    List<String> schemaBTables = createTables(ns, schemaB.getFullyQualifiedName(), 2);

    // Scope is the whole database; only one table per schema is reported as seen.
    List<String> seen = List.of(schemaATables.get(0), schemaBTables.get(0));
    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(databaseFqn)
                .withScopeEntityType("database")
                .withSeenFqns(seen));

    assertEquals(2, result.getNumberOfRowsPassed().intValue(), "one stale table in each schema");
    assertFalse(isDeleted(schemaATables.get(0)), "seen table in schema A is live");
    assertTrue(isDeleted(schemaATables.get(1)), "unseen table in schema A is deleted");
    assertFalse(isDeleted(schemaBTables.get(0)), "seen table in schema B is live");
    assertTrue(isDeleted(schemaBTables.get(1)), "unseen table in schema B is deleted");
  }

  @Test
  void test_serviceScope_resolvesGenericServiceType(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    List<String> tableFqns = createTables(ns, schema.getFullyQualifiedName(), 3);

    // Connectors scope service-level deletion with the generic "service" key. The server must
    // resolve it to the concrete service type that owns tables (databaseService) rather than
    // rejecting it as an unknown entity type.
    List<String> seen = tableFqns.subList(0, 1);
    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(service.getFullyQualifiedName())
                .withScopeEntityType("service")
                .withSeenFqns(seen));

    assertEquals(
        2, result.getNumberOfRowsPassed().intValue(), "two unseen tables under the service");
    assertFalse(isDeleted(tableFqns.get(0)), "seen table stays live");
    assertTrue(isDeleted(tableFqns.get(1)), "unseen table is soft-deleted");
    assertTrue(isDeleted(tableFqns.get(2)), "unseen table is soft-deleted");
  }

  @Test
  void test_unauthorizedUser_isForbidden(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    createTables(ns, schemaFqn, 2);

    // Ensure the DataConsumer principal exists so the JWT resolves to a real (unprivileged) user;
    // otherwise the server rejects the token with 404 (user not found) instead of 403 (forbidden),
    // which makes the test order-dependent in the suite and fail outright in isolation.
    UserTestFactory.getDataConsumer(ns);
    String dataConsumerToken =
        JwtAuthProvider.tokenFor(
            "data-consumer@open-metadata.org",
            "data-consumer@open-metadata.org",
            new String[] {"DataConsumer"},
            3600);

    HttpResponse<String> response =
        BulkApi.deleteStaleRaw(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(new ArrayList<>()),
            dataConsumerToken);

    assertEquals(403, response.statusCode(), "a user without DELETE permission must be forbidden");
  }

  @Test
  void test_unknownScopeEntityType_returns400(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);

    HttpResponse<String> response =
        BulkApi.deleteStaleRaw(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("notARealEntityType")
                .withSeenFqns(new ArrayList<>()),
            SdkClients.getAdminToken());

    assertEquals(400, response.statusCode(), "unknown scopeEntityType must be rejected");
  }

  @Test
  void test_missingScopeEntityType_returns400(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);

    HttpResponse<String> response =
        BulkApi.deleteStaleRaw(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(schemaFqn)
                .withScopeEntityType("")
                .withSeenFqns(new ArrayList<>()),
            SdkClients.getAdminToken());

    assertEquals(400, response.statusCode(), "blank scopeEntityType must be rejected");
  }

  @Test
  void test_nonExistentScopeFqn_returnsEmptyResult(TestNamespace ns) throws Exception {
    BulkOperationResult result =
        BulkApi.deleteStale(
            "tables",
            new BulkDeleteStaleRequest()
                .withScopeFqn(ns.prefix("does.not.exist"))
                .withScopeEntityType("databaseSchema")
                .withSeenFqns(new ArrayList<>()));

    assertEquals(
        0,
        result.getNumberOfRowsProcessed().intValue(),
        "a non-existent scope is a no-op, not an error");
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private String setupSchema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return schema.getFullyQualifiedName();
  }

  private List<String> createTables(TestNamespace ns, String schemaFqn, int count)
      throws Exception {
    List<CreateTable> batch = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      batch.add(
          new CreateTable()
              .withName(ns.prefix("stale_t" + i))
              .withDatabaseSchema(schemaFqn)
              .withColumns(
                  List.of(new Column().withName("c1").withDataType(ColumnDataType.STRING))));
    }
    BulkOperationResult result = BulkApi.upsert("tables", batch);
    assertEquals(count, result.getNumberOfRowsPassed().intValue(), "all tables created");
    return batch.stream().map(ct -> schemaFqn + "." + ct.getName()).collect(Collectors.toList());
  }

  private Set<String> deletedFqns(BulkOperationResult result) {
    return result.getSuccessRequest().stream()
        .map(BulkResponse::getRequest)
        .map(Object::toString)
        .collect(Collectors.toSet());
  }

  private boolean isDeleted(String fqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/tables/name/"
                        + fqn
                        + "?fields=sourceHash&include=all"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + fqn + ": " + response.body());
    Table table = OBJECT_MAPPER.readValue(response.body(), Table.class);
    assertNotNull(table.getId());
    return Boolean.TRUE.equals(table.getDeleted());
  }
}
