package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
public class VectorEmbeddingReindexAppTest extends OpenMetadataApplicationTest {

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
  public void testCreateSampleTablesForEmbedding() throws Exception {
    sampleDatabaseService =
        TestUtils.post(
            getResource("services/databaseServices"),
            createDatabaseService("vec_reindex_svc_" + System.currentTimeMillis()),
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);

    assertNotNull(sampleDatabaseService);
    assertNotNull(sampleDatabaseService.getId());

    sampleDatabase =
        TestUtils.post(
            getResource("databases"),
            new CreateDatabase()
                .withName("vector_test_db")
                .withDisplayName("Vector Embedding Test Database")
                .withDescription(
                    "Database containing customer and product data for testing semantic search and vector embeddings functionality")
                .withService(sampleDatabaseService.getFullyQualifiedName()),
            Database.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleDatabase);

    sampleSchema =
        TestUtils.post(
            getResource("databaseSchemas"),
            new CreateDatabaseSchema()
                .withName("analytics_schema")
                .withDisplayName("Analytics and Reporting Schema")
                .withDescription(
                    "Schema containing analytical tables for business intelligence and customer analytics")
                .withDatabase(sampleDatabase.getFullyQualifiedName()),
            DatabaseSchema.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleSchema);

    sampleTable1 =
        createEmbeddingTestTable(
            "customer_analytics",
            "Comprehensive customer analytics table containing demographic data, purchase history, behavioral patterns, and segmentation information for marketing and business intelligence");

    sampleTable2 =
        createEmbeddingTestTable(
            "product_catalog_metrics",
            "Product catalog with detailed metrics including sales performance, inventory levels, customer ratings, and category classification for recommendation systems");

    assertNotNull(sampleTable1);
    assertNotNull(sampleTable2);
  }

  @Test
  @Order(2)
  public void testInitialSearchIndexAppExecution() {
    assertDoesNotThrow(
        () -> triggerSearchIndexApplication(true),
        "Initial SearchIndexingApplication trigger should complete without errors");
  }

