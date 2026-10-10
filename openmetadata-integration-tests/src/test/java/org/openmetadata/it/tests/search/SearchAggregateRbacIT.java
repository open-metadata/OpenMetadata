package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Verifies that the public {@code /v1/search/aggregate} endpoint enforces the caller's RBAC policy.
 * A non-admin user holding the seeded {@code DomainOnlyAccessRole} must only see aggregation buckets
 * and {@code topHits} snippets for documents in their own domains when search access control is enabled,
 * matching the document set the same caller receives on {@code /v1/search}. Admins are unfiltered.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class SearchAggregateRbacIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);

  @Test
  void test_aggregate_restrictedUserSeesOnlyOwnDomain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table ownTable = createTable(admin, p + "_own_tbl", schema, own, cleanup);
      Table foreignTable = createTable(admin, p + "_foreign_tbl", schema, foreign, cleanup);

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, own, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      // Wait for indexing of both tables so the listing aggregation is populated.
      Awaitility.await("restricted listing hides the foreign table")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Set<String> listingFqns = searchListingFqns(restricted, p);
                assertTrue(
                    listingFqns.contains(ownTable.getFullyQualifiedName()),
                    "Own table visible in listing. Saw: " + listingFqns);
                assertFalse(
                    listingFqns.contains(foreignTable.getFullyQualifiedName()),
                    "Foreign table must be hidden from restricted user's listing. Saw: "
                        + listingFqns);
              });

      // GET /v1/search/aggregate — bucket counts per entityType.
      // The listing is hidden from the restricted user but the FIX should also hide it from the
      // aggregation.
      Awaitility.await("aggregate buckets match the restricted user's permitted set")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                JsonNode aggResults = aggregate(restricted, "table_search_index", "entityType");
                Set<String> aggKeyNames = new HashSet<>();
                aggResults.path("aggregations").fieldNames().forEachRemaining(aggKeyNames::add);
                JsonNode tableBucket = findFirstBucketByKey(aggResults, "table");
                long bucketCount =
                    tableBucket != null ? tableBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    1,
                    bucketCount,
                    "Restricted aggregate bucket must only count own-domain table. "
                        + "Agg keys: "
                        + aggKeyNames
                        + ", tableBucket: "
                        + tableBucket);

                Set<String> topHitNames = topHitFieldValues(tableBucket, "name");
                assertTrue(
                    topHitNames.contains(ownTable.getName()),
                    "Own table name in aggregate topHits. Saw: " + topHitNames);
                assertFalse(
                    topHitNames.contains(foreignTable.getName()),
                    "Foreign table name must NOT appear in aggregate topHits. Saw: " + topHitNames);
              });
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_aggregate_adminSeesBothDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table ownTable = createTable(admin, p + "_own_tbl", schema, own, cleanup);
      Table foreignTable = createTable(admin, p + "_foreign_tbl", schema, foreign, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      Awaitility.await("admin sees both tables in aggregate")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                JsonNode aggResults = aggregate(admin, "table_search_index", "entityType");
                JsonNode tableBucket = findFirstBucketByKey(aggResults, "table");
                long bucketCount =
                    tableBucket != null ? tableBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    2,
                    bucketCount,
                    "Admin aggregate bucket must include both tables. Bucket: " + tableBucket);

                Set<String> topHitNames = topHitFieldValues(tableBucket, "name");
                assertTrue(
                    topHitNames.contains(ownTable.getName()),
                    "Admin sees own-domain name in aggregate topHits");
                assertTrue(
                    topHitNames.contains(foreignTable.getName()),
                    "Admin sees foreign-domain name in aggregate topHits. Saw: " + topHitNames);
              });
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_aggregate_postEndpointAlsoRestricts(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table ownTable = createTable(admin, p + "_own_tbl", schema, own, cleanup);
      Table foreignTable = createTable(admin, p + "_foreign_tbl", schema, foreign, cleanup);

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, own, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      // POST /v1/search/aggregate
      Awaitility.await("POST aggregate buckets match the restricted user's permitted set")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                // First make sure admin can see both.
                JsonNode adminAgg = aggregatePost(admin, "table_search_index", "entityType");
                JsonNode adminBucket = findFirstBucketByKey(adminAgg, "table");
                long adminCount = adminBucket != null ? adminBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    2,
                    adminCount,
                    "Admin POST aggregate must include both tables. Bucket: " + adminBucket);

                // Restricted must only see own.
                JsonNode restrictedAgg =
                    aggregatePost(restricted, "table_search_index", "entityType");
                JsonNode restrictedBucket = findFirstBucketByKey(restrictedAgg, "table");
                long restrictedCount =
                    restrictedBucket != null ? restrictedBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    1,
                    restrictedCount,
                    "Restricted POST aggregate must only count own-domain table. Bucket: "
                        + restrictedBucket);

                Set<String> topHitNames = topHitFieldValues(restrictedBucket, "name");
                assertTrue(
                    topHitNames.contains(ownTable.getName()),
                    "Own table name in POST aggregate topHits");
                assertFalse(
                    topHitNames.contains(foreignTable.getName()),
                    "Foreign table name must NOT appear in POST aggregate topHits. Saw: "
                        + topHitNames);
              });
    } finally {
      drain(cleanup);
    }
  }

  private Set<String> searchListingFqns(OpenMetadataClient client, String prefix) throws Exception {
    String response =
        client.search().query(prefix + "*").index("table_search_index").size(1000).execute();
    JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
    Set<String> fqns = new HashSet<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (source.hasNonNull("fullyQualifiedName")) {
        fqns.add(source.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  private JsonNode aggregate(OpenMetadataClient client, String index, String field)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("index", index)
            .queryParam("field", field)
            .queryParam("value", ".*")
            .queryParam("q", "*")
            .queryParam("size", "100")
            .queryParam("sourceFields", "name,fullyQualifiedName,domain")
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/search/aggregate", null, options);
    return MAPPER.readTree(response);
  }

  private JsonNode aggregatePost(OpenMetadataClient client, String index, String field)
      throws Exception {
    String body =
        "{"
            + "\"index\":\""
            + index
            + "\","
            + "\"fieldName\":\""
            + field
            + "\","
            + "\"fieldValue\":\".*\","
            + "\"query\":\"*\","
            + "\"size\":100,"
            + "\"sourceFields\":[\"name\",\"fullyQualifiedName\",\"domain\"],"
            + "\"topHits\":{\"size\":10}"
            + "}";
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/search/aggregate", body, RequestOptions.builder().build());
    return MAPPER.readTree(response);
  }

  private Set<String> bucketFieldValues(JsonNode aggregations, String aggFieldPath) {
    Set<String> values = new HashSet<>();
    JsonNode buckets = aggregations.path(aggFieldPath).path("buckets");
    for (JsonNode bucket : buckets) {
      if (bucket.hasNonNull("key")) {
        values.add(bucket.get("key").asText());
      }
    }
    return values;
  }

  private JsonNode findBucketByKey(JsonNode aggregations, String aggFieldPath, String key) {
    JsonNode buckets = aggregations.path(aggFieldPath).path("buckets");
    for (JsonNode bucket : buckets) {
      if (bucket.hasNonNull("key") && key.equals(bucket.get("key").asText())) {
        return bucket;
      }
    }
    return null;
  }

  /**
   * Searches every aggregation path (the agg name may be "entityType", "entityType.keyword",
   * "sterms#entityType", etc. — depending on aggregation field resolution and serialization)
   * for a bucket whose key equals {@code key}.
   */
  private JsonNode findFirstBucketByKey(JsonNode aggregations, String key) {
    JsonNode aggs = aggregations.path("aggregations");
    for (String aggName :
        new Iterable<String>() {
          @Override
          public java.util.Iterator<String> iterator() {
            return aggs.fieldNames();
          }
        }) {
      JsonNode buckets = aggs.path(aggName).path("buckets");
      for (JsonNode bucket : buckets) {
        if (bucket.hasNonNull("key") && key.equals(bucket.get("key").asText())) {
          return bucket;
        }
      }
    }
    return null;
  }

  private Set<String> topHitFieldValues(JsonNode bucket, String field) {
    Set<String> values = new HashSet<>();
    if (bucket == null) {
      return values;
    }
    // The sub-aggregation that returns top hits is named "top_hits#top" in the ES/OS serialized
    // response (a `top_hits` aggregation under key "top"), so find it by suffix.
    JsonNode topHitsAgg = null;
    for (String fieldName :
        new Iterable<String>() {
          @Override
          public java.util.Iterator<String> iterator() {
            return bucket.fieldNames();
          }
        }) {
      if (fieldName.contains("top_hits") || fieldName.equals("top")) {
        topHitsAgg = bucket.path(fieldName);
        break;
      }
    }
    if (topHitsAgg == null) {
      return values;
    }
    JsonNode topHits = topHitsAgg.path("hits").path("hits");
    for (JsonNode hidden : topHits) {
      JsonNode node = hidden.path("_source").path(field);
      if (node.isTextual()) {
        values.add(node.asText());
      }
    }
    return values;
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Aggregate RBAC test domain");
    Domain domain = admin.domains().create(create);
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  private DatabaseSchema createSchema(TestNamespace ns, Deque<Runnable> cleanup) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    cleanup.push(
        () ->
            SdkClients.adminClient()
                .databaseServices()
                .delete(
                    service.getId().toString(),
                    java.util.Map.of("recursive", "true", "hardDelete", "true")));
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private Table createTable(
      OpenMetadataClient admin,
      String name,
      DatabaseSchema schema,
      Domain domain,
      Deque<Runnable> cleanup) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(COLUMN));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    Table table = admin.tables().create(create);
    cleanup.push(() -> admin.tables().delete(table.getId()));
    return table;
  }

  private OpenMetadataClient createRestrictedUserClient(
      OpenMetadataClient admin, String prefix, Domain allowedDomain, Deque<Runnable> cleanup) {
    Role domainOnlyRole = admin.roles().getByName("DomainOnlyAccessRole");
    String name = prefix + "_restricted";
    String email = name + "@test.openmetadata.org";
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnlyRole.getId()));
    org.openmetadata.schema.entity.teams.User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  @Test
  void test_aggregate_accessControlOffShowsBothDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      Table ownTable = createTable(admin, p + "_own_tbl", schema, own, cleanup);
      Table foreignTable = createTable(admin, p + "_foreign_tbl", schema, foreign, cleanup);

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, own, cleanup);

      // Explicitly disable ACL so RBAC filter is not applied — restricted user must see both.
      boolean originalAccessControl = disableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      Awaitility.await("access-control off shows both tables to restricted user")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                JsonNode aggResults = aggregate(restricted, "table_search_index", "entityType");
                JsonNode tableBucket = findFirstBucketByKey(aggResults, "table");
                long bucketCount =
                    tableBucket != null ? tableBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    2,
                    bucketCount,
                    "Restricted user WITH ACL off must see both tables. Bucket: " + tableBucket);

                Set<String> topHitNames = topHitFieldValues(tableBucket, "name");
                assertTrue(
                    topHitNames.contains(ownTable.getName()),
                    "Own table name visible with ACL off. Saw: " + topHitNames);
                assertTrue(
                    topHitNames.contains(foreignTable.getName()),
                    "Foreign table name visible with ACL off (backward compat). Saw: "
                        + topHitNames);
              });
    } finally {
      drain(cleanup);
    }
  }

  private boolean disableSearchAccessControl(OpenMetadataClient admin) throws Exception {
    return setAccessControl(admin, false);
  }

  private boolean setAccessControl(OpenMetadataClient admin, boolean enabled) throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean original =
        Boolean.TRUE.equals(searchConfig.getGlobalSettings().getEnableAccessControl());
    searchConfig.getGlobalSettings().setEnableAccessControl(enabled);
    Settings updated =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(updated),
            RequestOptions.builder().build());
    return original;
  }

  private boolean enableSearchAccessControl(OpenMetadataClient admin) throws Exception {
    return setAccessControl(admin, true);
  }

  private void restoreSearchAccessControl(OpenMetadataClient admin, boolean original) {
    if (!original) {
      try {
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
      } catch (Exception ignored) {
        // Best-effort restore.
      }
    }
  }

  private void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; concurrent namespaces keep tests isolated regardless.
      }
    }
  }
}
