package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * The NLQ keyword fallback and {@code /search/aggregate?q=} must search the configured fields. A
 * query_string without fields expands to every field in the mapping, and on OpenSearch's default
 * max_clause_count (1024) a single long token is enough to fail the table shard: HTTP 500 on the
 * table index, and silently dropped shards on the {@code dataAsset} alias.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchFieldlessQueryIT {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final List<String> INDEXES = List.of("table_search_index", "dataAsset");
  private static final List<Integer> TOKEN_LENGTHS = List.of(21, 40, 100);
  private static final String ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";

  @Test
  void nlqFallbackHandlesLongTokensAndFindsTheTable(TestNamespace ns) throws Exception {
    String token = randomToken(21);
    String tableName = createIndexedTable(ns, token);

    JsonNode found = getJson(nlqPath("table_search_index", token));
    assertTrue(
        found.path("hits").toString().contains(tableName),
        "NLQ fallback should find the table by its token -> " + found.path("hits"));

    for (String index : INDEXES) {
      for (int length : TOKEN_LENGTHS) {
        assertNoShardFailed(getJson(nlqPath(index, randomToken(length))));
      }
    }
  }

  @Test
  void aggregateTextHandlesLongTokens(TestNamespace ns) throws Exception {
    createIndexedTable(ns, randomToken(21));

    for (String index : INDEXES) {
      for (int length : TOKEN_LENGTHS) {
        String path =
            "/v1/search/aggregate?index="
                + encode(index)
                + "&field=entityType&size=10&q="
                + encode(randomToken(length));
        assertNoShardFailed(getJson(path));
      }
    }
  }

  private static String createIndexedTable(TestNamespace ns, String token) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServices.builder()
            .name("fieldless_svc_" + shortId)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .create();
    Database database =
        SdkClients.adminClient()
            .databases()
            .create(
                new CreateDatabase()
                    .withName("fieldless_db_" + shortId)
                    .withService(service.getFullyQualifiedName()));
    DatabaseSchema schema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("fieldless_schema_" + shortId)
                    .withDatabase(database.getFullyQualifiedName()));
    String tableName = ns.prefix(token);
    SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(tableName)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
    awaitIndexed(tableName);
    return tableName;
  }

  private static void awaitIndexed(String tableName) {
    Awaitility.await()
        .atMost(90, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () ->
                SdkClients.adminClient()
                    .search()
                    .query(tableName)
                    .index("table_search_index")
                    .size(10)
                    .execute()
                    .contains(tableName));
  }

  private static void assertNoShardFailed(JsonNode response) {
    assertEquals(
        0, response.path("_shards").path("failed").asInt(-1), "shards failed -> " + response);
  }

  private static JsonNode getJson(String path) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), path + " -> " + response.body());
    return OBJECT_MAPPER.readTree(response.body());
  }

  private static String nlqPath(String index, String query) {
    return "/v1/search/nlq/query?index=" + encode(index) + "&size=10&q=" + encode(query);
  }

  /** Letters and digits only, seeded by length so a failure reproduces with the same input. */
  private static String randomToken(int length) {
    Random random = new Random(length);
    StringBuilder token = new StringBuilder(length);
    for (int i = 0; i < length; i++) {
      token.append(ALPHANUMERIC.charAt(random.nextInt(ALPHANUMERIC.length())));
    }
    return token.toString();
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
