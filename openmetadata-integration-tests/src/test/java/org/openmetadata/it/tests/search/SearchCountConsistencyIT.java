package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@ExtendWith(TestNamespaceExtension.class)
class SearchCountConsistencyIT {
  private static final List<String> NAMES = List.of("customer", "customer_archive", "custoner");

  @Test
  void compositeAliasCountsIncludeGovernanceWithTheSameMatchingRules(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String glossary = GlossaryTestFactory.createSimple(ns).getFullyQualifiedName();
    String classification =
        ns.trackRoot(
                Entity.CLASSIFICATION,
                client
                    .classifications()
                    .create(
                        new CreateClassification()
                            .withName(ns.prefix("classification"))
                            .withDescription("Count regression")))
            .getFullyQualifiedName();
    List<String> ids = new ArrayList<>();
    for (String suffix : NAMES) {
      String name = ns.prefix(suffix);
      ids.add(
          client
              .glossaryTerms()
              .create(
                  new CreateGlossaryTerm()
                      .withName(name)
                      .withGlossary(glossary)
                      .withDescription("Count regression"))
              .getId()
              .toString());
      ids.add(
          client
              .tags()
              .create(
                  new CreateTag()
                      .withName(name)
                      .withClassification(classification)
                      .withDescription("Count regression"))
              .getId()
              .toString());
      var domain =
          ns.trackRoot(
              Entity.DOMAIN,
              client
                  .domains()
                  .create(
                      new CreateDomain()
                          .withName(name)
                          .withDomainType(CreateDomain.DomainType.AGGREGATE)
                          .withDescription("Count regression")));
      ids.add(domain.getId().toString());
      ids.add(
          ns.trackRoot(
                  Entity.DATA_PRODUCT,
                  client
                      .dataProducts()
                      .create(
                          new CreateDataProduct()
                              .withName(name)
                              .withDomains(List.of(domain.getFullyQualifiedName()))
                              .withDescription("Count regression")))
              .getId()
              .toString());
    }
    String filter =
        JsonUtils.pojoToJson(Map.of("query", Map.of("terms", Map.of("id.keyword", ids))));
    assertTrue(
        RankingSupport.awaitTrue(
            () -> total(governanceSearch(client, "query", "all", "*", filter)) == ids.size()));
    for (String query : List.of(ns.prefix("customer"), ns.prefix("custoner"), "*")) {
      JsonNode counts =
          governanceSearch(client, "entityTypeCounts", "dataAsset,domain", query, filter);
      long expectedTotal = 0;
      for (String type : List.of("glossaryTerm", "tag", "domain", "dataProduct")) {
        long expected = total(governanceSearch(client, "query", type, query, filter));
        assertTrue(expected > 0, type + " must have matching fixtures");
        long actual = 0;
        for (JsonNode bucket : counts.at("/aggregations/entityType/buckets")) {
          if (type.equals(bucket.path("key").asText())) {
            actual = bucket.path("doc_count").asLong();
          }
        }
        assertEquals(expected, actual, type + " count for " + query);
        expectedTotal += expected;
      }
      assertEquals(expectedTotal, total(counts));
    }
  }