  @Test
  @Order(3)
  public void testValidateInitialEmbeddings() throws Exception {
    waitForIndexingCompletion();

    Map<String, Object> customerResults =
        vectorSearch("customer demographics analytics behavioral patterns");
    assertNotNull(customerResults, "Customer search results should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> customerHits =
        (List<Map<String, Object>>) customerResults.get("hits");
    assertNotNull(customerHits, "Customer hits should not be null");
    assertFalse(customerHits.isEmpty(), "Should find embedding results for customer analytics");

    boolean foundCustomerTable =
        customerHits.stream()
            .anyMatch(
                result -> {
                  String fqn = (String) result.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("customer_analytics");
                });

    assertTrue(foundCustomerTable, "Should find customer analytics table in semantic search");

    Map<String, Object> productResults =
        vectorSearch("product catalog inventory sales metrics recommendation");
    assertNotNull(productResults, "Product search results should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> productHits = (List<Map<String, Object>>) productResults.get("hits");
    assertNotNull(productHits, "Product hits should not be null");
    assertFalse(productHits.isEmpty(), "Should find embedding results for product catalog");

    boolean foundProductTable =
        productHits.stream()
            .anyMatch(
                result -> {
                  String fqn = (String) result.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("product_catalog");
                });

    assertTrue(foundProductTable, "Should find product catalog table in semantic search");
  }

  @Test
  @Order(4)
  public void testReindexingWithUpdatedMetadata() throws Exception {
    assertDoesNotThrow(
        () -> {
          CreateTable updateCustomerRequest =
              new CreateTable()
                  .withName(sampleTable1.getName())
                  .withDisplayName(sampleTable1.getDisplayName())
                  .withDescription(
                      "Advanced customer analytics platform with machine learning insights, "
                          + "predictive modeling for churn analysis, lifetime value calculations, and personalization algorithms")
                  .withDatabaseSchema(sampleTable1.getDatabaseSchema().getFullyQualifiedName())
                  .withColumns(sampleTable1.getColumns());

          TestUtils.put(
              getResource("tables"), updateCustomerRequest, Response.Status.OK, ADMIN_AUTH_HEADERS);

          CreateTable updateProductRequest =
              new CreateTable()
                  .withName(sampleTable2.getName())
                  .withDisplayName(sampleTable2.getDisplayName())
                  .withDescription(
                      "Intelligent product recommendation engine with real-time inventory tracking, "
                          + "dynamic pricing algorithms, customer sentiment analysis, and automated category optimization")
                  .withDatabaseSchema(sampleTable2.getDatabaseSchema().getFullyQualifiedName())
                  .withColumns(sampleTable2.getColumns());

          TestUtils.put(
              getResource("tables"), updateProductRequest, Response.Status.OK, ADMIN_AUTH_HEADERS);
        },
        "Should update table descriptions for reindexing test");

    Thread.sleep(5000);

    assertDoesNotThrow(
        () -> triggerSearchIndexApplication(false), "Reindexing should complete without errors");
  }

  @Test
  @Order(5)
  public void testValidateReindexedEmbeddings() throws Exception {
    waitForIndexingCompletion();

    Map<String, Object> mlResults =
        vectorSearch("machine learning predictive modeling churn analysis personalization");
    assertNotNull(mlResults, "ML search results should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> mlHits = (List<Map<String, Object>>) mlResults.get("hits");
    assertNotNull(mlHits, "ML hits should not be null");
    assertFalse(mlHits.isEmpty(), "Should find embedding results for ML-enhanced descriptions");

    boolean foundEnhancedCustomerTable =
        mlHits.stream()
            .anyMatch(
                result -> {
                  String fqn = (String) result.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("customer_analytics");
                });

    assertTrue(
        foundEnhancedCustomerTable, "Should find customer table with ML terms after reindexing");

    Map<String, Object> recResults =
        vectorSearch("recommendation engine dynamic pricing sentiment analysis optimization");
    assertNotNull(recResults, "Recommendation search results should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> recHits = (List<Map<String, Object>>) recResults.get("hits");
    assertNotNull(recHits, "Recommendation hits should not be null");
    assertFalse(recHits.isEmpty(), "Should find embedding results for recommendation terms");

    boolean foundEnhancedProductTable =
        recHits.stream()
            .anyMatch(
                result -> {
                  String fqn = (String) result.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("product_catalog");
                });

    assertTrue(
        foundEnhancedProductTable,
        "Should find product table with recommendation terms after reindexing");
  }

  @Test
  @Order(6)
  public void testValidateEmbeddingFingerprintOptimization() throws Exception {
    Map<String, Object> customerFp = getFingerprint(sampleTable1.getId().toString());
    assertNotNull(customerFp, "Should have fingerprint for customer table");
    String customerFingerprint = (String) customerFp.get("fingerprint");
    assertNotNull(customerFingerprint, "Customer fingerprint should not be null");
    assertFalse(customerFingerprint.isEmpty(), "Customer fingerprint should not be empty");

    Map<String, Object> productFp = getFingerprint(sampleTable2.getId().toString());
    assertNotNull(productFp, "Should have fingerprint for product table");
    String productFingerprint = (String) productFp.get("fingerprint");
    assertNotNull(productFingerprint, "Product fingerprint should not be null");
    assertFalse(productFingerprint.isEmpty(), "Product fingerprint should not be empty");
  }

  @Test
  @Order(7)
  public void testCleanupEmbeddingTestData() {
    safeDelete("tables", sampleTable1);
    safeDelete("tables", sampleTable2);
    safeDelete("databaseSchemas", sampleSchema);
    safeDelete("databases", sampleDatabase);
    safeDelete("services/databaseServices", sampleDatabaseService);
  }

  private Table createEmbeddingTestTable(String name, String description) throws Exception {
    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDisplayName("Record Identifier")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key identifier for " + name + " records"),
            new Column()
                .withName("name")
                .withDisplayName("Entity Name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(8)
                .withDescription("Human-readable name field for entity identification and search"),
            new Column()
                .withName("description")
                .withDisplayName("Detailed Description")
                .withDataType(ColumnDataType.TEXT)
                .withDescription(
                    "Comprehensive description field containing detailed information for semantic search and AI analysis"),
            new Column()
                .withName("category")
                .withDisplayName("Classification Category")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(8)
                .withDescription(
                    "Categorical classification for grouping and filtering operations"),
            new Column()
                .withName("metadata_json")
                .withDisplayName("Additional Metadata")
                .withDataType(ColumnDataType.JSON)
                .withDescription(
                    "Structured metadata in JSON format containing additional attributes"),
            new Column()
                .withName("created_timestamp")
                .withDisplayName("Creation Timestamp")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Timestamp indicating when the record was initially created"),
            new Column()
                .withName("updated_timestamp")
                .withDisplayName("Last Update Timestamp")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Timestamp of the most recent update to the record"));

    CreateTable createTable =
        new CreateTable()
            .withName(name)
            .withDisplayName(formatDisplayName(name))
            .withDescription(description)
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
        "Test service for vector embedding reindex",
        "connection",
        Map.of(
            "config",
            Map.of(
                "type", "Postgres",
                "hostPort", "localhost:5432",
                "username", "test",
                "authType", Map.of("password", "test"))));
  }

  private String formatDisplayName(String name) {
    String[] words = name.replace("_", " ").split(" ");
    StringBuilder result = new StringBuilder();
    for (String word : words) {
      if (!word.isEmpty()) {
        result
            .append(Character.toUpperCase(word.charAt(0)))
            .append(word.substring(1).toLowerCase())
            .append(" ");
      }
    }
    return result.toString().trim() + " Table";
  }

  private void triggerSearchIndexApplication(boolean recreateIndex) throws Exception {
    waitForExistingJobToComplete();

    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(5)
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

  @SuppressWarnings("unchecked")
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

    int maxRetries = 5;
    long backoffMs = 3000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(Entity.entity(requestBody, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (response.getStatus() == 503 && attempt < maxRetries) {
        LOG.info(
            "Vector search unavailable (attempt {}/{}), retrying in {}ms",
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

    int maxRetries = 3;
    long backoffMs = 2000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (response.getStatus() == 503 && attempt < maxRetries) {
        LOG.info("Fingerprint endpoint unavailable (attempt {}/{}), retrying", attempt, maxRetries);
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
