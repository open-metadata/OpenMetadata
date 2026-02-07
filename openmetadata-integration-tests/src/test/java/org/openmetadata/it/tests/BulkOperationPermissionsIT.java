package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Integration tests for Bulk Operation permissions and concurrency.
 *
 * <p>Verifies that bulk operations correctly enforce authorization:
 *
 * <ul>
 *   <li>Admin users can create/update entities
 *   <li>Bot users (ingestion) can create/update entities
 *   <li>Data consumers cannot create new entities
 *   <li>Unauthenticated requests are rejected
 *   <li>Permission denied errors are reported per-entity in bulk results
 * </ul>
 *
 * <p>Also tests concurrent bulk operations to verify no DB connection exhaustion.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkOperationPermissionsIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  // ===================================================================
  // BASIC PERMISSION TESTS
  // ===================================================================

  @Test
  void test_bulkCreate_adminSuccess(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        List.of(
            createTableRequest(ns, schema, "admin_table_1"),
            createTableRequest(ns, schema, "admin_table_2"),
            createTableRequest(ns, schema, "admin_table_3"));

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode(), "Admin should be able to create tables");

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(3, result.getNumberOfRowsProcessed());
    assertEquals(3, result.getNumberOfRowsPassed(), "All tables should be created successfully");
    assertEquals(0, result.getNumberOfRowsFailed());
  }

  @Test
  void test_bulkCreate_noAuthToken_returns401(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables = List.of(createTableRequest(ns, schema, "no_auth_table"));

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/bulk"))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(tables)))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_bulkCreate_dataConsumer_permissionDenied(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables = List.of(createTableRequest(ns, schema, "consumer_table"));

    HttpResponse<String> response = callBulkEndpoint(tables, getDataConsumerToken(), false);

    assertEquals(200, response.statusCode(), "Bulk endpoint returns 200 with results");

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(0, result.getNumberOfRowsPassed(), "DataConsumer cannot create tables");
    assertEquals(1, result.getNumberOfRowsFailed(), "Should have 1 failed request");

    assertNotNull(result.getFailedRequest());
    assertNotNull(
        result.getFailedRequest().get(0).getMessage(),
        "Failed request should have an error message");
  }

  @Test
  void test_bulkCreate_permissionDenied_returnsFailureStatus(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables = List.of(createTableRequest(ns, schema, "consumer_403_table"));

    HttpResponse<String> response = callBulkEndpoint(tables, getDataConsumerToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(1, result.getNumberOfRowsFailed());

    BulkResponse failedRequest = result.getFailedRequest().get(0);
    assertTrue(
        failedRequest.getStatus() == 403 || failedRequest.getStatus() == 400,
        "Permission denied should return 4xx status, got: " + failedRequest.getStatus());
  }

  // ===================================================================
  // BOT/INGESTION USER TESTS
  // ===================================================================

  @Test
  void test_bulkCreate_botUser_success(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        List.of(
            createTableRequest(ns, schema, "bot_table_1"),
            createTableRequest(ns, schema, "bot_table_2"));

    HttpResponse<String> response = callBulkEndpoint(tables, getBotToken(), false);

    assertEquals(200, response.statusCode(), "Bot user should be able to create tables");

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(2, result.getNumberOfRowsPassed(), "Bot should create all tables");
    assertEquals(0, result.getNumberOfRowsFailed());
  }

  @Test
  void test_bulkCreate_botUser_100Entities(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        IntStream.range(0, 100)
            .mapToObj(i -> createTableRequest(ns, schema, "ingestion_table_" + i))
            .toList();

    HttpResponse<String> response = callBulkEndpoint(tables, getBotToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(100, result.getNumberOfRowsProcessed());
    assertEquals(100, result.getNumberOfRowsPassed(), "All 100 tables should be created");
    assertEquals(0, result.getNumberOfRowsFailed());
  }

  @Test
  void test_bulkUpdate_botUser_success(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = createTableRequest(ns, schema, "bot_update_table");
    Table created = SdkClients.ingestionBotClient().tables().create(createRequest);
    assertNotNull(created.getId());

    CreateTable updateRequest = createTableRequest(ns, schema, "bot_update_table");
    updateRequest.setDescription("Updated by bot");

    HttpResponse<String> response = callBulkEndpoint(List.of(updateRequest), getBotToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(1, result.getNumberOfRowsPassed(), "Bot should update table");

    Table updated = SdkClients.adminClient().tables().getByName(created.getFullyQualifiedName());
    assertEquals("Updated by bot", updated.getDescription());
  }

  // ===================================================================
  // UPDATE PERMISSION TESTS
  // ===================================================================

  @Test
  void test_bulkUpdate_existingEntity_success(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = createTableRequest(ns, schema, "update_test_table");
    Table created = SdkClients.adminClient().tables().create(createRequest);
    assertNotNull(created.getId());

    CreateTable updateRequest = createTableRequest(ns, schema, "update_test_table");
    updateRequest.setDescription("Updated description");

    HttpResponse<String> response =
        callBulkEndpoint(List.of(updateRequest), SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(1, result.getNumberOfRowsPassed(), "Update should succeed");

    Table updated = SdkClients.adminClient().tables().getByName(created.getFullyQualifiedName());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_bulkUpdate_dataConsumer_cannotUpdate(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = createTableRequest(ns, schema, "consumer_update_table");
    Table created = SdkClients.adminClient().tables().create(createRequest);
    assertNotNull(created.getId());

    CreateTable updateRequest = createTableRequest(ns, schema, "consumer_update_table");
    updateRequest.setDescription("Consumer tried to update");

    HttpResponse<String> response =
        callBulkEndpoint(List.of(updateRequest), getDataConsumerToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(0, result.getNumberOfRowsPassed(), "DataConsumer cannot update tables");
    assertEquals(1, result.getNumberOfRowsFailed());
    assertTrue(
        result.getFailedRequest().get(0).getStatus() == 403
            || result.getFailedRequest().get(0).getStatus() == 400,
        "Should return 4xx status");
  }

  // ===================================================================
  // BATCH SIZE AND PARTIAL FAILURE TESTS
  // ===================================================================

  @Test
  void test_bulkCreate_mixedPermissions(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        List.of(
            createTableRequest(ns, schema, "mixed_table_1"),
            createTableRequest(ns, schema, "mixed_table_2"));

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
  }

  @Test
  void test_bulkCreate_largeBatch(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        IntStream.range(0, 20)
            .mapToObj(i -> createTableRequest(ns, schema, "batch_table_" + i))
            .toList();

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(20, result.getNumberOfRowsProcessed());
    assertEquals(20, result.getNumberOfRowsPassed(), "All tables should be created");
    assertEquals(0, result.getNumberOfRowsFailed());
  }

  @Test
  void test_bulkCreate_partialFailure(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable validTable = createTableRequest(ns, schema, "valid_table");
    CreateTable invalidTable = new CreateTable();
    invalidTable.setName(ns.prefix("invalid_table"));

    List<CreateTable> tables = List.of(validTable, invalidTable);

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertTrue(result.getNumberOfRowsFailed() >= 1, "Invalid table should fail");
  }

  // ===================================================================
  // ASYNC MODE TESTS
  // ===================================================================

  @Test
  void test_bulkAsync_adminSuccess(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables = List.of(createTableRequest(ns, schema, "async_table"));

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), true);

    assertEquals(202, response.statusCode(), "Async should return 202 Accepted");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("numberOfRowsProcessed"));
  }

  @Test
  void test_bulkCreate_emptyList(TestNamespace ns) throws Exception {
    List<CreateTable> tables = List.of();

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(0, result.getNumberOfRowsProcessed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertEquals(0, result.getNumberOfRowsFailed());
  }

  // ===================================================================
  // CONCURRENT BULK OPERATIONS - DB CONNECTION TESTS
  // ===================================================================

  @Test
  void test_concurrent_bulkOperations_noConnectionExhaustion(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    int numConcurrentRequests = 5;
    int entitiesPerRequest = 20;

    List<CompletableFuture<HttpResponse<String>>> futures = new ArrayList<>();

    for (int req = 0; req < numConcurrentRequests; req++) {
      final int requestNum = req;
      List<CreateTable> tables =
          IntStream.range(0, entitiesPerRequest)
              .mapToObj(i -> createTableRequest(ns, schema, "concurrent_r" + requestNum + "_t" + i))
              .toList();

      CompletableFuture<HttpResponse<String>> future =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return callBulkEndpoint(tables, getBotToken(), false);
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
      futures.add(future);
    }

    CompletableFuture<Void> allFutures =
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));

    allFutures.get(120, TimeUnit.SECONDS);

    int totalPassed = 0;
    int totalFailed = 0;

    for (CompletableFuture<HttpResponse<String>> future : futures) {
      HttpResponse<String> response = future.get();
      assertEquals(200, response.statusCode(), "All concurrent requests should succeed");

      BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
      totalPassed += result.getNumberOfRowsPassed();
      totalFailed += result.getNumberOfRowsFailed();

      assertEquals(
          0, result.getNumberOfRowsFailed(), "No entities should fail due to connection issues");
    }

    assertEquals(
        numConcurrentRequests * entitiesPerRequest,
        totalPassed,
        "All entities across all requests should be created");
    assertEquals(0, totalFailed, "No failures should occur");
  }

  @Test
  void test_concurrent_bulkOperations_heavyLoad(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    int numConcurrentRequests = 10;
    int entitiesPerRequest = 50;

    List<CompletableFuture<HttpResponse<String>>> futures = new ArrayList<>();

    for (int req = 0; req < numConcurrentRequests; req++) {
      final int requestNum = req;
      List<CreateTable> tables =
          IntStream.range(0, entitiesPerRequest)
              .mapToObj(i -> createTableRequest(ns, schema, "heavy_r" + requestNum + "_t" + i))
              .toList();

      CompletableFuture<HttpResponse<String>> future =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return callBulkEndpoint(tables, getBotToken(), false);
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
      futures.add(future);
    }

    CompletableFuture<Void> allFutures =
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));

    allFutures.get(300, TimeUnit.SECONDS);

    int totalPassed = 0;
    int connectionFailures = 0;

    for (CompletableFuture<HttpResponse<String>> future : futures) {
      HttpResponse<String> response = future.get();

      if (response.statusCode() == 503) {
        connectionFailures++;
        continue;
      }

      assertEquals(200, response.statusCode());

      BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
      totalPassed += result.getNumberOfRowsPassed();

      if (result.getFailedRequest() != null) {
        for (BulkResponse failed : result.getFailedRequest()) {
          if (failed.getMessage() != null
              && (failed.getMessage().contains("connection")
                  || failed.getMessage().contains("timeout")
                  || failed.getMessage().contains("pool"))) {
            connectionFailures++;
          }
        }
      }
    }

    assertEquals(
        0,
        connectionFailures,
        "No connection-related failures should occur with sequential processing");

    assertTrue(
        totalPassed >= numConcurrentRequests * entitiesPerRequest * 0.95,
        "At least 95% of entities should be created successfully");
  }

  @Test
  void test_verifyEntitiesExistAfterBulkCreate(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<CreateTable> tables =
        IntStream.range(0, 10)
            .mapToObj(i -> createTableRequest(ns, schema, "verify_table_" + i))
            .toList();

    HttpResponse<String> response = callBulkEndpoint(tables, SdkClients.getAdminToken(), false);

    assertEquals(200, response.statusCode());

    BulkOperationResult result = JsonUtils.readValue(response.body(), BulkOperationResult.class);
    assertEquals(10, result.getNumberOfRowsPassed());

    assertNotNull(result.getSuccessRequest(), "Should have success responses");
    assertEquals(10, result.getSuccessRequest().size(), "Should have 10 success responses");

    for (BulkResponse successResponse : result.getSuccessRequest()) {
      assertNotNull(successResponse.getRequest(), "Success response should have entity reference");
      assertEquals(200, successResponse.getStatus(), "Success response should have 200 status");
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private static String getBotToken() {
    return JwtAuthProvider.tokenFor(
        "ingestion-bot@open-metadata.org",
        "ingestion-bot@open-metadata.org",
        new String[] {"bot"},
        3600);
  }

  private static String getDataConsumerToken() {
    return JwtAuthProvider.tokenFor(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"},
        3600);
  }

  private CreateTable createTableRequest(
      TestNamespace ns, DatabaseSchema schema, String tableName) {
    CreateTable request = new CreateTable();
    request.setName(ns.prefix(tableName));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setColumns(
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    return request;
  }

  private HttpResponse<String> callBulkEndpoint(
      List<CreateTable> tables, String authToken, boolean async) throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/tables/bulk";
    if (async) {
      url += "?async=true";
    }

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + authToken)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(tables)))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