  private static JsonNode governanceSearch(
      OpenMetadataClient client, String endpoint, String index, String query, String filter) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/search/" + endpoint,
            null,
            JsonNode.class,
            RequestOptions.builder()
                .queryParam("q", query)
                .queryParam("index", index)
                .queryParam("size", "0")
                .queryParam("track_total_hits", "true")
                .queryParam("query_filter", filter)
                .build());
  }

  @Test
  void exactMatchInAnotherTypeDoesNotSuppressFuzzyResults(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String service = seed(client, ns, "databaseSchema");
    String schema =
        DatabaseSchemaTestFactory.create(service + "." + ns.prefix("db"), "inventory")
            .getFullyQualifiedName();
    createTable(client, schema, "custoner", List.of("row_id"));
    assertTrue(
        RankingSupport.awaitTrue(
            () -> total(search(client, service, "table", "customer", Map.of())) == 1));
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("q", "customer")
            .queryParam("index", "dataAsset")
            .queryParam("query_filter", serviceFilter(service))
            .build();
    JsonNode counts =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/search/entityTypeCounts", null, JsonNode.class, options);
    assertEquals(
        0, counts.at("/hits/hits").size(), "count-only clients must not receive probe hits");
    RequestOptions hintOptions =
        RequestOptions.builder()
            .queryParams(options.getQueryParams())
            .queryParam("include_top_hit", "true")
            .build();
    JsonNode hint =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/search/entityTypeCounts", null, JsonNode.class, hintOptions);
    assertEquals("databaseSchema", hint.at("/hits/hits/0/_source/entityType").asText());
    assertFalse(
        hint.at("/hits/hits/0/_source").has("name"),
        "private probe fields must not leak in the hint");
    for (String index : List.of("databaseSchema", "table", "tableColumn")) {
      long expected = total(search(client, service, index, "customer", Map.of("size", "15")));
      long actual = 0;
      JsonNode aggregations = counts.path("aggregations");
      JsonNode entityTypes =
          aggregations.has("entityType")
              ? aggregations.path("entityType")
              : aggregations.path("sterms#entityType");
      for (JsonNode bucket : entityTypes.path("buckets")) {
        if (bucket.path("key").asText().equals(index)) {
          actual = bucket.path("doc_count").asLong();
        }
      }
      assertEquals(
          expected, actual, "count must use the " + index + " query, not the composite query");
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"databaseSchema", "table", "tableColumn"})
  void countsAndPagesUseTheSameMatchesRegardlessOfProjection(String index, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String service = seed(client, ns, index);
    assertTrue(
        RankingSupport.awaitTrue(() -> total(search(client, service, index, "*", Map.of())) == 3));

    JsonNode results = search(client, service, index, "customer", Map.of("size", "15"));
    assertEquals(
        2, total(results), "exact and lexical matches survive, fuzzy-only sibling does not");
    for (Map<String, String> projection :
        List.of(
            Map.of("include_source_fields", "entityType"),
            Map.of("fetch_source", "false"),
            Map.of("exclude_source_fields", "name", "size", "0"))) {
      JsonNode count = search(client, service, index, "customer", projection);
      assertEquals(
          total(results), total(count), "projection must not change matching: " + projection);
      for (JsonNode hit : count.path("hits").path("hits")) {
        assertFalse(hit.path("_source").has("name"), "internal probe fields must not leak");
      }
    }
    JsonNode page = search(client, service, index, "customer", Map.of("from", "1", "size", "1"));
    assertEquals(total(results), total(page));
    assertEquals(results.at("/hits/hits/1/_id"), page.at("/hits/hits/0/_id"));
    assertEquals(
        1, total(search(client, service, index, "custoner", Map.of("fetch_source", "false"))));
    for (String query : List.of("custmer", "customer archive", "*")) {
      long expected = total(search(client, service, index, query, Map.of("size", "15")));
      assertTrue(expected > 0, "fallback must remain searchable: " + query);
      assertEquals(
          expected, total(search(client, service, index, query, Map.of("fetch_source", "false"))));
    }
    JsonNode sorted =
        search(
            client,
            service,
            index,
            "customer",
            Map.of("size", "15", "sort_field", "name.keyword", "sort_order", "asc"));
    assertEquals(total(results), total(sorted));
    JsonNode cursor = cursorPage(client, service, index, sorted.at("/hits/hits/0/sort"));
    assertEquals(total(results), total(cursor));
    assertEquals(sorted.at("/hits/hits/1/_id"), cursor.at("/hits/hits/0/_id"));
  }

  @Test
  void countsHonorDeletedAndPostFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String service = seed(client, ns, "table");
    String fqn = service + "." + ns.prefix("db") + ".inventory.customer";
    client.tables().delete(client.tables().getByName(fqn).getId());
    assertTrue(
        RankingSupport.awaitTrue(
            () -> total(search(client, service, "table", "*", Map.of("deleted", "true"))) == 1));
    for (String deleted : List.of("false", "true")) {
      for (String postFilter :
          List.of("", "{\"query\":{\"term\":{\"name.keyword\":\"custoner\"}}}")) {
        Map<String, String> overrides = Map.of("deleted", deleted, "post_filter", postFilter);
        long expected = total(search(client, service, "table", "*", overrides));
        RequestOptions options =
            RequestOptions.builder()
                .queryParam("q", "*")
                .queryParam("index", "table")
                .queryParam("query_filter", serviceFilter(service))
                .queryParams(overrides)
                .build();
        JsonNode counts =
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET, "/v1/search/entityTypeCounts", null, JsonNode.class, options);
        assertEquals(expected, total(counts), overrides.toString());
      }
    }
  }

  private static String seed(OpenMetadataClient client, TestNamespace ns, String index) {
    String service = DatabaseServiceTestFactory.createPostgres(ns).getFullyQualifiedName();
    String database = DatabaseTestFactory.create(ns, service).getFullyQualifiedName();
    if (index.equals("databaseSchema")) {
      NAMES.forEach(name -> DatabaseSchemaTestFactory.create(database, name));
    } else {
      String schema =
          DatabaseSchemaTestFactory.create(database, "inventory").getFullyQualifiedName();
      if (index.equals("table")) {
        NAMES.forEach(name -> createTable(client, schema, name, List.of("row_id")));
      } else {
        createTable(client, schema, "records", NAMES);
      }
    }
    return service;
  }

  private static Table createTable(
      OpenMetadataClient client, String schema, String name, List<String> columns) {
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema)
                .withColumns(
                    columns.stream()
                        .map(
                            column ->
                                new Column().withName(column).withDataType(ColumnDataType.INT))
                        .toList()));
  }

  private static JsonNode search(
      OpenMetadataClient client,
      String service,
      String index,
      String query,
      Map<String, String> overrides) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("q", query)
            .queryParam("index", index)
            .queryParam("size", "1")
            .queryParam("track_total_hits", "true")
            .queryParam("query_filter", serviceFilter(service))
            .queryParams(overrides)
            .build();
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/search/query", null, JsonNode.class, options);
  }

  private static long total(JsonNode response) {
    return response.at("/hits/total/value").asLong();
  }

  private static String serviceFilter(String service) {
    return "{\"query\":{\"term\":{\"service.name\":\"" + service + "\"}}}";
  }

  private static JsonNode cursorPage(
      OpenMetadataClient client, String service, String index, JsonNode sort) {
    List<String> values = new ArrayList<>();
    sort.forEach(
        value ->
            values.add(
                "search_after=" + URLEncoder.encode(value.asText(), StandardCharsets.UTF_8)));
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("q", "customer")
            .queryParam("index", index)
            .queryParam("size", "1")
            .queryParam("fetch_source", "false")
            .queryParam("sort_field", "name.keyword")
            .queryParam("sort_order", "asc")
            .queryParam("query_filter", serviceFilter(service))
            .build();
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/search/query?" + String.join("&", values),
            null,
            JsonNode.class,
            options);
  }
}
