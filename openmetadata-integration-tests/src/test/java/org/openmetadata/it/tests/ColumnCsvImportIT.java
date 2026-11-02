package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
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
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;

/**
 * Regression IT for the bounds on {@code POST /api/v1/columns/import} (CWE-770: a per-row catalog
 * read with no payload cap let any authenticated user hold request threads until the QoS limit
 * 503'd the API). Each test here pins one of the new behaviors over HTTP; the matching unit tests
 * in {@code ColumnRepositoryImportTest} pin the single-catalog-walk and de-duplication mechanics.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnCsvImportIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  /** ColumnRepository.MAX_SYNC_IMPORT_COLUMN_UPDATES (200) + 1 occurrences of one column name. */
  private static final int TABLES_FOR_OVER_CAP = 201;

  private static final String HEADER = "column,displayName,description,tags,glossaryTerms\n";

  @BeforeAll
  public static void setup() {
    OpenMetadataClient client = SdkClients.adminClient();
    Tables.setDefaultClient(client);
    Columns.setDefaultClient(client);
  }

  @Test
  void dryRunCountsMatchesAndRejectsEmptyName(TestNamespace ns) throws Exception {
    createTwoServiceCatalog(ns);

    HttpResponse<String> response =
        postCsv(
            "/v1/columns/import?dryRun=true",
            HEADER + "shared_col,,,,\n" + "no_such_column,,,,\n" + ",,,,\n");

    assertEquals(200, response.statusCode(), response.body());
    JsonNode result = OBJECT_MAPPER.readTree(response.body());
    assertTrue(result.get("dryRun").asBoolean());
    assertEquals(3, result.get("numberOfRowsProcessed").asInt());
    assertEquals(1, result.get("numberOfRowsPassed").asInt());
    assertEquals(2, result.get("numberOfRowsFailed").asInt());
    assertEquals("partialSuccess", result.get("status").asText());
  }

  @Test
  void writeImportAppliesOnlyWithinServiceFilter(TestNamespace ns) throws Exception {
    Catalog catalog = createTwoServiceCatalog(ns);

    HttpResponse<String> response =
        postCsv(
            "/v1/columns/import?dryRun=false&serviceName=" + catalog.serviceA().getName(),
            HEADER + "shared_col,Scoped display,Scoped description,,\n");

    assertEquals(200, response.statusCode(), response.body());
    JsonNode result = OBJECT_MAPPER.readTree(response.body());
    assertEquals(1, result.get("numberOfRowsPassed").asInt());
    assertEquals(0, result.get("numberOfRowsFailed").asInt());

    // The write path honours the serviceName filter like the dry run: in-scope column updated,
    // same-named column in the other service untouched.
    Column inScope = getColumn(catalog.tableA().getFullyQualifiedName() + ".shared_col");
    assertEquals("Scoped description", inScope.getDescription());
    Column outOfScope = getColumn(catalog.tableB().getFullyQualifiedName() + ".shared_col");
    assertNull(outOfScope.getDescription());
  }

  @Test
  void oversizedPayloadIsRejectedWith400AtBothEndpoints(TestNamespace ns) throws Exception {
    StringBuilder csv = new StringBuilder("column\n");
    for (int i = 0; i <= 100_000; i++) {
      csv.append("col_").append(i).append('\n');
    }
    String body = csv.toString();

    HttpResponse<String> sync = postCsv("/v1/columns/import?dryRun=true", body);
    assertEquals(400, sync.statusCode(), sync.body());

    HttpResponse<String> async = postCsv("/v1/columns/import-async", body);
    assertEquals(400, async.statusCode(), async.body());
  }

  @Test
  void syncWriteImportAboveUpdateCapIsRejectedBeforeWriting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column id = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();
    Column everywhere =
        Columns.build("everywhere_col").withType(ColumnDataType.VARCHAR).withLength(100).create();
    List<CreateTable> requests = new ArrayList<>();
    for (int i = 0; i < TABLES_FOR_OVER_CAP; i++) {
      requests.add(
          new CreateTable()
              .withName(ns.prefix("wide_" + i))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(id, everywhere)));
    }
    for (int start = 0; start < requests.size(); start += 50) {
      BulkOperationResult created =
          client
              .tables()
              .bulkCreateOrUpdate(requests.subList(start, Math.min(start + 50, requests.size())));
      assertEquals(0, created.getNumberOfRowsFailed());
    }

    HttpResponse<String> response =
        postCsv(
            "/v1/columns/import?dryRun=false",
            HEADER + "everywhere_col,Wide,Should never land,,\n");

    assertEquals(400, response.statusCode(), response.body());
    assertTrue(response.body().contains("import-async"), response.body());

    Column untouched =
        getColumn(schema.getFullyQualifiedName() + "." + ns.prefix("wide_0") + ".everywhere_col");
    assertNull(untouched.getDescription());
  }

  private record Catalog(
      DatabaseService serviceA, DatabaseService serviceB, Table tableA, Table tableB) {}

  /** Two services, each with a table carrying the same column name, for scoping assertions. */
  private static Catalog createTwoServiceCatalog(TestNamespace ns) {
    DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
    Table tableA =
        Tables.create()
            .name(ns.prefix("products"))
            .inSchema(schemaA.getFullyQualifiedName())
            .withColumns(
                Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create(),
                Columns.build("shared_col")
                    .withType(ColumnDataType.VARCHAR)
                    .withLength(100)
                    .create(),
                Columns.build("a_note").withType(ColumnDataType.VARCHAR).withLength(100).create())
            .execute();

    DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schemaB = DatabaseSchemaTestFactory.createSimple(ns, serviceB);
    Table tableB =
        Tables.create()
            .name(ns.prefix("orders"))
            .inSchema(schemaB.getFullyQualifiedName())
            .withColumns(
                Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create(),
                Columns.build("shared_col")
                    .withType(ColumnDataType.VARCHAR)
                    .withLength(100)
                    .create(),
                Columns.build("b_note").withType(ColumnDataType.VARCHAR).withLength(100).create())
            .execute();

    return new Catalog(serviceA, serviceB, tableA, tableB);
  }

  private static HttpResponse<String> postCsv(String path, String csv) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "text/plain")
            .timeout(Duration.ofSeconds(60))
            .POST(HttpRequest.BodyPublishers.ofString(csv))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static Column getColumn(String columnFqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/columns/name/"
                        + encodeURIComponent(columnFqn)
                        + "?entityType=table"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return OBJECT_MAPPER.readValue(response.body(), Column.class);
  }
}
