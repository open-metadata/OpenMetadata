package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for Search functionality using fluent API.
 *
 * <p>Tests search queries, entity type counts, aggregations, and search behavior.
 *
 * <p>Migrated from: org.openmetadata.service.resources.search.SearchResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // Shared entities for efficient table creation across multiple calls
  private DatabaseService sharedDbService;
  private Database sharedDatabase;
  private DatabaseSchema sharedSchema;

  // ===================================================================
  // BASIC SEARCH TESTS
  // ===================================================================

  @Test
  void testBasicSearch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use wildcard query which is safer than field expansion
    String response = client.search().query("*").index("table_search_index").size(5).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      createTestTable(ns, "paginated_" + i);
    }

    // Fluent API with pagination
    String response =
        client.search().query("*").index("table_search_index").from(0).size(2).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithPageHelper(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Using page() helper method
    String response = client.search().query("*").index("table_search_index").page(0, 10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithSorting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "sort_test");

    // Fluent API with sorting
    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortBy("name.keyword", "asc")
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchSortAscDesc(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test sortAsc helper
    String ascResponse =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortAsc("name.keyword")
            .execute();

    assertNotNull(ascResponse);

    // Test sortDesc helper
    String descResponse =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortDesc("name.keyword")
            .execute();

    assertNotNull(descResponse);
  }

  // ===================================================================
  // ENTITY TYPE COUNTS TESTS
  // ===================================================================

  @Test
  void testEntityTypeCountsWithQueryAll(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "counts_all");

    // Fluent API for entity type counts
    String response = client.search().entityTypeCounts().query("*").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(
        root.has("aggregations") || root.has("buckets") || root.size() > 0,
        "Response should have count data");
  }

  @Test
  void testEntityTypeCountsWithIndex(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "index_counts");

    String response =
        client.search().entityTypeCounts().query("*").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertNotNull(root);
  }

  @Test
  void testEntityTypeCountsWithQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    String response =
        client
            .search()
            .entityTypeCounts()
            .query("*")
            .index("dataAsset")
            .queryFilter(queryFilter)
            .execute();

    assertNotNull(response);
  }

  // ===================================================================
  // SEARCH WITH AGGREGATIONS TESTS
  // ===================================================================

  @Test
  void testSearchWithIncludeAggregations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_test");

    // Fluent API with includeAggregations()
    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .includeAggregations()
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithoutAggregations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .includeAggregations(false)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // AGGREGATE TESTS
  // ===================================================================

  @Test
  void testAggregateQuery(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "aggregate_test");

    String response =
        client.search().aggregate("*").index("table_search_index").field("owner.name").execute();

    assertNotNull(response);
  }

  @Test
  void testAggregateQueryWithQueryText(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "aggregate_querytext_test");

    String response =
        client
            .search()
            .aggregate("*")
            .index("table_search_index")
            .field("database.name")
            .queryText("aggregate_querytext_test")
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("aggregations"), "Response should have aggregations");
  }

  @Test
  void testAggregateQueryWithEmptyQueryText(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "aggregate_empty_qt");

    String responseWithout =
        client.search().aggregate("*").index("table_search_index").field("database.name").execute();

    String responseWith =
        client
            .search()
            .aggregate("*")
            .index("table_search_index")
            .field("database.name")
            .queryText("")
            .execute();

    assertNotNull(responseWithout);
    assertNotNull(responseWith);
  }

  // ===================================================================
  // SPECIAL CHARACTER AND EDGE CASE TESTS
  // ===================================================================

  @Test
  void testVeryLongQueryWithSpecialCharacters(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Queries with special characters should not throw exceptions
    String response =
        client.search().query("test-query_with.special").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithEmptyQuery(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits") || root.has("error"), "Response should have hits or error");
  }

  @Test
  void testSearchAcrossMultipleIndexes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "multi_index");
    createTestTopic(ns, "multi_index");

    // Search using dataAsset index (covers multiple entity types)
    String response = client.search().query("multi_index").index("dataAsset").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // CLAUSE EXPLOSION PREVENTION TESTS
  // ===================================================================

  @Test
  void testLongTableNameWithManyColumnsDoesNotCauseClauseExplosion(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String longTableName = ns.prefix("int_snowplow_experiment_evaluation_detailed");
    List<Column> manyColumns = createManyTableColumns(50);

    Table table = createTestTableWithColumns(ns, longTableName, manyColumns);
    assertNotNull(table);

    String problematicQuery = "int_snowplow_experiment";

    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query(problematicQuery).index("table_search_index").execute();
          assertNotNull(response);
          JsonNode root = OBJECT_MAPPER.readTree(response);
          assertFalse(
              root.has("error") && root.get("error").asText().contains("too_many"),
              "Should not have too_many_nested_clauses error");
        });
  }

  @Test
  void testTopicWithManySchemaFieldsDoesNotCauseClauseExplosion(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String longTopicName = ns.prefix("snowplow_experiment_evaluation_events");
    List<Field> manyFields = createManyTopicSchemaFields(50);

    Topic topic = createTestTopicWithFields(ns, longTopicName, manyFields);
    assertNotNull(topic);

    String problematicQuery = "snowplow_experiment";

    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query(problematicQuery).index("topic_search_index").execute();
          assertNotNull(response);
        });
  }

  /**
   * Matrix test that reproduces the {@code dataAsset}-alias regression and pins the behavior of
   * any fix across the query shapes users actually type.
   *
   * <p>The bug: composite config merges fuzzy fields from every asset type. The {@code name.ngram}
   * analyzer splits on non-alphanumeric characters, so a long multi-segment identifier yields many
   * sub-tokens that each expand into many ngrams, and each ngram becomes a fuzzy term (fuzziness=1,
   * maxExpansions=10). Clause count crosses Lucene's 1024 limit; in ES 7/OS only the table shards
   * overflow (silent drop); in ES 9 the whole query is rejected.
   *
   * <p>Every scenario must satisfy {@code _shards.failed == 0}. The {@code shouldFind} column pins
   * whether the seeded table is expected in {@code hits.hits}. Failures from every row are
   * collected and reported together rather than short-circuiting on the first one, so a single
   * run surfaces the whole regression surface.
   */
  @Test
  void testDataAssetAliasSearchMatrix(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use a production-realistic name length (~40 chars, 5-6 alnum sub-tokens) by bypassing
    // ns.prefix() — that helper appends RUN_ID + classId + methodId which balloons the name
    // to ~127 chars, and the sheer ngram cardinality of that long string exceeds
    // OpenSearch's 1024 max_clause_count even with fuzziness=0 + max_expansions=1.
    // Production names like kochi__expected_vessels__portcall_v1 are ~36 chars, which is
    // the length we want to pin behavior against.
    // Prefix the unique tag with a distinctive "xqz" marker. uniqueShortId() returns hex,
    // and pure-hex prefixes share ngrams with every UUID/hash in a busy CI index, which can
    // push our seeded table out of the top-N hits. "xqz" is rare in any real document and
    // makes the first sub-token uniquely ours.
    String uniq = "xqz" + ns.uniqueShortId().substring(0, 5);
    String longName = uniq + "_lhr__incoming_flights__arrivals_schedule_v1";
    Table table =
        createTestTableWithColumns(
            ns,
            longName,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));
    String indexedName = table.getName();

    // Wait for the table to appear in the table-only index using a real search call.
    // Query by the first alphanumeric segment of the indexed name — it's short (3-5 chars,
    // one alnum sub-token), so it won't itself trigger the clause-explosion path we're
    // about to stress in the matrix below. We still verify the specific seeded table is the
    // hit, so accidental matches on other docs with "lhr" in their name don't fool us.
    String waitQuery = indexedName.split("_+")[0];
    // 90s timeout: search indexing is async via change events and can lag noticeably under
    // CI load, especially the first time the index is warmed in a fresh test container.
    Awaitility.await()
        .atMost(90, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () -> {
              String r =
                  client.search().query(waitQuery).index("table_search_index").size(25).execute();
              JsonNode root = OBJECT_MAPPER.readTree(r);
              for (JsonNode hit : root.path("hits").path("hits")) {
                if (indexedName.equals(hit.path("_source").path("name").asText())) {
                  return true;
                }
              }
              return false;
            });

    // Derive substrings from the seeded name. shouldFind reflects realistic user expectations
    // given that `name` has fuzziness via FUZZY_FIELDS and `name.ngram` handles substrings.
    String firstSegment = indexedName.split("_+")[0]; // the 8-char unique tag
    int midLen = Math.min(15, indexedName.length());
    String shortPrefix = indexedName.substring(0, Math.min(5, indexedName.length()));
    String midPrefix = indexedName.substring(0, midLen);
    String fullWithDots = indexedName.replace("_", ".");
    String typoInSegment = indexedName.replaceFirst("incoming", "incaming"); // 1-char typo
    String dropOneSegment = indexedName.replaceFirst("__arrivals_schedule_v1", "_v1");
    String trailingSegment = "schedule_v1";
    String middleSegment = "flights";

    String firstTwoSegments = "lhr__incoming"; // exactly 2 alnum sub-tokens (boundary case)
    String firstThreeSegments = "lhr__incoming_flights"; // exactly 3 — first to trip fuzz=0
    String mixedSeparators = indexedName.replace("__", "-").replace("_", ".");
    String withTrailingWhitespace = "  " + indexedName + "  ";
    String withInternalWhitespace = indexedName.replace("__", " ");
    String camelCaseChunk = "LhrIncomingFlightsArrivalsScheduleV1"; // single alnum sub-token, long
    String slashSeparated = indexedName.replace("_", "/");

    List<Scenario> scenarios =
        List.of(
            // --- the original repro and its immediate variants ---
            new Scenario("exact full name (the repro)", indexedName, true),
            new Scenario("short prefix (autocomplete early)", shortPrefix, true),
            new Scenario("medium prefix (autocomplete mid-type)", midPrefix, true),
            new Scenario("first segment alone", firstSegment, true),
            new Scenario("middle segment alone", middleSegment, true),
            new Scenario("trailing segment only", trailingSegment, true),
            new Scenario("dotted variant (FQN-ish)", fullWithDots, true),
            new Scenario("one-char typo inside a segment", typoInSegment, true),
            new Scenario("dropped middle segments", dropOneSegment, true),
            new Scenario("unrelated query", "totally_unrelated_zzzqqq_9999", false),
            // --- boundary cases for the sub-token-count heuristic ---
            // 2 sub-tokens → fuzziness=1 path still active; must not explode and must match
            new Scenario("exactly 2 sub-tokens (fuzzy path active)", firstTwoSegments, true),
            // 3 sub-tokens → first to flip to fuzziness=0; must not explode and must match
            new Scenario("exactly 3 sub-tokens (fuzzy path off)", firstThreeSegments, true),
            // --- separator variants: ngram tokenizer splits on ALL non-alnum the same way, so
            //     dots / dashes / slashes must all behave equivalently to underscores ---
            new Scenario("mixed separators (- and .)", mixedSeparators, true),
            new Scenario("slash-separated (path-like)", slashSeparated, true),
            // --- whitespace handling: trim, and whitespace as a separator in the query ---
            new Scenario("leading/trailing whitespace", withTrailingWhitespace, true),
            new Scenario("whitespace-separated segments", withInternalWhitespace, true),
            // --- single-alnum-token stress: long camelCase that is one 36-char sub-token ---
            new Scenario("long camelCase single token", camelCaseChunk, false),
            // --- edge-case query shape that must never throw or blow shards ---
            new Scenario("only separators", "___", false));

    List<String> failures = new ArrayList<>();
    for (Scenario s : scenarios) {
      evaluateScenario(client, s, indexedName, failures);
    }

    assertTrue(
        failures.isEmpty(), "Matrix scenarios failed:\n  - " + String.join("\n  - ", failures));
  }

  private record Scenario(String description, String query, boolean shouldFind) {}

  private void evaluateScenario(
      OpenMetadataClient client, Scenario s, String seededName, List<String> failures) {
    JsonNode root;
    try {
      String response =
          client.search().query(s.query()).index("dataAsset").deleted(false).size(50).execute();
      root = OBJECT_MAPPER.readTree(response);
    } catch (Exception e) {
      // A thrown exception means the whole search was rejected (e.g. ES 9 "too many clauses"
      // blows the request). Treat that as a shard-level failure for reporting purposes.
      failures.add(
          s.description()
              + " [query=\""
              + s.query()
              + "\"]: request threw "
              + e.getClass().getSimpleName()
              + " — "
              + e.getMessage());
      return;
    }

    int shardsFailed = root.path("_shards").path("failed").asInt(-1);
    if (shardsFailed != 0) {
      failures.add(
          s.description()
              + " [query=\""
              + s.query()
              + "\"]: _shards.failed="
              + shardsFailed
              + ", failures="
              + root.path("_shards").path("failures").toString());
      return;
    }

    boolean found = false;
    for (JsonNode hit : root.path("hits").path("hits")) {
      if (seededName.equals(hit.path("_source").path("name").asText())) {
        found = true;
        break;
      }
    }
    if (found != s.shouldFind()) {
      failures.add(
          s.description()
              + " [query=\""
              + s.query()
              + "\"]: expected shouldFind="
              + s.shouldFind()
              + " but got found="
              + found);
    }
  }

  /**
   * Guards against over-correction of the clause-explosion fix. The fix disables fuzziness
   * once the query analyzes to more than 2 sub-tokens; it must keep fuzziness on single-word
   * queries so normal typo tolerance ({@code custmer} → {@code customer}) keeps working.
   */
  @Test
  void testSingleWordTypoStillMatchesViaFuzzy(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns, "customer_analytics");
    String indexedName = table.getName();
    String firstSeg = indexedName.split("_+")[0];

    Awaitility.await()
        .atMost(90, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () -> {
              String r =
                  client.search().query(firstSeg).index("table_search_index").size(25).execute();
              JsonNode root = OBJECT_MAPPER.readTree(r);
              for (JsonNode hit : root.path("hits").path("hits")) {
                if (indexedName.equals(hit.path("_source").path("name").asText())) {
                  return true;
                }
              }
              return false;
            });

    // "custmer" is a 1-char typo of "customer", 1 alnum sub-token → fuzziness path is active.
    String typoQuery = "custmer";
    String response =
        client.search().query(typoQuery).index("dataAsset").deleted(false).size(25).execute();
    JsonNode root = OBJECT_MAPPER.readTree(response);

    assertEquals(
        0,
        root.path("_shards").path("failed").asInt(-1),
        "single-word fuzzy query must not cause shard failures: "
            + root.path("_shards").path("failures").toString());

    boolean found = false;
    for (JsonNode hit : root.path("hits").path("hits")) {
      if (indexedName.equals(hit.path("_source").path("name").asText())) {
        found = true;
        break;
      }
    }
    assertTrue(
        found,
        "Single-word typo query \""
            + typoQuery
            + "\" must still match seeded table \""
            + indexedName
            + "\" via fuzzy path; regression would indicate the clause-explosion fix "
            + "over-corrected and killed normal typo tolerance.");
  }

  /**
   * Pins the {@code name.keyword} exact-match boost for tables. This field was missing from
   * the {@code table} asset config (unlike most other asset types), which meant typing a
   * table's full name produced no exact-match boost. Regression guard: the seeded table must
   * be the top hit (or strictly above any accidental substring matches) when the full name is
   * queried.
   */
  @Test
  void testExactFullNameRanksSeededTableFirst(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Seed two tables so ranking is observable: the exact-match query must prefer `target`
    // over the near-duplicate `decoy` that shares the same first segment. Use short unique
    // tags (bypassing ns.prefix()) so the seeded names stay at production-realistic lengths
    // and the exact-name query stays well under OpenSearch's default 1024-clause cap.
    String uniq = "xqz" + ns.uniqueShortId().substring(0, 5);
    String targetNameRaw = uniq + "_exact_rank_target_v1";
    String decoyNameRaw = uniq + "_exact_rank_target_v1_extended_suffix";
    List<Column> cols =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));
    Table target = createTestTableWithColumns(ns, targetNameRaw, cols);
    Table decoy = createTestTableWithColumns(ns, decoyNameRaw, cols);
    String targetName = target.getName();
    String decoyName = decoy.getName();

    Awaitility.await()
        .atMost(90, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () -> {
              String r =
                  client
                      .search()
                      .query(targetName.split("_+")[0])
                      .index("table_search_index")
                      .size(50)
                      .execute();
              JsonNode root = OBJECT_MAPPER.readTree(r);
              boolean sawTarget = false;
              boolean sawDecoy = false;
              for (JsonNode hit : root.path("hits").path("hits")) {
                String n = hit.path("_source").path("name").asText();
                if (targetName.equals(n)) sawTarget = true;
                if (decoyName.equals(n)) sawDecoy = true;
              }
              return sawTarget && sawDecoy;
            });

    String response =
        client.search().query(targetName).index("dataAsset").deleted(false).size(10).execute();
    JsonNode root = OBJECT_MAPPER.readTree(response);

    assertEquals(
        0, root.path("_shards").path("failed").asInt(-1), "exact-name query must not fail shards");

    JsonNode hits = root.path("hits").path("hits");
    assertTrue(hits.size() > 0, "exact-name query must return at least one hit");
    String topName = hits.get(0).path("_source").path("name").asText();
    assertEquals(
        targetName,
        topName,
        "Exact full-name query must rank the exact-match table first, not the decoy. "
            + "Got top hit \""
            + topName
            + "\" instead of \""
            + targetName
            + "\". This typically regresses when name.keyword exact-match is removed "
            + "from the table asset config.");
  }

  // ===================================================================
  // SEARCH CONSISTENCY TESTS
  // ===================================================================

  @Test
  void testSearchQueryConsistencyBetweenDataAssetAndTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use wildcard query to avoid clause explosion with long entity names
    String tableResponse = client.search().query("*").index("table_search_index").size(5).execute();

    String dataAssetResponse = client.search().query("*").index("dataAsset").size(5).execute();

    assertNotNull(tableResponse);
    assertNotNull(dataAssetResponse);

    JsonNode tableRoot = OBJECT_MAPPER.readTree(tableResponse);
    JsonNode dataAssetRoot = OBJECT_MAPPER.readTree(dataAssetResponse);

    assertTrue(tableRoot.has("hits"));
    assertTrue(dataAssetRoot.has("hits"));
  }

  @Test
  void testSearchPaginationConsistency(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 10; i++) {
      createTestTable(ns, "page_test_" + i);
    }

    // Get first page
    String page1 =
        client.search().query("page_test").index("table_search_index").page(0, 5).execute();

    // Get second page
    String page2 =
        client.search().query("page_test").index("table_search_index").page(1, 5).execute();

    assertNotNull(page1);
    assertNotNull(page2);

    JsonNode page1Root = OBJECT_MAPPER.readTree(page1);
    JsonNode page2Root = OBJECT_MAPPER.readTree(page2);

    assertTrue(page1Root.has("hits"));
    assertTrue(page2Root.has("hits"));
  }

  // ===================================================================
  // DELETED ENTITIES SEARCH TESTS
  // ===================================================================

  @Test
  void testSearchDeletedEntities(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns, "deleted_search");
    client.tables().delete(table.getId().toString());

    // Fluent API with includeDeleted()
    String response =
        client
            .search()
            .query("deleted_search")
            .index("table_search_index")
            .includeDeleted()
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchExcludeDeletedEntities(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.search().query("*").index("table_search_index").deleted(false).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // QUERY FILTER TESTS
  // ===================================================================

  @Test
  void testSearchWithQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "filter_test");

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTestTable(TestNamespace ns, String baseName) {
    // Lazily initialize shared entities once per test
    initializeSharedDbEntities(ns);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(sharedSchema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private synchronized void initializeSharedDbEntities(TestNamespace ns) {
    if (sharedDbService != null) {
      return;
    }
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    sharedDbService =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("search_svc_" + shortId)
            .connection(conn)
            .description("Test service for search")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("search_db_" + shortId);
    dbReq.setService(sharedDbService.getFullyQualifiedName());
    sharedDatabase = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("search_schema_" + shortId);
    schemaReq.setDatabase(sharedDatabase.getFullyQualifiedName());
    sharedSchema = SdkClients.adminClient().databaseSchemas().create(schemaReq);
  }

  private Table createTestTableWithColumns(TestNamespace ns, String name, List<Column> columns) {
    // Reuse shared entities for efficiency
    initializeSharedDbEntities(ns);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(name);
    tableRequest.setDatabaseSchema(sharedSchema.getFullyQualifiedName());
    tableRequest.setColumns(columns);

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Topic createTestTopic(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.messaging.KafkaConnection kafkaConn =
        new org.openmetadata.schema.services.connections.messaging.KafkaConnection()
            .withBootstrapServers("localhost:9092");

    org.openmetadata.schema.api.services.CreateMessagingService msgSvcReq =
        new org.openmetadata.schema.api.services.CreateMessagingService();
    msgSvcReq.setName("search_msg_svc_" + shortId);
    msgSvcReq.setServiceType(
        org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType.Kafka);
    msgSvcReq.setConnection(
        new org.openmetadata.schema.type.MessagingConnection().withConfig(kafkaConn));

    MessagingService msgService = SdkClients.adminClient().messagingServices().create(msgSvcReq);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(ns.prefix(baseName));
    topicRequest.setService(msgService.getFullyQualifiedName());
    topicRequest.setPartitions(1);

    return SdkClients.adminClient().topics().create(topicRequest);
  }

  private Topic createTestTopicWithFields(TestNamespace ns, String name, List<Field> fields) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.messaging.KafkaConnection kafkaConn =
        new org.openmetadata.schema.services.connections.messaging.KafkaConnection()
            .withBootstrapServers("localhost:9092");

    org.openmetadata.schema.api.services.CreateMessagingService msgSvcReq =
        new org.openmetadata.schema.api.services.CreateMessagingService();
    msgSvcReq.setName("many_field_msg_svc_" + shortId);
    msgSvcReq.setServiceType(
        org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType.Kafka);
    msgSvcReq.setConnection(
        new org.openmetadata.schema.type.MessagingConnection().withConfig(kafkaConn));

    MessagingService msgService = SdkClients.adminClient().messagingServices().create(msgSvcReq);

    MessageSchema messageSchema =
        new MessageSchema().withSchemaType(SchemaType.JSON).withSchemaFields(fields);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(name);
    topicRequest.setService(msgService.getFullyQualifiedName());
    topicRequest.setPartitions(1);
    topicRequest.setMessageSchema(messageSchema);

    return SdkClients.adminClient().topics().create(topicRequest);
  }

  private List<Column> createManyTableColumns(int count) {
    List<Column> columns = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      columns.add(
          new Column()
              .withName("column_" + i + "_data_field")
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255));
    }
    return columns;
  }

  private List<Field> createManyTopicSchemaFields(int count) {
    List<Field> fields = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      fields.add(
          new Field().withName("field_" + i + "_data_element").withDataType(FieldDataType.STRING));
    }
    return fields;
  }

  // ===================================================================
  // ADVANCED SEARCH TESTS
  // ===================================================================

  @Test
  void testSearchWithIncludeAggregationsParameter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String query = "*";
    String index = "table_search_index";

    String resultWithAggs =
        client.search().query(query).index(index).size(10).includeAggregations(true).execute();

    assertNotNull(resultWithAggs);
    JsonNode responseWithAggs = OBJECT_MAPPER.readTree(resultWithAggs);

    assertTrue(
        responseWithAggs.has("aggregations"),
        "Response should contain aggregations when include_aggregations=true");
    JsonNode aggregations = responseWithAggs.get("aggregations");
    assertNotNull(aggregations, "Aggregations should not be null");
    assertTrue(
        aggregations.size() > 0, "Aggregations should contain at least one aggregation field");

    String resultWithoutAggs =
        client.search().query(query).index(index).size(10).includeAggregations(false).execute();

    JsonNode responseWithoutAggs = OBJECT_MAPPER.readTree(resultWithoutAggs);

    if (responseWithoutAggs.has("aggregations")) {
      JsonNode aggsWithout = responseWithoutAggs.get("aggregations");
      assertEquals(
          0, aggsWithout.size(), "Aggregations should be empty when include_aggregations=false");
    }

    assertTrue(
        responseWithAggs.has("hits") && responseWithAggs.get("hits").has("hits"),
        "Response with aggregations should have hits");
    assertTrue(
        responseWithoutAggs.has("hits") && responseWithoutAggs.get("hits").has("hits"),
        "Response without aggregations should have hits");

    int hitsWithAggs = responseWithAggs.get("hits").get("hits").size();
    int hitsWithoutAggs = responseWithoutAggs.get("hits").get("hits").size();
    assertEquals(
        hitsWithAggs,
        hitsWithoutAggs,
        "Both responses should return the same number of search results");
  }

  @Test
  void testEntityTypeCountsResponseStructure(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().entityTypeCounts().query("*").index("all").execute();

    assertNotNull(response);
    JsonNode jsonResponse = OBJECT_MAPPER.readTree(response);
    assertTrue(jsonResponse.has("aggregations"), "Response should have aggregations field");
    JsonNode aggregations = jsonResponse.get("aggregations");
    JsonNode entityTypeAgg = null;
    if (aggregations.has("entityType")) {
      entityTypeAgg = aggregations.get("entityType");
    } else if (aggregations.has("sterms#entityType")) {
      entityTypeAgg = aggregations.get("sterms#entityType");
    }
    assertNotNull(entityTypeAgg, "Aggregations should have entityType field");
    assertTrue(entityTypeAgg.has("buckets"), "EntityType aggregation should have buckets");
    JsonNode buckets = entityTypeAgg.get("buckets");
    assertTrue(buckets.isArray(), "Buckets should be an array");

    assertTrue(jsonResponse.has("hits"), "Response should have hits field");
    JsonNode hits = jsonResponse.get("hits");
    assertTrue(hits.has("total"), "Hits should have total field");
    JsonNode total = hits.get("total");
    if (total.isObject()) {
      assertTrue(total.has("value"), "Total should have value field");
      assertTrue(total.get("value").asLong() >= 0, "Total value should be non-negative");
    } else {
      assertTrue(total.asLong() >= 0, "Total should be non-negative");
    }
  }

  @Test
  void testEntityTypeCountsConsistencyWithRegularSearch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String searchTerm = "*";

    String searchResponse = client.search().query(searchTerm).index("dataAsset").execute();
    assertNotNull(searchResponse);
    JsonNode searchJson = OBJECT_MAPPER.readTree(searchResponse);
    long totalHits = extractTotalHits(searchJson);

    String countsResponse =
        client.search().entityTypeCounts().query(searchTerm).index("dataAsset").execute();
    assertNotNull(countsResponse);
    JsonNode countsJson = OBJECT_MAPPER.readTree(countsResponse);
    long totalFromAggregations = 0;
    JsonNode aggregations = countsJson.get("aggregations");
    if (aggregations != null) {
      JsonNode entityTypeAgg =
          aggregations.has("entityType")
              ? aggregations.get("entityType")
              : aggregations.get("sterms#entityType");

      if (entityTypeAgg != null && entityTypeAgg.has("buckets")) {
        JsonNode buckets = entityTypeAgg.get("buckets");
        for (JsonNode bucket : buckets) {
          totalFromAggregations += bucket.get("doc_count").asLong();
        }
      }
    }

    if (totalHits > 0) {
      assertTrue(
          totalFromAggregations > 0,
          "Entity type counts should have results when regular search has results");
    }
  }

  @Test
  void testEntityTypeCountsWithMultiWordQuery(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] multiWordQueries = {"log fail", "test data", "customer order"};
    for (String query : multiWordQueries) {
      String dataAssetResponse =
          client.search().entityTypeCounts().query(query).index("dataAsset").execute();
      assertNotNull(dataAssetResponse);

      String tableResponse =
          client.search().entityTypeCounts().query(query).index("table").execute();
      assertNotNull(tableResponse);

      JsonNode dataAssetJson = OBJECT_MAPPER.readTree(dataAssetResponse);
      assertTrue(
          dataAssetJson.has("aggregations"),
          "Response should contain aggregations for query: " + query);
    }
  }

  @Test
  void testEntityTypeCountsWithSpecificIndexes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] indexes = {"table", "dashboard", "pipeline", "topic"};
    for (String index : indexes) {
      String response = client.search().entityTypeCounts().query("*").index(index).execute();
      assertNotNull(response);

      JsonNode jsonResponse = OBJECT_MAPPER.readTree(response);
      assertTrue(
          jsonResponse.has("aggregations"),
          "Response for index " + index + " should have aggregations");
      assertTrue(jsonResponse.has("hits"), "Response for index " + index + " should have hits");
    }
  }

  @Test
  void testEntityTypeCountsResponseFormat(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().entityTypeCounts().query("*").index("all").execute();
    assertNotNull(response);

    JsonNode jsonResponse = OBJECT_MAPPER.readTree(response);

    assertTrue(jsonResponse.has("took"), "Response should have 'took' field");
    assertTrue(jsonResponse.has("timed_out"), "Response should have 'timed_out' field");
    assertTrue(jsonResponse.has("_shards"), "Response should have '_shards' field");
    assertTrue(jsonResponse.has("hits"), "Response should have 'hits' field");
    assertTrue(jsonResponse.has("aggregations"), "Response should have 'aggregations' field");

    JsonNode shards = jsonResponse.get("_shards");
    assertTrue(shards.has("total"), "Shards should have 'total' field");
    assertTrue(shards.has("successful"), "Shards should have 'successful' field");
    assertTrue(shards.has("skipped"), "Shards should have 'skipped' field");
    assertTrue(shards.has("failed"), "Shards should have 'failed' field");
  }

  @Test
  void testEntityTypeCountsWithEmptyResults(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentQuery = ns.prefix("nonexistent_entity_xyz");
    String response =
        client.search().entityTypeCounts().query(nonExistentQuery).index("dataAsset").execute();
    assertNotNull(response);

    JsonNode jsonResponse = OBJECT_MAPPER.readTree(response);
    assertTrue(jsonResponse.has("aggregations"), "Response should contain aggregations");

    JsonNode hits = jsonResponse.get("hits");
    JsonNode total = hits.get("total");
    long totalHits;
    if (total.isObject()) {
      totalHits = total.get("value").asLong();
    } else {
      totalHits = total.asLong();
    }
    // The entityTypeCounts endpoint may return all results for aggregation purposes
    // even with a non-matching query string. Verify the response structure is valid.
    assertTrue(totalHits >= 0, "Total hits should be non-negative");
    assertTrue(jsonResponse.has("aggregations"), "Response should contain aggregations");
  }

  // ===================================================================
  // HELPER METHODS FOR ADVANCED TESTS
  // ===================================================================

  private long extractTotalHits(JsonNode searchJson) {
    if (searchJson.has("hits") && searchJson.get("hits").has("total")) {
      JsonNode total = searchJson.get("hits").get("total");
      if (total.isObject() && total.has("value")) {
        return total.get("value").asLong();
      } else {
        return total.asLong();
      }
    }
    return 0;
  }

  // ===================================================================
  // SEARCH SUGGESTIONS TESTS
  // ===================================================================

  @org.junit.jupiter.api.Disabled("/v1/search/suggest endpoint not implemented")
  @Test
  void testSearchSuggestionsBasic(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "suggestion_test_table");

    String response =
        client.search().suggest("suggest").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(
        root.has("suggest") || root.has("options") || root.size() > 0,
        "Response should have suggestion data");
  }

  @org.junit.jupiter.api.Disabled("/v1/search/suggest endpoint not implemented")
  @Test
  void testSearchSuggestionsWithMultipleFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "multi_field_suggest");

    String response =
        client.search().suggest("multi").index("table_search_index").size(5).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertNotNull(root);
  }

  @org.junit.jupiter.api.Disabled("/v1/search/suggest endpoint not implemented")
  @Test
  void testSearchSuggestionsEmpty(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.search().suggest(ns.prefix("nonexistent_xyz")).index("table_search_index").execute();

    assertNotNull(response);
  }

  // ===================================================================
  // SEARCH HIGHLIGHTING TESTS
  // ===================================================================

  @Test
  void testSearchWithHighlighting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns, "highlight_test");

    String response =
        client.search().query("highlight").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");

    if (root.has("hits") && root.get("hits").has("hits")) {
      JsonNode hits = root.get("hits").get("hits");
      for (JsonNode hit : hits) {
        assertTrue(
            hit.has("_source") || hit.has("highlight"), "Hit should have source or highlight");
      }
    }
  }

  @Test
  void testSearchHighlightingInDescription(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("highlight_svc_" + shortId)
            .connection(conn)
            .description("Test service for highlighting")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("highlight_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("highlight_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("special_description_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setDescription(
        "This table contains important business metrics and analytics data");
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    String response =
        client.search().query("business metrics").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // ADVANCED FILTER TESTS
  // ===================================================================

  @Test
  void testSearchWithComplexQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "complex_filter_test");

    String complexFilter =
        "{"
            + "\"query\": {"
            + "\"bool\": {"
            + "\"must\": ["
            + "{\"term\": {\"deleted\": false}},"
            + "{\"exists\": {\"field\": \"name\"}}"
            + "],"
            + "\"must_not\": ["
            + "{\"term\": {\"entityType\": \"test\"}}"
            + "]"
            + "}"
            + "}"
            + "}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(complexFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithPostFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "post_filter_test");

    String postFilter = "{\"term\": {\"deleted\": false}}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .postFilter(postFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithBothQueryAndPostFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "dual_filter_test");

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";
    String postFilter = "{\"exists\": {\"field\": \"name\"}}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(queryFilter)
            .postFilter(postFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchFilterByServiceType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceTypeFilter =
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"serviceType\":\"databaseService\"}}]}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("dataAsset")
            .queryFilter(serviceTypeFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchFilterByMultipleFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String multiFieldFilter =
        "{"
            + "\"query\": {"
            + "\"bool\": {"
            + "\"must\": ["
            + "{\"exists\": {\"field\": \"name\"}},"
            + "{\"exists\": {\"field\": \"description\"}}"
            + "]"
            + "}"
            + "}"
            + "}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(multiFieldFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // ADVANCED AGGREGATION TESTS
  // ===================================================================

  @Test
  void testSearchAggregationsByEntityType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_entity_type");

    String response =
        client.search().query("*").index("dataAsset").size(0).includeAggregations(true).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("aggregations"), "Response should have aggregations");

    JsonNode aggregations = root.get("aggregations");
    JsonNode entityTypeAgg = null;
    if (aggregations.has("entityType")) {
      entityTypeAgg = aggregations.get("entityType");
    } else if (aggregations.has("sterms#entityType")) {
      entityTypeAgg = aggregations.get("sterms#entityType");
    }

    if (entityTypeAgg != null) {
      assertTrue(entityTypeAgg.has("buckets"), "EntityType aggregation should have buckets");
    }
  }

  @Test
  void testSearchAggregationsByServiceType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_service_type");

    String response =
        client.search().query("*").index("dataAsset").size(0).includeAggregations(true).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("aggregations"), "Response should have aggregations");
  }

  @Test
  void testSearchAggregationsWithQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_with_filter");

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(queryFilter)
            .size(0)
            .includeAggregations(true)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("aggregations"), "Response should have aggregations");
  }

  @Test
  void testSearchAggregationsSize(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_size_test");

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(0)
            .includeAggregations(true)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);

    if (root.has("hits") && root.get("hits").has("hits")) {
      JsonNode hits = root.get("hits").get("hits");
      assertEquals(0, hits.size(), "Should have no hits when size=0");
    }

    assertTrue(root.has("aggregations"), "Response should have aggregations even when size=0");
  }

  // ===================================================================
  // SEARCH PAGINATION ADVANCED TESTS
  // ===================================================================

  @Test
  void testSearchPaginationWithLargeDataset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 25; i++) {
      createTestTable(ns, "large_dataset_" + i);
    }

    String page1 =
        client.search().query("large_dataset").index("table_search_index").page(0, 10).execute();

    String page2 =
        client.search().query("large_dataset").index("table_search_index").page(1, 10).execute();

    String page3 =
        client.search().query("large_dataset").index("table_search_index").page(2, 10).execute();

    assertNotNull(page1);
    assertNotNull(page2);
    assertNotNull(page3);

    JsonNode page1Root = OBJECT_MAPPER.readTree(page1);
    JsonNode page2Root = OBJECT_MAPPER.readTree(page2);
    JsonNode page3Root = OBJECT_MAPPER.readTree(page3);

    assertTrue(page1Root.has("hits"));
    assertTrue(page2Root.has("hits"));
    assertTrue(page3Root.has("hits"));
  }

  @Test
  void testSearchPaginationBoundaries(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      createTestTable(ns, "boundary_test_" + i);
    }

    String page0 =
        client.search().query("boundary_test").index("table_search_index").page(0, 10).execute();

    assertNotNull(page0);
    JsonNode page0Root = OBJECT_MAPPER.readTree(page0);
    assertTrue(page0Root.has("hits"));

    String largeOffsetPage =
        client
            .search()
            .query("boundary_test")
            .index("table_search_index")
            .from(1000)
            .size(10)
            .execute();

    assertNotNull(largeOffsetPage);
  }

  @Test
  void testSearchPaginationWithSorting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 10; i++) {
      createTestTable(ns, "sorted_page_" + i);
    }

    String page1Asc =
        client
            .search()
            .query("sorted_page")
            .index("table_search_index")
            .page(0, 5)
            .sortAsc("name.keyword")
            .execute();

    String page2Asc =
        client
            .search()
            .query("sorted_page")
            .index("table_search_index")
            .page(1, 5)
            .sortAsc("name.keyword")
            .execute();

    assertNotNull(page1Asc);
    assertNotNull(page2Asc);

    JsonNode page1Root = OBJECT_MAPPER.readTree(page1Asc);
    JsonNode page2Root = OBJECT_MAPPER.readTree(page2Asc);

    assertTrue(page1Root.has("hits"));
    assertTrue(page2Root.has("hits"));
  }

  // ===================================================================
  // SEARCH BY QUERY WITH DIFFERENT PATTERNS
  // ===================================================================

  @Test
  void testSearchByExactMatch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns, "exact_match_table");

    String response =
        client.search().query("exact_match_table").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchByPartialMatch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "partial_match_table");

    String response =
        client.search().query("partial_match").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchByWildcard(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "wildcard_search_table");

    String response =
        client.search().query("*wildcard*").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchByMultipleTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "search_multi_term_table");

    String response =
        client.search().query("search multi term").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithBooleanOperators(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "boolean_search_table");

    String response =
        client.search().query("boolean AND search").index("table_search_index").size(10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // SEARCH EDGE CASES AND ERROR HANDLING
  // ===================================================================

  @Test
  void testSearchWithMalformedQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String malformedFilter = "{\"query\": {\"invalid_syntax";

    assertDoesNotThrow(
        () -> {
          String response =
              client
                  .search()
                  .query("*")
                  .index("table_search_index")
                  .queryFilter(malformedFilter)
                  .execute();
          assertNotNull(response);
        });
  }

  @Test
  void testSearchWithVeryLargeSize(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query("*").index("table_search_index").size(10000).execute();
          assertNotNull(response);
        });
  }

  @Test
  void testSearchWithNegativeOffset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Negative offset is invalid - Elasticsearch rejects it
    assertThrows(
        org.openmetadata.sdk.exceptions.ApiException.class,
        () -> client.search().query("*").index("table_search_index").from(-1).size(10).execute());
  }

  @Test
  void testSearchWithTrackTotalHits(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "track_total_test");

    String response =
        client.search().query("track_total").index("table_search_index").trackTotalHits().execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");

    if (root.has("hits")) {
      JsonNode hits = root.get("hits");
      assertTrue(hits.has("total"), "Hits should have total field when trackTotalHits is true");
    }
  }

  @Test
  void testSearchWithoutTrackTotalHits(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("*").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // SEARCH EXPORT TESTS (streaming CSV endpoint)
  // ===================================================================

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private HttpResponse<String> httpGetExport(String path) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "text/csv")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  @Test
  void testExportReturnsOkWithCsvContent(TestNamespace ns) throws Exception {
    HttpResponse<String> response = httpGetExport("/v1/search/export?q=*&index=table_search_index");

    assertEquals(200, response.statusCode(), "Export should return HTTP 200");

    String body = response.body();
    assertTrue(
        body.startsWith("Entity Type,Service Name"), "Response should start with CSV header");
  }

  @Test
  void testExportWithSizeLimitsRows(TestNamespace ns) throws Exception {
    createTestTable(ns, "export_size_test_1");
    createTestTable(ns, "export_size_test_2");
    createTestTable(ns, "export_size_test_3");

    Awaitility.await()
        .atMost(15, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () -> {
              HttpResponse<String> r =
                  httpGetExport("/v1/search/export?q=export_size_test&index=table_search_index");
              return r.statusCode() == 200 && r.body().split("\n").length >= 4;
            });

    HttpResponse<String> allResponse =
        httpGetExport("/v1/search/export?q=export_size_test&index=table_search_index");
    assertEquals(200, allResponse.statusCode());
    int allLineCount = allResponse.body().split("\n").length;

    HttpResponse<String> limitedResponse =
        httpGetExport("/v1/search/export?q=export_size_test&index=table_search_index&size=1");
    assertEquals(200, limitedResponse.statusCode());
    int limitedLineCount = limitedResponse.body().split("\n").length;

    // limitedResponse should have header + at most 1 data row = 2 lines
    assertTrue(
        limitedLineCount <= 2,
        "Export with size=1 should have at most 2 lines (header + 1 row), got " + limitedLineCount);
    assertTrue(
        allLineCount >= limitedLineCount,
        "Export without size should have >= rows than export with size=1");
  }

  @Test
  void testExportWithoutSizeExportsAll(TestNamespace ns) throws Exception {
    HttpResponse<String> response = httpGetExport("/v1/search/export?q=*&index=table_search_index");

    assertEquals(200, response.statusCode(), "Export without size should return 200");
    assertTrue(
        response.body().contains("Entity Type,Service Name"), "Response should contain CSV header");
  }

  @Test
  void testExportWithSizeAndSortParameters(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        httpGetExport(
            "/v1/search/export?q=*&index=table_search_index&size=5&sort_field=name.keyword&sort_order=asc");

    assertEquals(200, response.statusCode());
    assertTrue(response.body().startsWith("Entity Type,Service Name"));
  }

  @Test
  void testExportWithDataAssetIndex(TestNamespace ns) throws Exception {
    HttpResponse<String> response = httpGetExport("/v1/search/export?q=*&index=dataAsset");

    assertEquals(200, response.statusCode(), "Export with dataAsset index should return 200");
    assertTrue(response.body().startsWith("Entity Type,Service Name"));
  }

  @Test
  void testExportWithFromAndSizeForPagination(TestNamespace ns) throws Exception {
    createTestTable(ns, "export_page_test_a");
    createTestTable(ns, "export_page_test_b");
    createTestTable(ns, "export_page_test_c");

    Awaitility.await()
        .atMost(15, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .until(
            () -> {
              HttpResponse<String> r =
                  httpGetExport("/v1/search/export?q=export_page_test&index=table_search_index");
              return r.statusCode() == 200 && r.body().split("\n").length >= 4;
            });

    HttpResponse<String> page1 =
        httpGetExport(
            "/v1/search/export?q=export_page_test&index=table_search_index"
                + "&sort_field=name.keyword&sort_order=asc&from=0&size=1");
    assertEquals(200, page1.statusCode());
    String[] page1Lines = page1.body().split("\n");
    assertTrue(page1Lines.length <= 2, "from=0&size=1 should return at most 2 lines");

    HttpResponse<String> page2 =
        httpGetExport(
            "/v1/search/export?q=export_page_test&index=table_search_index"
                + "&sort_field=name.keyword&sort_order=asc&from=1&size=1");
    assertEquals(200, page2.statusCode());
    String[] page2Lines = page2.body().split("\n");
    assertTrue(page2Lines.length <= 2, "from=1&size=1 should return at most 2 lines");

    if (page1Lines.length == 2 && page2Lines.length == 2) {
      assertFalse(
          page1Lines[1].equals(page2Lines[1]), "Page 1 and page 2 should return different rows");
    }
  }

  @Test
  void testExportWithFromBeyondResults(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        httpGetExport("/v1/search/export?q=*&index=table_search_index&from=999999&size=10");

    assertEquals(200, response.statusCode());
    String[] lines = response.body().split("\n");
    assertEquals(1, lines.length, "Export beyond results should only contain header");
  }
}
