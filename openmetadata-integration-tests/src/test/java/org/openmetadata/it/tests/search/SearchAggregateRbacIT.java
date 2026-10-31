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
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.TopHits;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Verifies that the public {@code /v1/search/aggregate} endpoint enforces the caller's RBAC policy.
 * A non-admin user holding the seeded {@code DomainOnlyAccessRole} must only see aggregation buckets
 * and {@code topHits} snippets for documents in their own domains when search access control is enabled,
 * matching the document set the same caller receives on {@code /v1/search}. Admins are unfiltered.
 *
 * <p>The tests that call as the restricted user run embedded only. The harness signs that user's
 * token with its own key, which a deployed cluster does not trust, so every call would fail with
 * 401 there.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class SearchAggregateRbacIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String NAME_FREE_LETTERS = "jkmqsuvxyz";
  private static final String TABLE_INDEX = "table_search_index";
  private static final String ENTITY_TYPE_FIELD = "entityType";
  private static final String TABLE_ENTITY_TYPE = Entity.TABLE;
  private static final String MATCH_ALL_VALUE = ".*";
  private static final int BUCKET_SIZE = 100;
  private static final int TOP_HITS_SIZE = 10;
  private static final List<String> SOURCE_FIELDS = List.of("name", "fullyQualifiedName", "domain");
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);

  @Test
  void test_aggregate_restrictedUserSeesOnlyOwnDomain(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
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
                JsonNode aggResults = aggregate(restricted, TABLE_INDEX, ENTITY_TYPE_FIELD);
                Set<String> aggKeyNames = new HashSet<>();
                aggResults.path("aggregations").fieldNames().forEachRemaining(aggKeyNames::add);
                JsonNode tableBucket = findFirstBucketByKey(aggResults, TABLE_ENTITY_TYPE);
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
                JsonNode aggResults = aggregate(admin, TABLE_INDEX, ENTITY_TYPE_FIELD);
                JsonNode tableBucket = findFirstBucketByKey(aggResults, TABLE_ENTITY_TYPE);
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
    assumeTheServerTrustsHarnessSignedTokens();
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
                JsonNode adminAgg = aggregatePost(admin, TABLE_INDEX, ENTITY_TYPE_FIELD);
                JsonNode adminBucket = findFirstBucketByKey(adminAgg, TABLE_ENTITY_TYPE);
                long adminCount = adminBucket != null ? adminBucket.path("doc_count").asLong() : 0L;
                assertEquals(
                    2,
                    adminCount,
                    "Admin POST aggregate must include both tables. Bucket: " + adminBucket);

                // Restricted must only see own.
                JsonNode restrictedAgg = aggregatePost(restricted, TABLE_INDEX, ENTITY_TYPE_FIELD);
                JsonNode restrictedBucket = findFirstBucketByKey(restrictedAgg, TABLE_ENTITY_TYPE);
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
    String response = client.search().query(prefix + "*").index(TABLE_INDEX).size(1000).execute();
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
            .queryParam("value", MATCH_ALL_VALUE)
            .queryParam("q", "*")
            .queryParam("size", String.valueOf(BUCKET_SIZE))
            .queryParam("sourceFields", String.join(",", SOURCE_FIELDS))
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/search/aggregate", null, options);
    return MAPPER.readTree(response);
  }

  private JsonNode aggregatePost(OpenMetadataClient client, String index, String field)
      throws Exception {
    AggregationRequest request =
        new AggregationRequest()
            .withIndex(index)
            .withFieldName(field)
            .withFieldValue(MATCH_ALL_VALUE)
            .withQuery("*")
            .withSize(BUCKET_SIZE)
            .withSourceFields(SOURCE_FIELDS)
            .withTopHits(new TopHits().withSize(TOP_HITS_SIZE));
    String body = MAPPER.writeValueAsString(request);
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
    for (String aggName : (Iterable<String>) aggs::fieldNames) {
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
    for (String fieldName : (Iterable<String>) bucket::fieldNames) {
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
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private Table createTable(
      OpenMetadataClient admin,
      String name,
      DatabaseSchema schema,
      Domain domain,
      Deque<Runnable> cleanup) {
    return createTable(admin, name, schema, domain, COLUMN.getName(), cleanup);
  }

  private Table createTable(
      OpenMetadataClient admin,
      String name,
      DatabaseSchema schema,
      Domain domain,
      String columnName,
      Deque<Runnable> cleanup) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName(columnName).withDataType(ColumnDataType.INT)));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    Table table = admin.tables().create(create);
    cleanup.push(() -> admin.tables().delete(table.getId()));
    return table;
  }

  private static void assumeTheServerTrustsHarnessSignedTokens() {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Signs the restricted user's token with the harness key, which a deployed cluster rejects");
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
    User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  @Test
  void test_aggregate_accessControlOffShowsBothDomains(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
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
                JsonNode aggResults = aggregate(restricted, TABLE_INDEX, ENTITY_TYPE_FIELD);
                JsonNode tableBucket = findFirstBucketByKey(aggResults, TABLE_ENTITY_TYPE);
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

  /**
   * The column grid aggregates over the same documents search does, so with search access control
   * on, a restricted caller sees only the columns of tables their policies let them find.
   */
  @Test
  void test_columnGrid_restrictedUserSeesOnlyOwnDomainColumns(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      DatabaseSchema schema = createSchema(ns, cleanup);
      String ownColumn = p + "_owncol";
      String foreignColumn = p + "_foreigncol";
      createTable(admin, p + "_own_tbl", schema, own, ownColumn, cleanup);
      createTable(admin, p + "_foreign_tbl", schema, foreign, foreignColumn, cleanup);

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, own, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      Awaitility.await("both columns are indexed")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> assertEquals(Set.of(ownColumn, foreignColumn), gridColumnNames(admin, p)));
      assertEquals(Set.of(ownColumn), gridColumnNames(restricted, p));
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Hierarchy search rewrites the caller's query into one should clause among name matches. A term
   * must still meet the caller's access policies, query_filter and deleted flag to come back.
   */
  @Test
  void test_hierarchySearch_keepsPoliciesQueryFilterAndDeletedFlag(TestNamespace ns)
      throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      // Letters that never occur in the generated names, so only the display names below match
      String word =
          ThreadLocalRandom.current()
              .ints(14, 0, NAME_FREE_LETTERS.length())
              .mapToObj(i -> String.valueOf(NAME_FREE_LETTERS.charAt(i)))
              .collect(Collectors.joining());
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain foreign = createDomain(admin, p + "_foreign", cleanup);
      Glossary ownGlossary = createGlossary(admin, p + "_own_g", own, cleanup);
      Glossary foreignGlossary = createGlossary(admin, p + "_foreign_g", foreign, cleanup);
      GlossaryTerm ownTerm = createTerm(admin, ownGlossary, p + "_own_t", word + " own");
      GlossaryTerm foreignTerm =
          createTerm(admin, foreignGlossary, p + "_foreign_t", word + " foreign");
      GlossaryTerm goneTerm = createTerm(admin, ownGlossary, p + "_gone_t", word + " gone");
      admin.glossaryTerms().delete(goneTerm.getId().toString());

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, own, cleanup);
      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      Awaitility.await("terms and the deletion are indexed")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                String live = searchTerms(admin, word, false, false, null);
                assertTrue(live.contains(ownTerm.getFullyQualifiedName()), live);
                assertTrue(live.contains(foreignTerm.getFullyQualifiedName()), live);
                assertTrue(
                    searchTerms(admin, word, true, false, null)
                        .contains(goneTerm.getFullyQualifiedName()));
              });

      String restrictedTree = searchTerms(restricted, word, false, true, null);
      assertTrue(restrictedTree.contains(ownTerm.getFullyQualifiedName()), restrictedTree);
      assertFalse(restrictedTree.contains(foreignTerm.getFullyQualifiedName()), restrictedTree);
      assertFalse(restrictedTree.contains(goneTerm.getFullyQualifiedName()), restrictedTree);

      String ownGlossaryOnly =
          "{\"query\":{\"term\":{\"glossary.name.keyword\":\""
              + ownGlossary.getName().toLowerCase()
              + "\"}}}";
      String filteredTree = searchTerms(admin, word, false, true, ownGlossaryOnly);
      assertTrue(filteredTree.contains(ownTerm.getFullyQualifiedName()), filteredTree);
      assertFalse(filteredTree.contains(foreignTerm.getFullyQualifiedName()), filteredTree);
      assertFalse(filteredTree.contains(goneTerm.getFullyQualifiedName()), filteredTree);
    } finally {
      drain(cleanup);
    }
  }

  private Glossary createGlossary(
      OpenMetadataClient admin, String name, Domain domain, Deque<Runnable> cleanup) {
    Glossary glossary =
        admin
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(name)
                    .withDescription("Hierarchy search RBAC test glossary")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    cleanup.push(
        () ->
            admin
                .glossaries()
                .delete(
                    glossary.getId().toString(),
                    Map.of("hardDelete", "true", "recursive", "true")));
    return glossary;
  }

  private GlossaryTerm createTerm(
      OpenMetadataClient admin, Glossary glossary, String name, String displayName) {
    return admin
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDisplayName(displayName)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Hierarchy search RBAC test term"));
  }

  private String searchTerms(
      OpenMetadataClient client, String query, boolean deleted, boolean hierarchy, String filter) {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("q", query)
            .queryParam("index", "glossary_term_search_index")
            .queryParam("from", "0")
            .queryParam("size", "50")
            .queryParam("deleted", String.valueOf(deleted))
            .queryParam("getHierarchy", String.valueOf(hierarchy));
    if (filter != null) {
      options.queryParam("query_filter", filter);
    }
    return client
        .getHttpClient()
        .executeForString(HttpMethod.GET, "/v1/search/query", null, options.build());
  }

  private Set<String> gridColumnNames(OpenMetadataClient client, String pattern) throws Exception {
    String grid =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/grid",
                null,
                RequestOptions.builder().queryParam("columnNamePattern", pattern).build());
    Set<String> names = new HashSet<>();
    MAPPER
        .readTree(grid)
        .path("columns")
        .forEach(item -> names.add(item.path("columnName").asText()));
    return names;
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
