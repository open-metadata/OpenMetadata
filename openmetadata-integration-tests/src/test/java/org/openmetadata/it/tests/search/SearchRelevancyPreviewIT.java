package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.RelevancyFixtures;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchSettingsTestHelper;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;

/**
 * Relevancy coverage driven through {@code POST /v1/search/preview}: each test indexes a small,
 * fully-controlled cohort, then runs the production query builder under two inline SearchSettings
 * and asserts the ranking (or result set) changes exactly as the changed knob predicts.
 *
 * <p>Preview persists nothing and bypasses the settings cache, so these run with no global-state
 * mutation and no teardown — the live Settings &gt; Search save path is exercised separately by
 * {@link LiveSearchSettingsChangeIT}.
 *
 * <p>Assertions are <b>order-relative</b>, not absolute-score: the only difference between the two
 * preview calls is the knob under test, so a deterministic flip in the top hit isolates that knob.
 */
@ExtendWith(TestNamespaceExtension.class)
class SearchRelevancyPreviewIT {

  private static final String TABLE_INDEX = "table";
  private static final String TIER_FIELD = "tier.tagFQN";
  private static final String TIER_1 = "Tier.Tier1";
  private static final String TIER_2 = "Tier.Tier2";
  private static final double STRONG_BOOST = 1000.0;
  private static final String NAME_FIELD = "name";
  private static final String DESCRIPTION_FIELD = "description";
  private static final String USAGE_COUNT_FIELD = "usageSummary.weeklyStats.count";
  private static final Duration INDEXED_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration RANK_POLL = Duration.ofSeconds(3);

