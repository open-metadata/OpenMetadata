package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import io.dropwizard.testing.ResourceHelpers;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.OpenMetadataOperations;
import org.openmetadata.service.util.TestUtils;
import picocli.CommandLine;

@TestMethodOrder(OrderAnnotation.class)
@Slf4j
public class VectorEmbeddingReembedOperationsTest extends OpenMetadataApplicationTest {

  static {
    runWithOpensearch = true;
    runWithVectorEmbeddings = true;
  }

  private static final String REEMBED_CONFIG_PATH =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");

  private DatabaseService sampleDatabaseService;
  private Database sampleDatabase;
  private DatabaseSchema sampleSchema;
  private Table sampleTable;

  @BeforeAll
  public void checkVectorSearchAvailable() {
    Assumptions.assumeTrue(
        waitForVectorSearchAvailability(), "Reembed tests require vector search to be available");
  }

  @Test
  @Order(1)
  public void createSampleData() throws Exception {
    sampleDatabaseService =
        TestUtils.post(
            getResource("services/databaseServices"),
            createDatabaseService("reembed_svc_" + System.currentTimeMillis()),
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);

    assertNotNull(sampleDatabaseService);

    sampleDatabase =
        TestUtils.post(
            getResource("databases"),
            new CreateDatabase()
                .withName("reembed_db")
                .withService(sampleDatabaseService.getFullyQualifiedName()),
            Database.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleDatabase);

    sampleSchema =
        TestUtils.post(
            getResource("databaseSchemas"),
            new CreateDatabaseSchema()
                .withName("reembed_schema")
                .withDatabase(sampleDatabase.getFullyQualifiedName()),
            DatabaseSchema.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(sampleSchema);

    sampleTable =
        TestUtils.post(
            getResource("tables"),
            new CreateTable()
                .withName("reembed_table")
                .withDescription(
                    "Customer telemetry and demographics used to validate vector embeddings")
                .withDatabaseSchema(sampleSchema.getFullyQualifiedName())
                .withColumns(
                    List.of(
                        new Column()
                            .withName("id")
                            .withDataType(ColumnDataType.INT)
                            .withDescription("pk"),
                        new Column()
                            .withName("customer_name")
                            .withDataType(ColumnDataType.VARCHAR)
                            .withDataLength(8)
                            .withDescription("Customer name"),
                        new Column()
                            .withName("lifecycle_stage")
                            .withDataType(ColumnDataType.VARCHAR)
                            .withDataLength(8)
                            .withDescription("Stage of customer lifecycle"))),
            Table.class,
            ADMIN_AUTH_HEADERS);

    assertNotNull(sampleTable);
  }

  @Test
  @Order(2)
  public void runReembedCli() throws Exception {
    waitForExistingJobToComplete();

    int exitCode =
        new CommandLine(new OpenMetadataOperations())
            .execute(
                "-c",
                REEMBED_CONFIG_PATH,
                "reembed",
                "--batch-size",
                "5",
                "--producer-threads",
                "2",
                "--consumer-threads",
                "2",
                "--queue-size",
                "10");

    assertEquals(0, exitCode, "OpenMetadataOperations reembed should complete successfully");
  }

  @Test
  @Order(3)
  public void validateVectorSearchAfterReembed() throws Exception {
    int maxRetries = 10;
    long backoffMs = 5000;
    List<Map<String, Object>> hits = List.of();

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Map<String, Object> response = vectorSearch("customer telemetry demographics");

      if (response == null) {
        LOG.info("Vector search returned null (attempt {}/{}), retrying", attempt, maxRetries);
        if (attempt < maxRetries) {
          Thread.sleep(backoffMs * attempt);
        }
        continue;
      }

      @SuppressWarnings("unchecked")
      List<Map<String, Object>> responseHits = (List<Map<String, Object>>) response.get("hits");

      if (responseHits != null && !responseHits.isEmpty()) {
        hits = responseHits;
        break;
      }

      if (attempt < maxRetries) {
        Thread.sleep(backoffMs * attempt);
      }
    }

    assertFalse(
        hits.isEmpty(),
        "Vector search should return hits after reembed (tried " + maxRetries + " times)");

    boolean foundTable =
        hits.stream()
            .map(hit -> (String) hit.get("fullyQualifiedName"))
            .filter(fqn -> fqn != null)
            .anyMatch(fqn -> fqn.contains("reembed_table"));

    assertTrue(foundTable, "Re-embedded table should be discoverable via vector search");
  }

  @Test
  @Order(4)
  public void testCleanupSampleData() {
    safeDelete("tables", sampleTable);
    safeDelete("databaseSchemas", sampleSchema);
    safeDelete("databases", sampleDatabase);
    safeDelete("services/databaseServices", sampleDatabaseService);
  }

  private Object createDatabaseService(String name) {
    return Map.of(
        "name",
        name,
        "serviceType",
        "Postgres",
        "description",
        "Test service for reembed CLI",
        "connection",
        Map.of(
            "config",
            Map.of(
                "type", "Postgres",
                "hostPort", "localhost:5432",
                "username", "test",
                "authType", Map.of("password", "test"))));
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
