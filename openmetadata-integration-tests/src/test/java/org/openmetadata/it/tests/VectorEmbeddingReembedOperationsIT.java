package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.testing.ResourceHelpers;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestInstance.Lifecycle;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.util.OpenMetadataOperations;
import picocli.CommandLine;

/**
 * Integration test that runs OpenMetadataOperations.reembed end-to-end, ensuring vector embeddings
 * are regenerated and searchable.
 */
@TestMethodOrder(OrderAnnotation.class)
@TestInstance(Lifecycle.PER_CLASS)
@Slf4j
public class VectorEmbeddingReembedOperationsIT {

  private static final String CONFIG_PATH =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  private DatabaseService sampleDatabaseService;
  private Database sampleDatabase;
  private DatabaseSchema sampleSchema;
  private Table sampleTable;

  @Test
  @Order(0)
  public void checkOpenSearchAvailable() {
    String searchType = System.getProperty("searchType", "elasticsearch");
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(searchType),
        "Reembed tests require OpenSearch (run with -PpostgresOpenSearch profile)");
  }

  @Test
  @Order(1)
  public void createSampleData() {
    OpenMetadataClient client = SdkClients.adminClient();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    sampleDatabaseService =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("reembed_svc_" + System.currentTimeMillis())
            .connection(conn)
            .description("Test service for reembed CLI")
            .create();

    assertNotNull(sampleDatabaseService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("reembed_db")
            .withService(sampleDatabaseService.getFullyQualifiedName());

    sampleDatabase = client.databases().create(createDatabase);
    assertNotNull(sampleDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("reembed_schema")
            .withDatabase(sampleDatabase.getFullyQualifiedName());

    sampleSchema = client.databaseSchemas().create(createSchema);
    assertNotNull(sampleSchema);

    sampleTable =
        client
            .tables()
            .create(
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
                                .withDescription("Stage of customer lifecycle"))));

    assertNotNull(sampleTable);
  }

  @Test
  @Order(2)
  public void runReembedCli() {
    int exitCode =
        new CommandLine(new OpenMetadataOperations())
            .execute(
                "-c",
                CONFIG_PATH,
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
    int maxRetries = 3;
    long backoffMs = 1000;
    List<Map<String, Object>> hits = List.of();

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Map<String, Object> response = vectorSearch("customer telemetry demographics");
      assertNotNull(response);

      @SuppressWarnings("unchecked")
      List<Map<String, Object>> responseHits = (List<Map<String, Object>>) response.get("hits");
      assertNotNull(responseHits);

      if (!responseHits.isEmpty()) {
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

  private void safeDelete(String resource, org.openmetadata.schema.EntityInterface entity) {
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
