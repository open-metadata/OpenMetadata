package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableExecutionSource;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableSharding;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TableShardingIT {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "/tableSharding/prefix",
        "/tableSharding/suffixFormat",
        "/tableSharding/representative",
        "/tableSharding/shardCount",
        "/tableSharding/firstShardDate",
        "/tableSharding/lastShardDate",
        "/tableSharding/representative/databaseName",
        "/tableSharding/representative/schemaName",
        "/tableSharding/representative/tableName",
        "/tableSharding/representative/shardDate"
      })
  void patchCannotRemoveRequiredShardingFields(String path, TestNamespace ns) {
    var client = SdkClients.adminClient().tables();
    var original = client.create(request(ns));
    for (String operation : List.of("remove", "replace")) {
      var patch =
          JsonUtils.readTree(
              "[{\"op\":\"%s\",\"path\":\"%s\",\"value\":null}]".formatted(operation, path));
      assertEquals(
          400,
          assertThrows(OpenMetadataException.class, () -> client.patch(original.getId(), patch))
              .getStatusCode());
      var stored = client.get(original.getId().toString());
      assertEquals(original.getTableSharding(), stored.getTableSharding());
      assertEquals(original.getVersion(), stored.getVersion());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"databaseName", "schemaName", "tableName"})
  void patchCannotEmptyRepresentativeNames(String field, TestNamespace ns) {
    var client = SdkClients.adminClient().tables();
    var original = client.create(request(ns));
    var patch =
        JsonUtils.readTree(
            "[{\"op\":\"replace\",\"path\":\"/tableSharding/representative/%s\",\"value\":\"\"}]"
                .formatted(field));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> client.patch(original.getId(), patch))
            .getStatusCode());
    var stored = client.get(original.getId().toString());
    assertEquals(original.getTableSharding(), stored.getTableSharding());
    assertEquals(original.getVersion(), stored.getVersion());
  }

  @Test
  void representativeRolloverKeepsIdentityAndAnnotations(TestNamespace ns) {
    var request =
        request(ns)
            .withLifeCycle(new LifeCycle().withCreated(new AccessDetails().withTimestamp(2000L)));
    var original = SdkClients.adminClient().tables().create(request);
    SdkClients.adminClient()
        .tables()
        .patch(
            original.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Independently curated description\"}]"));
    request.withDescription(null);
    var execution = original.getTableSharding().getRepresentative();
    var client = SdkClients.adminClient();
    long timestamp = System.currentTimeMillis();
    client
        .tables()
        .updateTableProfile(
            original.getId(),
            new CreateTableProfile()
                .withTableProfile(
                    new TableProfile()
                        .withTimestamp(timestamp)
                        .withRowCount(1.0)
                        .withExecutionSource(execution))
                .withColumnProfile(
                    List.of(
                        new ColumnProfile()
                            .withName("id")
                            .withTimestamp(timestamp)
                            .withExecutionSource(execution))));
    client
        .tables()
        .updateSampleData(
            original.getId(),
            new TableData()
                .withColumns(List.of("id"))
                .withRows(List.of(List.of((Object) 1)))
                .withExecutionSource(execution));
    request.withLifeCycle(new LifeCycle().withCreated(new AccessDetails().withTimestamp(1000L)));
    request
        .getTableSharding()
        .withShardCount(2)
        .withLastShardDate("2026-01-02")
        .withRepresentative(
            request
                .getTableSharding()
                .getRepresentative()
                .withTableName("events_20260102")
                .withShardDate("2026-01-02"));
    var updated =
        SdkClients.ingestionBotClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/tables", request, Table.class);
    var stored = SdkClients.adminClient().tables().get(updated.getId().toString());
    assertEquals(original.getId(), stored.getId());
    assertEquals("Independently curated description", stored.getDescription());
    assertEquals("events_20260102", stored.getTableSharding().getRepresentative().getTableName());
    assertEquals(original.getCreatedAt(), stored.getCreatedAt());
    assertEquals(original.getCreatedBy(), stored.getCreatedBy());
    assertEquals(1000L, stored.getLifeCycle().getCreated().getTimestamp());
    assertTrue(stored.getVersion() > original.getVersion());
    var latest =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/tables/"
                    + stored.getFullyQualifiedName()
                    + "/tableProfile/latest?includeColumnProfile=true",
                null,
                Table.class);
    assertEquals("events_20260101", latest.getProfile().getExecutionSource().getTableName());
    assertEquals(
        "events_20260101",
        latest.getColumns().getFirst().getProfile().getExecutionSource().getTableName());
    assertEquals(
        "events_20260101",
        client
            .tables()
            .getSampleData(stored.getId())
            .getSampleData()
            .getExecutionSource()
            .getTableName());
  }

  @Test
  void contradictoryDescriptorIsRejected(TestNamespace ns) {
    var request = request(ns).withTableType(TableType.Regular);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.adminClient().tables().create(request))
            .getStatusCode());
    request.withTableType(TableType.Sharded);
    request.getTableSharding().withLastShardDate("2026-02-30");
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.adminClient().tables().create(request))
            .getStatusCode());
    request.getTableSharding().withLastShardDate("2025-12-31");
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.adminClient().tables().create(request))
            .getStatusCode());
  }

  @Test
  void suggestionSearchPreservesNestedAndPostFilters(TestNamespace ns) {
    var table = SdkClients.adminClient().tables().create(request(ns));
    var other = SdkClients.adminClient().tables().create(request(ns));
    var must =
        List.of(
            Map.of(
                "bool",
                Map.of(
                    "should",
                    List.of(Map.of("term", Map.of("service.name", table.getService().getName()))),
                    "minimum_should_match",
                    1)),
            Map.of("term", Map.of("serviceType", "BigQuery")),
            Map.of("term", Map.of("tableType", "Sharded")),
            Map.of("term", Map.of("name.keyword", "events_yyyymmdd")),
            Map.of("term", Map.of("database.name", table.getDatabase().getName())),
            Map.of("term", Map.of("databaseSchema.name", table.getDatabaseSchema().getName())));
    var filter = Map.of("query", Map.of("bool", Map.of("must", must)));
    var postFilter =
        Map.of("query", Map.of("term", Map.of("id.keyword", table.getId().toString())));
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              var response = search(filter, postFilter);
              assertEquals(1, response.path("hits").path("total").path("value").asInt());
              assertEquals(
                  table.getId().toString(),
                  response.path("hits").path("hits").get(0).path("_source").path("id").asText());
            });
    var excluded =
        search(
            filter,
            Map.of("query", Map.of("term", Map.of("id.keyword", other.getId().toString()))));
    assertEquals(0, excluded.path("hits").path("total").path("value").asInt());
  }

  private JsonNode search(Object filter, Object postFilter) {
    String url =
        "/v1/search/query?q=&index=table_search_index&from=0&size=10&deleted=false&query_filter="
            + URLEncoder.encode(JsonUtils.pojoToJson(filter), StandardCharsets.UTF_8)
            + "&post_filter="
            + URLEncoder.encode(JsonUtils.pojoToJson(postFilter), StandardCharsets.UTF_8);
    return JsonUtils.readTree(
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, url, null));
  }

  private CreateTable request(TestNamespace ns) {
    var client = SdkClients.adminClient();
    var serviceRequest =
        JsonUtils.readValue(
                """
        {"name":"demo_service","serviceType":"BigQuery","connection":{"config":{
          "type":"BigQuery","credentials":{"gcpConfig":{}}}}}
        """,
                CreateDatabaseService.class)
            .withName(ns.prefix("bigquery_" + UUID.randomUUID()));
    var service =
        ns.trackRoot(Entity.DATABASE_SERVICE, client.databaseServices().create(serviceRequest));
    var database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix("db"))
                    .withService(service.getFullyQualifiedName()));
    var schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("schema"))
                    .withDatabase(database.getFullyQualifiedName()));
    return new CreateTable()
        .withName("events_yyyymmdd")
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withDescription("Curated description")
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
        .withTableType(TableType.Sharded)
        .withTableSharding(
            new TableSharding()
                .withPrefix("events_")
                .withSuffixFormat(TableSharding.SuffixFormat.YYYYMMDD)
                .withShardCount(1)
                .withFirstShardDate("2026-01-01")
                .withLastShardDate("2026-01-01")
                .withRepresentative(
                    source("20260101", "2026-01-01")
                        .withDatabaseName(database.getName())
                        .withSchemaName(schema.getName())));
  }

  private TableExecutionSource source(String suffix, String date) {
    return new TableExecutionSource()
        .withDatabaseName("demo_project")
        .withSchemaName("demo_dataset")
        .withTableName("events_" + suffix)
        .withShardDate(date);
  }
}
