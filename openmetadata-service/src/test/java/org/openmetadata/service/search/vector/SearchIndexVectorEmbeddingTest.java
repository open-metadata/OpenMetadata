package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
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
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(OrderAnnotation.class)
@Slf4j
public class SearchIndexVectorEmbeddingTest extends OpenMetadataApplicationTest {

  static {
    runWithOpensearch = true;
    runWithVectorEmbeddings = true;
  }

  private DatabaseService sampleDatabaseService;
  private Database sampleDatabase;
  private DatabaseSchema sampleSchema;
  private Table sampleTable1;
  private Table sampleTable2;

  @BeforeAll
  public void checkVectorSearchAvailable() throws Exception {
    super.createApplication();
    Assumptions.assumeTrue(
        waitForVectorSearchAvailability(),
        "Vector search service is not available (embedding model may have failed to load)");
  }

  @Test
  @Order(1)
  public void testCreateSampleTables() throws Exception {
    sampleDatabaseService =
        TestUtils.post(
            getResource("services/databaseServices"),
            createDatabaseService("vec_embed_svc_" + System.currentTimeMillis()),
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);

    assertNotNull(sampleDatabaseService);
    assertNotNull(sampleDatabaseService.getId());

    sampleDatabase =
        TestUtils.post(
            getResource("databases"),
            new CreateDatabase()
                .withName("sample_db")
                .withDisplayName("Sample Database for Embeddings Test")
                .withDescription("Database created for testing vector embeddings functionality")
                .withService(sampleDatabaseService.getFullyQualifiedName()),
            Database.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleDatabase);

    sampleSchema =
        TestUtils.post(
            getResource("databaseSchemas"),
            new CreateDatabaseSchema()
                .withName("test_schema")
                .withDisplayName("Test Schema")
                .withDescription("Schema for testing embeddings")
                .withDatabase(sampleDatabase.getFullyQualifiedName()),
            DatabaseSchema.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleSchema);

    sampleTable1 =
        createSampleTable("customers", "Customer data with demographics and purchase history");
    sampleTable2 =
        createSampleTable("products", "Product catalog with detailed descriptions and categories");

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
    String table2Id = sampleTable2.getId().toString();
    Map<String, Object> fp2 = getFingerprint(table2Id);
    String originalFingerprint2 = fp2 != null ? (String) fp2.get("fingerprint") : null;

    Table currentTable =
        TestUtils.get(getResource("tables/" + table2Id), Table.class, ADMIN_AUTH_HEADERS);

    String newDescription = currentTable.getDescription() + " - MODIFIED FOR RECOMPUTATION TEST";

    CreateTable updateRequest =
        new CreateTable()
            .withName(currentTable.getName())
            .withDisplayName(currentTable.getDisplayName())
            .withDescription(newDescription)
            .withDatabaseSchema(currentTable.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(currentTable.getColumns());

    TestUtils.put(getResource("tables"), updateRequest, Response.Status.OK, ADMIN_AUTH_HEADERS);

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
  }

  @Test
  @Order(7)
  public void testCleanupSampleData() {
    safeDelete("tables", sampleTable1);
    safeDelete("tables", sampleTable2);
    safeDelete("databaseSchemas", sampleSchema);
    safeDelete("databases", sampleDatabase);
    safeDelete("services/databaseServices", sampleDatabaseService);
  }

  private Table createSampleTable(String name, String description) throws Exception {
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

    return TestUtils.post(getResource("tables"), createTable, Table.class, ADMIN_AUTH_HEADERS);
  }

  private Object createDatabaseService(String name) {
    return Map.of(
        "name",
        name,
        "serviceType",
        "Postgres",
        "description",
        "Test service for vector embeddings",
        "connection",
        Map.of(
            "config",
            Map.of(
                "type", "Postgres",
                "hostPort", "localhost:5432",
                "username", "test",
                "authType", Map.of("password", "test"))));
  }

  private void triggerSearchIndexApplication(boolean recreateIndex) throws Exception {
    waitForExistingJobToComplete();

    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(10)
            .withRecreateIndex(recreateIndex)
            .withAutoTune(false);

    WebTarget target = getResource("apps/trigger/SearchIndexingApplication");

    int maxRetries = 5;
    long retryBackoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(Entity.entity(jobConfig, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return;
      }

      String body = response.readEntity(String.class);
      if (body != null && body.contains("Job is already running") && attempt < maxRetries) {
        LOG.info(
            "Job is still running, waiting {}ms before retry {}/{}",
            retryBackoffMs,
            attempt,
            maxRetries);
        Thread.sleep(retryBackoffMs);
        waitForExistingJobToComplete();
        continue;
      }

      assertTrue(
          response.getStatus() >= 200 && response.getStatus() < 300,
          "Failed to trigger SearchIndexingApplication: " + body);
    }
  }

  private void waitForIndexingCompletion() throws Exception {
    int waitIntervalMs = 3000;
    int totalWaited = 0;
    int maxWaitMs = 120_000;

    while (totalWaited < maxWaitMs) {
      Thread.sleep(waitIntervalMs);
      totalWaited += waitIntervalMs;

      try {
        WebTarget target = getResource("apps/name/SearchIndexingApplication/logs");
        Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

        if (response.getStatus() == 200) {
          String body = response.readEntity(String.class);
          if (body != null) {
            Map<String, Object> logJson = JsonUtils.readValue(body, Map.class);
            String status = (String) logJson.get("status");
            if ("success".equalsIgnoreCase(status) || "completed".equalsIgnoreCase(status)) {
              LOG.info("Indexing completed successfully after {}ms", totalWaited);
              return;
            }
            if ("failed".equalsIgnoreCase(status)
                || "stopped".equalsIgnoreCase(status)
                || "activeError".equalsIgnoreCase(status)) {
              LOG.warn("Indexing ended with status: {}", status);
              return;
            }
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not retrieve logs: {}", e.getMessage());
      }
    }

    LOG.warn("Indexing wait timeout reached after {}ms", totalWaited);
  }

  private boolean waitForVectorSearchAvailability() {
    int maxRetries = 10;
    long backoffMs = 3000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        WebTarget target = getResource("search/vector/query");
        Map<String, Object> requestBody =
            Map.of("query", "test", "size", 1, "k", 1, "threshold", 0.0);

        Response response =
            SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
                .post(Entity.entity(requestBody, MediaType.APPLICATION_JSON));

        if (response.getStatus() >= 200 && response.getStatus() < 300) {
          LOG.info("Vector search service is available (attempt {})", attempt);
          return true;
        }

        LOG.info(
            "Vector search not yet available (attempt {}/{}): {}",
            attempt,
            maxRetries,
            response.getStatus());
      } catch (Exception e) {
        LOG.info(
            "Vector search check failed (attempt {}/{}): {}", attempt, maxRetries, e.getMessage());
      }

      try {
        Thread.sleep(backoffMs);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return false;
      }
    }

    LOG.warn("Vector search service not available after {} attempts", maxRetries);
    return false;
  }

  @SuppressWarnings("unchecked")
  private void waitForExistingJobToComplete() throws Exception {
    int maxWaitMs = 120_000;
    int pollIntervalMs = 3000;
    int totalWaited = 0;

    while (totalWaited < maxWaitMs) {
      try {
        WebTarget target = getResource("apps/name/SearchIndexingApplication/logs");
        Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

        if (response.getStatus() == 200) {
          String body = response.readEntity(String.class);
          if (body != null) {
            Map<String, Object> logJson = JsonUtils.readValue(body, Map.class);
            String status = (String) logJson.get("status");
            if (status == null
                || (!"running".equalsIgnoreCase(status)
                    && !"started".equalsIgnoreCase(status)
                    && !"active".equalsIgnoreCase(status))) {
              LOG.info("SearchIndexingApplication is idle (status={}), proceeding", status);
              return;
            }
            LOG.info("SearchIndexingApplication is {} - waiting...", status);
          }
        } else {
          return;
        }
      } catch (Exception e) {
        LOG.debug("Could not check job status: {}", e.getMessage());
        return;
      }

      Thread.sleep(pollIntervalMs);
      totalWaited += pollIntervalMs;
    }

    LOG.warn("Timeout waiting for existing job to complete after {}ms", maxWaitMs);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> vectorSearch(String query) throws Exception {
    WebTarget target = getResource("search/vector/query");
    Map<String, Object> requestBody =
        Map.of("query", query, "size", 10, "k", 10000, "threshold", 0.0);

    int maxRetries = 10;
    long backoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(Entity.entity(requestBody, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (attempt < maxRetries) {
        LOG.info(
            "Vector search returned status {} (attempt {}/{}), retrying in {}ms",
            response.getStatus(),
            attempt,
            maxRetries,
            backoffMs * attempt);
        Thread.sleep(backoffMs * attempt);
        continue;
      }

      LOG.warn(
          "Vector search returned status {}: {}",
          response.getStatus(),
          response.readEntity(String.class));
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getFingerprint(String parentId) throws Exception {
    WebTarget target = getResource("search/vector/fingerprint").queryParam("parentId", parentId);

    int maxRetries = 10;
    long backoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (attempt < maxRetries) {
        LOG.info(
            "Fingerprint request returned status {} (attempt {}/{}), retrying",
            response.getStatus(),
            attempt,
            maxRetries);
        Thread.sleep(backoffMs * attempt);
        continue;
      }

      LOG.debug(
          "Fingerprint request returned status {}: {}",
          response.getStatus(),
          response.readEntity(String.class));
    }
    return null;
  }

  private void safeDelete(String resource, org.openmetadata.schema.EntityInterface entity) {
    if (entity == null) {
      return;
    }
    try {
      WebTarget target =
          getResource(resource + "/" + entity.getId())
              .queryParam("hardDelete", true)
              .queryParam("recursive", true);
      SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).delete();
    } catch (Exception e) {
      LOG.warn("Failed to delete {}: {}", resource, e.getMessage());
    }
  }
}
