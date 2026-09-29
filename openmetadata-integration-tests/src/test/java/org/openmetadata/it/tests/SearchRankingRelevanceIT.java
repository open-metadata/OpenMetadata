/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Ranking relevance for a name that is also a prefix of its siblings — the "customers vs
 * customers1..N" shape.
 *
 * <p>Two defects made the exactly-named table lose. The {@code om_compound_analyzer} splits {@code
 * customers7} into {@code [customers7, customers, 7]}, so with fuzziness the query term matches two
 * terms in the sibling and Lucene's blended-freq rewrite sums them, scoring the sibling above the
 * table whose name <em>is</em> the query. And the text ranking stages were a {@code multi_match}
 * boosted by their weight — BM25 × weight, unbounded — while {@code exactName} is a {@code
 * constant_score} capped at 100, so under {@code dis_max} a stage configured at weight 24 could and
 * did outscore it.
 *
 * <p>Asserted on ordering rather than on the query shape: the stage construction is pinned by
 * {@code SearchSourceBuilderFactoryTest}, and what a user notices is which row comes first.
 *
 * <p>Scope, so nobody reads more into a green run than it carries: for a query that names an entity
 * exactly, the two-pass search re-runs without the fuzzy stage, and that alone decides these
 * assertions — reverting the stage saturation leaves them passing. Saturation is what stops an
 * unbounded text stage outranking {@code exactName} on corpora where the two-pass does not fire,
 * and reproducing that needs a specific term distribution rather than a handful of fixture rows,
 * which is why it is pinned as a query-shape invariant in {@code SearchSourceBuilderFactoryTest}
 * (RED without the fix) instead of here. These tests are the outcome-level guard for the pair.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchRankingRelevanceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final Duration POLL_AT_MOST = Duration.ofSeconds(60);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final String TABLE_SEARCH_INDEX = "table_search_index";
  private static final int SIBLING_COUNT = 5;
  private static final double MIN_EXACT_BAND_RATIO = 1.25;
  private static final TagLabel TIER1 =
      new TagLabel()
          .withTagFQN("Tier.Tier1")
          .withSource(TagLabel.TagSource.CLASSIFICATION)
          .withLabelType(TagLabel.LabelType.MANUAL);

  /**
   * Scopes every search to the schema the test just created.
   *
   * <p>A filter clause does not score, so the ranking under test is unchanged, but it keeps the
   * corpus to this test's own rows. Fixture names here all begin "customers", so a short prefix
   * query matched every other method's tables as well and the row being asserted on could fall
   * outside the result window depending on what else the parallel lane had indexed.
   */
  private String schemaFilter;

  @Test
  @DisplayName("A table named exactly like the query outranks siblings that merely start with it")
  void exactNameOutranksNearNameSiblings(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String exactName = uniqueAlphabeticName();
    DatabaseSchema schema = createSchema(ns, "rank_exact");
    createTable(schema, exactName, null);
    for (int index = 1; index <= SIBLING_COUNT; index++) {
      createTable(schema, exactName + index, null);
    }

    Map<String, Double> scores = awaitScores(client, exactName, SIBLING_COUNT + 1);

    assertEquals(
        exactName,
        scores.keySet().iterator().next(),
        "the exactly-named table must rank first, got: " + scores);
    assertBandSeparation(scores, exactName);
  }

  @Test
  @DisplayName("Tier orders results inside a relevance band but cannot lift one out of it")
  void tierBreaksTiesWithoutOverturningTheExactMatch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String exactName = uniqueAlphabeticName();
    DatabaseSchema schema = createSchema(ns, "rank_tier");
    // The exact match carries no tier and the sibling carries the highest one, so a tier that
    // could outrank a name match would show up as an inversion here.
    createTable(schema, exactName, null);
    createTable(schema, exactName + "1", TIER1);
    for (int index = 2; index <= SIBLING_COUNT; index++) {
      createTable(schema, exactName + index, null);
    }

    Map<String, Double> scores = awaitScores(client, exactName, SIBLING_COUNT + 1);

    assertEquals(
        exactName,
        scores.keySet().iterator().next(),
        "Tier1 on a sibling must not overturn the exact name match, got: " + scores);
    assertBandSeparation(scores, exactName);
    double tieredSibling = scores.get(exactName + "1");
    for (int index = 2; index <= SIBLING_COUNT; index++) {
      assertTrue(
          tieredSibling > scores.get(exactName + index),
          "Tier1 must still order siblings within their band, got: " + scores);
    }
  }

  @Test
  @DisplayName("A singular query finds the plural table it names")
  void singularQueryFindsThePluralTable(TestNamespace ns) {
    // kstem stems customers -> customer but leaves orders, sessions, transactions and regions
    // alone, so a singular query dropped to the fuzzy band and a sibling holding the literal token
    // outranked the table the user asked for. om_plural_stemmer closes those cases.
    OpenMetadataClient client = SdkClients.adminClient();
    String stem = uniqueAlphabeticName();
    DatabaseSchema schema = createSchema(ns, "rank_plural");
    // The sibling holds "order" as a literal token, so while the plural went unstemmed it reached
    // the phrase band and the table the query actually names was left in the fuzzy band below it.
    createTable(schema, stem + "_orders", null);
    createTable(schema, stem + "_order_items", null);

    Map<String, Double> scores = awaitScores(client, stem + "_order", 2, stem);

    assertEquals(
        stem + "_orders",
        scores.keySet().iterator().next(),
        "the plural of the query must rank first, got: " + scores);
  }

  @Test
  @DisplayName("A camelCase name is reachable by one of the words inside it")
  void camelCaseNameIsReachableByItsParts(TestNamespace ns) {
    // om_analyzer lowercased before word_delimiter ran, so split_on_case_change never saw a case
    // boundary and CustomerAddress indexed as one opaque token no single word could reach.
    OpenMetadataClient client = SdkClients.adminClient();
    String stem = uniqueAlphabeticName();
    // The searched word is the trailing part, so the query is unique to this table and the
    // assertion cannot be satisfied by an unrelated row that happens to share a common word.
    String camel = "Address" + stem.substring(0, 1).toUpperCase(Locale.ROOT) + stem.substring(1);
    // A decoy that carries the searched word only as a substring, with no boundary to split on.
    // Both names were reachable through the n-gram band before the fix, so "is it found" passes
    // either way; what the fix buys is that the camelCase name becomes a real identity match and
    // moves a whole band above the substring hit.
    String substringOnly = "zz" + stem + "zz";
    DatabaseSchema schema = createSchema(ns, "rank_camel");
    createTable(schema, camel, null);
    createTable(schema, substringOnly, null);

    Map<String, Double> scores = awaitScores(client, stem, 2, "");

    assertTrue(scores.containsKey(camel), "camelCase name not reachable by a part: " + scores);
    assertEquals(
        camel,
        scores.keySet().iterator().next(),
        "the camelCase name must outrank a mere substring hit, got: " + scores);
    assertBandSeparation(scores, camel);
  }

  @Test
  @DisplayName("A partially typed name matches, including below the n-gram minimum")
  void prefixQueryMatchesShorterThanTheNgramFloor(TestNamespace ns) {
    // om_ngram has a three character minimum and no notion of "starts with", so two characters
    // matched nothing at all and longer prefixes landed in an arbitrarily ordered band.
    OpenMetadataClient client = SdkClients.adminClient();
    String name = uniqueAlphabeticName();
    DatabaseSchema schema = createSchema(ns, "rank_prefix");
    createTable(schema, name, null);

    Map<String, Double> twoChars = awaitScores(client, name.substring(0, 2), 1, name);
    assertTrue(twoChars.containsKey(name), "a two character prefix must still match: " + twoChars);

    Map<String, Double> longerPrefix = awaitScores(client, name.substring(0, 6), 1, name);
    assertEquals(
        name,
        longerPrefix.keySet().iterator().next(),
        "a longer prefix must rank the name it prefixes first, got: " + longerPrefix);
  }

  /**
   * Asserts the exact match sits a whole relevance band above its siblings rather than edging them
   * out.
   *
   * <p>Ordering alone does not defend the fix. On a small corpus the exactly-named table already
   * wins on field-length norm — by 2.7% before the fix — so an "is it first" assertion passes
   * against the broken build too. What the fix guarantees is separation: {@code exactName} is a
   * {@code constant_score} of 100 while a sibling's best stage is {@code phraseName} at 70, and
   * bounding the text stages is what stops one of them climbing into that gap. With signals worth
   * at most 2.0 on top of a 0.3-scaled lexical score, the worst case — untiered exact match against
   * a Tier1 sibling — still leaves {@code (0.3*100 + 1.12) / (0.3*70 + 3.12) = 1.29}, so a floor of
   * 1.25 sits inside the structural gap and far above the pre-fix ratio.
   */
  private void assertBandSeparation(Map<String, Double> scores, String exactName) {
    double exactScore = scores.get(exactName);
    double bestSibling =
        scores.entrySet().stream()
            .filter(entry -> !entry.getKey().equals(exactName))
            .mapToDouble(Map.Entry::getValue)
            .max()
            .orElseThrow();
    assertTrue(
        exactScore >= bestSibling * MIN_EXACT_BAND_RATIO,
        "exact match "
            + exactScore
            + " must lead the best sibling "
            + bestSibling
            + " by at least "
            + MIN_EXACT_BAND_RATIO
            + "x, got ratio "
            + (exactScore / bestSibling)
            + " in "
            + scores);
  }

  /**
   * Polls until every created table is searchable, then returns name to score ordered by descending
   * score. Indexing is async post-commit, so a partially-indexed result set would compare scores
   * over a moving corpus.
   */
  private Map<String, Double> awaitScores(
      OpenMetadataClient client, String query, int expectedHits) {
    return awaitScores(client, query, expectedHits, query);
  }

  /**
   * Polls until at least {@code expectedHits} results whose name starts with {@code namePrefix} are
   * searchable. The prefix is separate from the query because a prefix or singular query does not
   * spell the names it is meant to find.
   */
  private Map<String, Double> awaitScores(
      OpenMetadataClient client, String query, int expectedHits, String namePrefix) {
    Map<String, Double> scores = new LinkedHashMap<>();
    Awaitility.await("ranked results for " + query)
        .pollInterval(POLL_INTERVAL)
        .atMost(POLL_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              scores.clear();
              scores.putAll(fetchScores(client, query, namePrefix));
              assertEquals(
                  expectedHits, scores.size(), "not every table is indexed yet: " + scores);
            });
    return scores;
  }

  private Map<String, Double> fetchScores(OpenMetadataClient client, String query)
      throws Exception {
    return fetchScores(client, query, query);
  }

  private Map<String, Double> fetchScores(
      OpenMetadataClient client, String query, String namePrefix) throws Exception {
    String response =
        client
            .search()
            .query(query)
            .index(TABLE_SEARCH_INDEX)
            .queryFilter(schemaFilter)
            .size(SIBLING_COUNT + 10)
            .deleted(false)
            .execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    Map<String, Double> scores = new LinkedHashMap<>();
    for (JsonNode hit : hits) {
      String name = hit.path("_source").path("name").asText("");
      if (name.startsWith(namePrefix)) {
        scores.put(name, hit.path("_score").asDouble());
      }
    }
    return scores;
  }

  /**
   * A name of letters only, so it analyzes to a single sub-token. {@code getFuzziness} turns
   * fuzziness off past two sub-tokens, and a name carrying digits or underscores would silently
   * take that branch and stop exercising the fuzzy stage this test is about.
   */
  private static String uniqueAlphabeticName() {
    StringBuilder name = new StringBuilder("customers");
    for (char digit :
        UUID.randomUUID().toString().replace("-", "").substring(0, 10).toCharArray()) {
      name.append((char) ('a' + Character.digit(digit, 16)));
    }
    return name.toString();
  }

  private DatabaseSchema createSchema(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServices.builder()
            .name("rank_svc_" + shortId + "_" + baseName)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Test service for search ranking relevance")
            .create();

    CreateDatabase databaseRequest = new CreateDatabase();
    databaseRequest.setName("rank_db_" + shortId + "_" + baseName);
    databaseRequest.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(databaseRequest);

    CreateDatabaseSchema schemaRequest = new CreateDatabaseSchema();
    schemaRequest.setName("rank_schema_" + shortId + "_" + baseName);
    schemaRequest.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaRequest);
    schemaFilter =
        "{\"query\":{\"term\":{\"databaseSchema.fullyQualifiedName.keyword\":\""
            + schema.getFullyQualifiedName().toLowerCase(Locale.ROOT)
            + "\"}}}";
    return schema;
  }

  private Table createTable(DatabaseSchema schema, String name, TagLabel tier) {
    CreateTable request = new CreateTable();
    request.setName(name);
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription("Customer records used by the search ranking relevance test.");
    request.setColumns(
        List.of(
            new Column()
                .withName("customer_id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Customer identifier"),
            new Column()
                .withName("customer_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Customer name")));
    if (tier != null) {
      List<TagLabel> tags = new ArrayList<>();
      tags.add(tier);
      request.setTags(tags);
    }
    Table table = SdkClients.adminClient().tables().create(request);
    assertNotNull(table.getId(), "table " + name + " should have been created");
    return table;
  }
}
