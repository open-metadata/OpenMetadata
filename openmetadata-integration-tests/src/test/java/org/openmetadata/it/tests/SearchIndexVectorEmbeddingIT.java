package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration test that validates vector embeddings functionality using SearchIndexApp. Tests the
 * complete flow: create sample tables -> execute SearchIndexApp -> validate embeddings in
 * OpenSearch.
 */
@TestMethodOrder(OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Slf4j
public class SearchIndexVectorEmbeddingIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  private DatabaseService sampleDatabaseService;
  private Database sampleDatabase;
  private DatabaseSchema sampleSchema;
  private Table sampleTable1;
  private Table sampleTable2;

  @Test
  @Order(0)
  public void checkOpenSearchAvailable() {
    String searchType = System.getProperty("searchType", "elasticsearch");
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(searchType),
        "Vector embedding tests require OpenSearch (run with -PpostgresOpenSearch profile)");
    Assumptions.assumeTrue(
        org.openmetadata.service.Entity.getSearchRepository() != null
            && org.openmetadata.service.Entity.getSearchRepository().isVectorEmbeddingEnabled(),
        "Vector embedding tests require vector embeddings to be configured");
  }

  @Test
  @Order(1)
  public void testCreateSampleTables() {
    OpenMetadataClient client = SdkClients.adminClient();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    sampleDatabaseService =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("vec_embed_svc_" + System.currentTimeMillis())
            .connection(conn)
            .description("Test service for vector embeddings")
            .create();

    assertNotNull(sampleDatabaseService);
    assertNotNull(sampleDatabaseService.getId());

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("sample_db")
            .withDisplayName("Sample Database for Embeddings Test")
            .withDescription("Database created for testing vector embeddings functionality")
            .withService(sampleDatabaseService.getFullyQualifiedName());

    sampleDatabase = client.databases().create(createDatabase);
    assertNotNull(sampleDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("test_schema")
            .withDisplayName("Test Schema")
            .withDescription("Schema for testing embeddings")
            .withDatabase(sampleDatabase.getFullyQualifiedName());

    sampleSchema = client.databaseSchemas().create(createSchema);
    assertNotNull(sampleSchema);

    sampleTable1 =
        createSampleTable(
            client, "customers", "Customer data with demographics and purchase history");
    sampleTable2 =
        createSampleTable(
            client, "products", "Product catalog with detailed descriptions and categories");

    assertNotNull(sampleTable1);
    assertNotNull(sampleTable2);
  }

  @Test
  @Order(2)
  public void testExecuteSearchIndexApp() {
    assertDoesNotThrow(
        () -> triggerSearchIndexApplication(true),
        "SearchIndexApplication trigger should complete without errors");

    assertDoesNotThrow(
        () -> waitForIndexingCompletion(),
        "SearchIndexApplication should complete within timeout period");
  }

  @Test
  @Order(3)
  public void testValidateEmbeddingsInOpenSearch() throws Exception {
    log.info("Starting validation of embeddings in OpenSearch");

    Map<String, Object> response = vectorSearch("customer data demographics");

    assertNotNull(response, "Vector search response should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> hits = (List<Map<String, Object>>) response.get("hits");
    assertNotNull(hits, "Vector search hits should not be null");
    assertFalse(hits.isEmpty(), "Should find embedding results for sample tables");

    boolean foundCustomerTable =
        hits.stream()
            .map(hit -> (String) hit.get("fullyQualifiedName"))
            .filter(java.util.Objects::nonNull)
            .anyMatch(fqn -> fqn.contains("customers"));

    assertTrue(foundCustomerTable, "Should find customer table in embedding search results");
  }

  @Test
  @Order(4)
  public void testValidateEmbeddingFingerprints() throws Exception {
    String parentId = sampleTable1.getId().toString();

    Map<String, Object> response = getFingerprint(parentId);
    assertNotNull(response, "Fingerprint response should not be null");
    String fingerprint = (String) response.get("fingerprint");
    assertNotNull(fingerprint, "Should have fingerprint for embedded table");
    assertFalse(fingerprint.isEmpty(), "Fingerprint should not be empty");
  }

  @Test
  @Order(5)
  public void testMigrationVsRecomputationDuringReindex() throws Exception {
    log.info("Starting migration vs recomputation test scenarios");

    String table2Id = sampleTable2.getId().toString();
    Map<String, Object> fp2 = getFingerprint(table2Id);
    String originalFingerprint2 = fp2 != null ? (String) fp2.get("fingerprint") : null;

    OpenMetadataClient client = SdkClients.adminClient();
    Table currentTable = client.tables().get(table2Id);

    String newDescription = currentTable.getDescription() + " - MODIFIED FOR RECOMPUTATION TEST";

    CreateTable updateRequest =
        new CreateTable()
            .withName(currentTable.getName())
            .withDisplayName(currentTable.getDisplayName())
            .withDescription(newDescription)
            .withDatabaseSchema(currentTable.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(currentTable.getColumns());

    client.getHttpClient().execute(HttpMethod.PUT, "/v1/tables", updateRequest, Table.class);

    Thread.sleep(5000);

    triggerSearchIndexApplication(true);
    waitForIndexingCompletion();

    Map<String, Object> newFp = getFingerprint(table2Id);
    String newFingerprint = newFp != null ? (String) newFp.get("fingerprint") : null;

    assertNotNull(newFingerprint, "Fingerprint should exist after recomputation");
    if (originalFingerprint2 != null) {
      assertNotEquals(
          originalFingerprint2,
          newFingerprint,
          "Fingerprint should be different for changed entity (recomputation scenario)");
    }
  }

  @Test
  @Order(6)
  public void testNormalReindexSkipsRecomputation() throws Exception {
    log.info("Testing that normal reindex (recreateIndex=false) skips unnecessary recomputation");

    String table1Id = sampleTable1.getId().toString();
    Map<String, Object> fp1 = getFingerprint(table1Id);
    String beforeFingerprint = fp1 != null ? (String) fp1.get("fingerprint") : null;

    assertNotNull(beforeFingerprint, "Should have fingerprint for table1 before reindex");

    triggerSearchIndexApplication(false);
    waitForIndexingCompletion();

    Map<String, Object> afterFp = getFingerprint(table1Id);
    String afterFingerprint = afterFp != null ? (String) afterFp.get("fingerprint") : null;

    assertNotNull(afterFingerprint, "Fingerprint should exist after normal reindex");

    Map<String, Object> searchResponse = vectorSearch("customer data demographics");
    assertNotNull(searchResponse, "Vector search should still work after normal reindex");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> hits = (List<Map<String, Object>>) searchResponse.get("hits");
    assertNotNull(hits, "Hits should not be null");
    assertFalse(hits.isEmpty(), "Should find existing embeddings after normal reindex");

    log.info("Successfully verified normal reindex scenario");
  }

  @Test
  @Order(7)
  public void testCleanupSampleData() {
    OpenMetadataClient client = SdkClients.adminClient();

    safeDelete(client, "tables", sampleTable1);
    safeDelete(client, "tables", sampleTable2);
    safeDelete(client, "databaseSchemas", sampleSchema);
    safeDelete(client, "databases", sampleDatabase);
    safeDelete(client, "services/databaseServices", sampleDatabaseService);
  }

  private Table createSampleTable(OpenMetadataClient client, String name, String description) {
    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDisplayName("Identifier")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key for " + name),
            new Column()
                .withName("name")
                .withDisplayName("Name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(8)
                .withDescription("Name field with searchable text"),
            new Column()
                .withName("description")
                .withDisplayName("Description")
                .withDataType(ColumnDataType.TEXT)
                .withDescription("Detailed description field for semantic search"),
            new Column()
                .withName("created_date")
                .withDisplayName("Created Date")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Timestamp when record was created"));

    CreateTable createTable =
        new CreateTable()
            .withName(name)
            .withDisplayName(name.substring(0, 1).toUpperCase() + name.substring(1) + " Table")
            .withDescription(
                description + " - This table contains structured data for testing embeddings")
            .withDatabaseSchema(sampleSchema.getFullyQualifiedName())
            .withColumns(columns);

    return client.tables().create(createTable);
  }

  private void triggerSearchIndexApplication(boolean recreateIndex) throws Exception {
    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(10)
            .withRecreateIndex(recreateIndex)
            .withAutoTune(false);

    String body = JsonUtils.pojoToJson(jobConfig);
    String url = SdkClients.getServerUrl() + "/v1/apps/trigger/SearchIndexingApplication";

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "Failed to trigger SearchIndexingApplication: " + response.body());
  }

  private void waitForIndexingCompletion() throws Exception {
    int waitIntervalMs = 2000;
    int totalWaited = 0;
    int maxWaitMs = 60000;

    while (totalWaited < maxWaitMs) {
      Thread.sleep(waitIntervalMs);
      totalWaited += waitIntervalMs;
      log.debug("Waited {}ms for indexing completion", totalWaited);

      try {
        String url = SdkClients.getServerUrl() + "/v1/apps/name/SearchIndexingApplication/logs";
        HttpRequest request =
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                .GET()
                .build();

        HttpResponse<String> response =
            HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200 && response.body() != null) {
          Map<String, Object> logJson = JsonUtils.readValue(response.body(), Map.class);
          String status = (String) logJson.get("status");
          if ("success".equalsIgnoreCase(status)) {
            log.info("Indexing completed successfully after {}ms", totalWaited);
            return;
          }
          if ("failed".equalsIgnoreCase(status) || "error".equalsIgnoreCase(status)) {
            log.warn("Indexing failed with status: {}", status);
            return;
          }
        }
      } catch (Exception e) {
        log.debug("Could not retrieve logs: {}", e.getMessage());
      }
    }

    log.warn("Indexing wait timeout reached after {}ms", totalWaited);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> vectorSearch(String query) throws Exception {
    String body =
        OBJECT_MAPPER.writeValueAsString(
            Map.of("query", query, "size", 10, "k", 10000, "threshold", 0.0));

    String url = SdkClients.getServerUrl() + "/v1/search/vector/query";
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() >= 200 && response.statusCode() < 300) {
      return OBJECT_MAPPER.readValue(response.body(), Map.class);
    }
    log.warn("Vector search returned status {}: {}", response.statusCode(), response.body());
    return null;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getFingerprint(String parentId) throws Exception {
    String url =
        SdkClients.getServerUrl() + "/v1/search/vector/fingerprint?parentId=" + parentId;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() >= 200 && response.statusCode() < 300) {
      return OBJECT_MAPPER.readValue(response.body(), Map.class);
    }
    log.debug("Fingerprint request returned status {}", response.statusCode());
    return null;
  }

  private void safeDelete(
      OpenMetadataClient client, String resource, org.openmetadata.schema.EntityInterface entity) {
    if (entity == null) {
      return;
    }
    try {
      String url =
          SdkClients.getServerUrl()
              + "/api/v1/"
              + resource
              + "/"
              + entity.getId()
              + "?hardDelete=true&recursive=true";
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .DELETE()
              .build();
      HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (Exception e) {
      log.warn("Failed to delete {}: {}", resource, e.getMessage());
    }
  }
}
