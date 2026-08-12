package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Integration tests verifying that columns (entityType=tableColumn) do NOT appear in domain asset
 * listings, even though columns inherit the domain field from their parent table for search
 * purposes.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainAssetsColumnExclusionIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testColumnsExcludedFromDomainAssets(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    Domain domain = createDomain(client, "col_excl_domain_" + shortId);

    Table table = createTableWithColumnsInDomain(ns, "col_excl_tbl", domain);
    int columnCount = table.getColumns().size();
    assertTrue(columnCount > 0, "Table should have columns");

    // Wait for columns to be indexed with inherited domain field
    Awaitility.await("Columns should be indexed with domain in column_search_index")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String queryFilter =
                  String.format(
                      "{\"query\":{\"bool\":{\"must\":["
                          + "{\"term\":{\"entityType\":\"tableColumn\"}},"
                          + "{\"term\":{\"domains.fullyQualifiedName\":\"%s\"}}"
                          + "]}}}",
                      domain.getFullyQualifiedName());

              String response =
                  client
                      .search()
                      .query("*")
                      .index("column_search_index")
                      .queryFilter(queryFilter)
                      .size(100)
                      .execute();

              JsonNode root = OBJECT_MAPPER.readTree(response);
              long totalHits = root.path("hits").path("total").path("value").asLong(0);
              assertTrue(
                  totalHits >= columnCount,
                  String.format(
                      "Expected at least %d columns in column_search_index with domain %s, found %d",
                      columnCount, domain.getFullyQualifiedName(), totalHits));
            });

    // Verify the domain assets endpoint returns ONLY the table, not columns
    Awaitility.await("Domain assets should contain table but not columns")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String url =
                  String.format(
                      "%s/v1/domains/name/%s/assets?limit=100",
                      SdkClients.getServerUrl(), domain.getFullyQualifiedName());

              java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
              java.net.http.HttpRequest request =
                  java.net.http.HttpRequest.newBuilder()
                      .uri(java.net.URI.create(url))
                      .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                      .header("Content-Type", "application/json")
                      .GET()
                      .build();

              java.net.http.HttpResponse<String> response =
                  httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

              assertEquals(200, response.statusCode(), "Domain assets endpoint should return 200");

              JsonNode root = OBJECT_MAPPER.readTree(response.body());
              JsonNode dataArray = root.path("data");
              assertTrue(dataArray.isArray(), "Response should have 'data' array");

              List<String> entityTypes = new ArrayList<>();
              List<String> fqns = new ArrayList<>();
              for (JsonNode asset : dataArray) {
                entityTypes.add(asset.path("type").asText(""));
                fqns.add(asset.path("fullyQualifiedName").asText(""));
              }

              // Table should be present
              assertTrue(
                  fqns.contains(table.getFullyQualifiedName()),
                  String.format(
                      "Table %s should be in domain assets. Found: %s",
                      table.getFullyQualifiedName(), fqns));

              // No tableColumn entities should be present
              for (String entityType : entityTypes) {
                assertTrue(
                    !"tableColumn".equals(entityType),
                    String.format(
                        "Domain assets should not contain tableColumn entities. Found types: %s, FQNs: %s",
                        entityTypes, fqns));
              }

              // Total count should reflect only the table
              int total =
                  root.has("paging") && root.path("paging").has("total")
                      ? root.path("paging").path("total").asInt()
                      : dataArray.size();
              assertEquals(
                  1,
                  total,
                  String.format(
                      "Domain should have exactly 1 asset (the table), not %d. Entity types: %s, FQNs: %s",
                      total, entityTypes, fqns));
            });
  }

  @Test
  void testColumnsExcludedFromDomainAssetsCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    Domain domain = createDomain(client, "col_cnt_domain_" + shortId);

    Table table1 = createTableWithColumnsInDomain(ns, "col_cnt_tbl1", domain);
    Table table2 = createTableWithColumnsInDomain(ns, "col_cnt_tbl2", domain);

    int totalColumns = table1.getColumns().size() + table2.getColumns().size();
    assertTrue(totalColumns > 0, "Tables should have columns");

    // Wait for indexing to complete
    Awaitility.await("Domain assets should show exactly 2 tables")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String url =
                  String.format(
                      "%s/v1/domains/name/%s/assets?limit=100",
                      SdkClients.getServerUrl(), domain.getFullyQualifiedName());

              java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
              java.net.http.HttpRequest request =
                  java.net.http.HttpRequest.newBuilder()
                      .uri(java.net.URI.create(url))
                      .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                      .header("Content-Type", "application/json")
                      .GET()
                      .build();

              java.net.http.HttpResponse<String> response =
                  httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

              assertEquals(200, response.statusCode());

              JsonNode root = OBJECT_MAPPER.readTree(response.body());
              JsonNode dataArray = root.path("data");

              int total =
                  root.has("paging") && root.path("paging").has("total")
                      ? root.path("paging").path("total").asInt()
                      : dataArray.size();

              assertEquals(
                  2,
                  total,
                  String.format(
                      "Domain should have exactly 2 assets (the tables), not %d (which would include %d columns)",
                      total, totalColumns));
            });
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Domain createDomain(OpenMetadataClient client, String name) {
    CreateDomain request = new CreateDomain();
    request.setName(name);
    request.setDescription("Test domain for column exclusion tests");
    request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    return client.domains().create(request);
  }

  private Table createTableWithColumnsInDomain(TestNamespace ns, String baseName, Domain domain) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("colexcl_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for column exclusion")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("colexcl_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("colexcl_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setDomains(List.of(domain.getFullyQualifiedName()));
    tableRequest.setColumns(
        List.of(
            new Column()
                .withName("col_id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Identifier"),
            new Column()
                .withName("col_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Name field"),
            new Column()
                .withName("col_ts")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Timestamp")));

    Table table = SdkClients.adminClient().tables().create(tableRequest);
    assertNotNull(table);
    return table;
  }

  /**
   * A domain assigned on a database <b>service</b> must be inherited all the way down to a nested
   * table (service -> database -> schema -> table). Exercised through the batch inheritance path
   * ({@code setInheritedFields(List, Fields)}) that list endpoints and the search reindex share, so
   * it guards the regression where the domain reached only the database (one level below the
   * service) while the single-entity read path still resolved it everywhere.
   */
  @Test
  void serviceLevelDomainInheritedByNestedTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    Domain domain = createDomain(client, "svc_inh_domain_" + shortId);

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();
    DatabaseService service =
        DatabaseServices.builder()
            .name("svc_inh_svc_" + shortId)
            .connection(conn)
            .description("Test service for service-level domain inheritance")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("svc_inh_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = client.databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("svc_inh_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    CreateTable tableReq = new CreateTable();
    tableReq.setName(ns.prefix("svc_inh_tbl"));
    tableReq.setDatabaseSchema(schema.getFullyQualifiedName());
    tableReq.setColumns(List.of(new Column().withName("c1").withDataType(ColumnDataType.BIGINT)));
    Table table = client.tables().create(tableReq);
    assertNotNull(table);

    // Assign the domain on the SERVICE, then confirm the nested table inherits it via a bulk/list
    // read (the same batch path the reindex uses to build search docs).
    addServiceToDomain(domain, service.getId().toString());

    Awaitility.await("nested table inherits the service-level domain via the batch/list path")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(() -> assertTrue(listedTableHasDomain(schema, table, domain)));
  }

  private void addServiceToDomain(Domain domain, String serviceId) throws Exception {
    String url =
        String.format(
            "%s/v1/domains/%s/assets/add",
            SdkClients.getServerUrl(), domain.getFullyQualifiedName());
    String body =
        String.format("{\"assets\":[{\"id\":\"%s\",\"type\":\"databaseService\"}]}", serviceId);
    java.net.http.HttpRequest request =
        java.net.http.HttpRequest.newBuilder()
            .uri(java.net.URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .PUT(java.net.http.HttpRequest.BodyPublishers.ofString(body))
            .build();
    java.net.http.HttpResponse<String> response =
        java.net.http.HttpClient.newHttpClient()
            .send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() == 200,
        "assets/add should return 200, got " + response.statusCode() + ": " + response.body());
  }

  private boolean listedTableHasDomain(DatabaseSchema schema, Table table, Domain domain)
      throws Exception {
    String url =
        String.format(
            "%s/v1/tables?databaseSchema=%s&fields=domains&limit=100",
            SdkClients.getServerUrl(), schema.getFullyQualifiedName());
    java.net.http.HttpRequest request =
        java.net.http.HttpRequest.newBuilder()
            .uri(java.net.URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .GET()
            .build();
    java.net.http.HttpResponse<String> response =
        java.net.http.HttpClient.newHttpClient()
            .send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
    JsonNode root = OBJECT_MAPPER.readTree(response.body());
    for (JsonNode t : root.path("data")) {
      if (table.getFullyQualifiedName().equals(t.path("fullyQualifiedName").asText())) {
        for (JsonNode d : t.path("domains")) {
          if (domain.getFullyQualifiedName().equals(d.path("fullyQualifiedName").asText())) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