  private static ServerHandle server;
  private static IndexAliasInspector indices;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    indices = new IndexAliasInspector(server);
    search = new SearchAssertions(server);
  }

  @Test
  void termBoostPromotesTheMatchingTier(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table tier1Table = RelevancyFixtures.createTable(schema, marker + "a", marker, TIER_1);
    final Table tier2Table = RelevancyFixtures.createTable(schema, marker + "b", marker, TIER_2);
    awaitIndexed(marker, 2);

    final SearchSettings base = currentSettings();

    assertThat(topHit(marker, boostTier(base, TIER_1)))
        .as("boosting %s must rank the Tier1 table first", TIER_1)
        .isEqualTo(tier1Table.getId().toString());

    assertThat(topHit(marker, boostTier(base, TIER_2)))
        .as("boosting %s must rank the Tier2 table first", TIER_2)
        .isEqualTo(tier2Table.getId().toString());
  }

  @Test
  void fieldValueBoostRanksByNumericUsage(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table heavilyUsed = RelevancyFixtures.createTable(schema, marker + "a", marker, null);
    final Table rarelyUsed = RelevancyFixtures.createTable(schema, marker + "b", marker, null);
    RelevancyFixtures.reportUsage(heavilyUsed, 1000);
    RelevancyFixtures.reportUsage(rarelyUsed, 1);
    awaitIndexed(marker, 2);

    final SearchSettings boosted = SearchSettingsTestHelper.copyOf(currentSettings());
    SearchSettingsTestHelper.addGlobalFieldValueBoost(boosted, USAGE_COUNT_FIELD, 50.0);

    // Usage rolls into usageSummary asynchronously, so poll until the numeric boost takes effect.
    Awaitility.await("usage field-value boost ranks the heavily-used table first")
        .atMost(INDEXED_TIMEOUT)
        .pollInterval(RANK_POLL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () -> assertThat(topHit(marker, boosted)).isEqualTo(heavilyUsed.getId().toString()));
  }

  @Test
  void searchFieldsSelectWhichFieldMatches(final TestNamespace ns) {
    // Two fully-independent tokens (no shared substring) so an ngram match on one never bleeds into
    // the other. The query token lives in tokenInName's NAME and tokenInDescription's DESCRIPTION.
    final String query = RelevancyFixtures.uniqueToken("qf");
    final String otherName = RelevancyFixtures.uniqueToken("ot");
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table tokenInName =
        RelevancyFixtures.createTable(schema, query, "plaindescription", null);
    final Table tokenInDescription = RelevancyFixtures.createTable(schema, otherName, query, null);
    awaitIndexed(query, 1);
    awaitIndexed(otherName, 1);

    final SearchSettings base = currentSettings();

    final SearchSettings nameOnly = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setOnlySearchField(nameOnly, TABLE_INDEX, NAME_FIELD, 5.0);
    assertThat(SearchSettingsTestHelper.previewIds(server, query, TABLE_INDEX, nameOnly, 10))
        .as("searching only 'name' must return only the table whose name carries the token")
        .containsExactly(tokenInName.getId().toString());

    final SearchSettings descriptionOnly = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setOnlySearchField(
        descriptionOnly, TABLE_INDEX, DESCRIPTION_FIELD, 5.0);
    assertThat(SearchSettingsTestHelper.previewIds(server, query, TABLE_INDEX, descriptionOnly, 10))
        .as("searching only 'description' must return only the table whose description carries it")
        .containsExactly(tokenInDescription.getId().toString());
  }

  @Test
  void maxResultHitsClampsTheReturnedHits(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    for (int i = 0; i < 4; i++) {
      RelevancyFixtures.createTable(schema, marker + i, marker, null);
    }
    awaitIndexed(marker, 4);

    final SearchSettings base = currentSettings();

    final SearchSettings clamped = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setMaxResultHits(clamped, 2);
    assertThat(SearchSettingsTestHelper.previewIds(server, marker, TABLE_INDEX, clamped, 10))
        .as("maxResultHits=2 must cap the hit list at 2 even when size=10")
        .hasSize(2);

    final SearchSettings wide = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setMaxResultHits(wide, 50);
    assertThat(SearchSettingsTestHelper.previewIds(server, marker, TABLE_INDEX, wide, 10))
        .as("a wide maxResultHits must return the whole seeded cohort")
        .hasSize(4);
  }

  @Test
  void highlightFieldsAppearInResults(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    RelevancyFixtures.createTable(schema, marker + "a", marker, null);
    awaitIndexed(marker, 1);

    final SearchSettings withHighlight = SearchSettingsTestHelper.copyOf(currentSettings());
    SearchSettingsTestHelper.setAssetHighlightFields(withHighlight, TABLE_INDEX, DESCRIPTION_FIELD);

    final JsonNode hits =
        SearchSettingsTestHelper.preview(server, marker, TABLE_INDEX, withHighlight, 10, false)
            .path("hits")
            .path("hits");
    assertThat(hits).as("preview must return the seeded table").isNotEmpty();
    assertThat(hits.get(0).path("highlight").has(DESCRIPTION_FIELD))
        .as("a configured highlight field must produce a highlight block on the matching field")
        .isTrue();
  }

  @Test
  void matchTypeExactRequiresTheFullKeyword(final TestNamespace ns) {
    final String exactName = RelevancyFixtures.uniqueToken("ex");
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table exactTable =
        RelevancyFixtures.createTable(schema, exactName, "plaindescription", null);
    RelevancyFixtures.createTable(schema, exactName + "extra", "plaindescription", null);
    awaitIndexed(exactName, 2);

    final SearchSettings base = currentSettings();

    final SearchSettings exact = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setOnlySearchField(
        exact, TABLE_INDEX, NAME_FIELD, 5.0, FieldBoost.MatchType.EXACT);
    assertThat(SearchSettingsTestHelper.previewIds(server, exactName, TABLE_INDEX, exact, 10))
        .as("matchType=exact must match only the whole-keyword name, not the prefixed sibling")
        .containsExactly(exactTable.getId().toString());

    final SearchSettings standard = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.setOnlySearchField(
        standard, TABLE_INDEX, NAME_FIELD, 5.0, FieldBoost.MatchType.STANDARD);
    assertThat(SearchSettingsTestHelper.previewIds(server, exactName, TABLE_INDEX, standard, 10))
        .as("matchType=standard must match both the exact and the prefixed name")
        .hasSize(2);
  }

  @Test
  void perAssetTermBoostAppliesOnThatAssetIndex(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table tier1Table = RelevancyFixtures.createTable(schema, marker + "a", marker, TIER_1);
    final Table tier2Table = RelevancyFixtures.createTable(schema, marker + "b", marker, TIER_2);
    awaitIndexed(marker, 2);

    final SearchSettings base = currentSettings();

    final SearchSettings boostTier1 = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.addAssetTermBoost(
        boostTier1, TABLE_INDEX, TIER_FIELD, TIER_1, STRONG_BOOST);
    assertThat(topHit(marker, boostTier1))
        .as("a per-asset (table) term boost must rank the Tier1 table first on the table index")
        .isEqualTo(tier1Table.getId().toString());

    final SearchSettings boostTier2 = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.addAssetTermBoost(
        boostTier2, TABLE_INDEX, TIER_FIELD, TIER_2, STRONG_BOOST);
    assertThat(topHit(marker, boostTier2))
        .as("re-targeting the per-asset boost onto Tier2 must flip the top hit")
        .isEqualTo(tier2Table.getId().toString());
  }

  private static SearchSettings boostTier(final SearchSettings base, final String tierFqn) {
    final SearchSettings settings = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.addGlobalTermBoost(settings, TIER_FIELD, tierFqn, STRONG_BOOST);
    return settings;
  }

  private static String topHit(final String query, final SearchSettings settings) {
    final List<String> ids =
        SearchSettingsTestHelper.previewIds(server, query, TABLE_INDEX, settings, 10);
    assertThat(ids).as("preview for '%s' must return at least one hit", query).isNotEmpty();
    return ids.get(0);
  }

  private static SearchSettings currentSettings() {
    return SearchSettingsTestHelper.currentSettings(server);
  }

  private static void awaitIndexed(final String namePrefix, final int expected) {
    RelevancyFixtures.awaitTablesIndexed(indices, search, namePrefix, expected, INDEXED_TIMEOUT);
  }
}
