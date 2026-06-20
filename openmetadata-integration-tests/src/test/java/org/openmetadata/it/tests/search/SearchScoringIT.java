package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.withinPercentage;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Map;
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
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;

/**
 * Verifies the search <b>scoring math</b>, not just hit order: reads per-hit {@code _score} (and the
 * {@code _explanation} tree) from {@code /v1/search/preview} to prove the score-combining knobs
 * behave correctly when several fields are boosted at once — the part {@link SearchRelevancyPreviewIT}
 * only checks directionally.
 *
 * <p>Assertions are <b>relationships</b> between scores of a controlled cohort (sum &gt; max,
 * equal-under-replace, gap-shrinks-under-modifier) — never hard-coded absolute scores, which vary by
 * engine and version.
 */
@ExtendWith(TestNamespaceExtension.class)
class SearchScoringIT {

  private static final String TABLE_INDEX = "table";
  private static final String TIER_FIELD = "tier.tagFQN";
  private static final String TIER_1 = "Tier.Tier1";
  private static final String USAGE_COUNT_FIELD = "usageSummary.weeklyStats.count";
  private static final double TERM_BOOST = 100.0;
  private static final Duration TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration POLL = Duration.ofSeconds(3);

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
  void scoreModeSumExceedsMaxWhenMultipleBoostsApply(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = RelevancyFixtures.createTable(schema, marker + "a", marker, TIER_1);
    awaitIndexed(marker, 1);
    final String id = table.getId().toString();
    final SearchSettings base = SearchSettingsTestHelper.currentSettings(server);

    final double sumScore =
        scoreOf(marker, twoBoostSettings(base, AssetTypeConfiguration.ScoreMode.SUM), id);
    final double maxScore =
        scoreOf(marker, twoBoostSettings(base, AssetTypeConfiguration.ScoreMode.MAX), id);

    assertThat(sumScore)
        .as(
            "scoreMode=sum must add both boosts and score higher than scoreMode=max (%.3f)",
            maxScore)
        .isGreaterThan(maxScore);
  }

  @Test
  void boostModeReplaceIgnoresTextRelevance(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final String weakName = RelevancyFixtures.uniqueToken("wk");
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table strong = RelevancyFixtures.createTable(schema, marker, "plaindescription", TIER_1);
    final Table weak = RelevancyFixtures.createTable(schema, weakName, marker, TIER_1);
    awaitIndexed(marker, 1);
    awaitIndexed(weakName, 1);
    final String strongId = strong.getId().toString();
    final String weakId = weak.getId().toString();
    final SearchSettings base = SearchSettingsTestHelper.currentSettings(server);

    final Map<String, Double> replace =
        SearchSettingsTestHelper.previewScores(
            server,
            marker,
            TABLE_INDEX,
            tierOnly(base, AssetTypeConfiguration.BoostMode.REPLACE),
            10);
    final Map<String, Double> multiply =
        SearchSettingsTestHelper.previewScores(
            server,
            marker,
            TABLE_INDEX,
            tierOnly(base, AssetTypeConfiguration.BoostMode.MULTIPLY),
            10);

    assertThat(replace.get(strongId))
        .as("boostMode=replace must ignore text relevance — equally-boosted docs score the same")
        .isCloseTo(replace.get(weakId), withinPercentage(2));
    assertThat(multiply.get(strongId))
        .as("boostMode=multiply must keep text relevance — the stronger name match scores higher")
        .isGreaterThan(multiply.get(weakId));
  }

  @Test
  void fieldValueModifierCompressesTheScoreGap(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table low = RelevancyFixtures.createTable(schema, marker + "a", marker, null);
    final Table high = RelevancyFixtures.createTable(schema, marker + "b", marker, null);
    RelevancyFixtures.reportUsage(low, 100);
    RelevancyFixtures.reportUsage(high, 10000);
    awaitIndexed(marker, 2);
    final String lowId = low.getId().toString();
    final String highId = high.getId().toString();
    final SearchSettings base = SearchSettingsTestHelper.currentSettings(server);

    // The linear gap exceeds the sqrt-compressed gap only once usage has rolled into usageSummary,
    // so poll the relationship rather than the absolute scores.
    Awaitility.await("a sqrt modifier compresses the usage-driven score gap")
        .atMost(TIMEOUT)
        .pollInterval(POLL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final double linearGap = usageScoreGap(marker, base, null, highId, lowId);
              final double sqrtGap =
                  usageScoreGap(marker, base, FieldValueBoost.Modifier.SQRT, highId, lowId);
              assertThat(linearGap)
                  .as("linear gap %.2f must clearly exceed sqrt gap %.2f", linearGap, sqrtGap)
                  .isGreaterThan(sqrtGap * 1.5);
            });
  }

  @Test
  void explanationExposesTheConfiguredBoostFunction(final TestNamespace ns) {
    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    RelevancyFixtures.createTable(schema, marker + "a", marker, null);
    awaitIndexed(marker, 1);

    final SearchSettings settings =
        SearchSettingsTestHelper.copyOf(SearchSettingsTestHelper.currentSettings(server));
    SearchSettingsTestHelper.clearBoosts(settings, TABLE_INDEX);
    SearchSettingsTestHelper.addAssetFieldValueBoost(
        settings, TABLE_INDEX, USAGE_COUNT_FIELD, 7.0, null, 5.0);

    final JsonNode hits =
        SearchSettingsTestHelper.preview(server, marker, TABLE_INDEX, settings, 10, true)
            .path("hits")
            .path("hits");
    assertThat(hits).as("preview must return the seeded table").isNotEmpty();
    final String explanation = hits.get(0).path("_explanation").toString();

    assertThat(explanation)
        .as("explain must show the function-score wrapper the boosts run through")
        .containsIgnoringCase("function score");
    assertThat(explanation)
        .as("explain must reference the configured field-value boost field")
        .contains("weeklyStats");
  }

  private static SearchSettings twoBoostSettings(
      final SearchSettings base, final AssetTypeConfiguration.ScoreMode scoreMode) {
    final SearchSettings settings = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.clearBoosts(settings, TABLE_INDEX);
    SearchSettingsTestHelper.addAssetTermBoost(
        settings, TABLE_INDEX, TIER_FIELD, TIER_1, TERM_BOOST);
    SearchSettingsTestHelper.addAssetFieldValueBoost(
        settings, TABLE_INDEX, USAGE_COUNT_FIELD, 5.0, null, 10.0);
    SearchSettingsTestHelper.setBoostMode(
        settings, TABLE_INDEX, AssetTypeConfiguration.BoostMode.MULTIPLY);
    SearchSettingsTestHelper.setScoreMode(settings, TABLE_INDEX, scoreMode);
    return settings;
  }

  private static SearchSettings tierOnly(
      final SearchSettings base, final AssetTypeConfiguration.BoostMode boostMode) {
    final SearchSettings settings = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.clearBoosts(settings, TABLE_INDEX);
    SearchSettingsTestHelper.addAssetTermBoost(
        settings, TABLE_INDEX, TIER_FIELD, TIER_1, TERM_BOOST);
    SearchSettingsTestHelper.setScoreMode(
        settings, TABLE_INDEX, AssetTypeConfiguration.ScoreMode.SUM);
    SearchSettingsTestHelper.setBoostMode(settings, TABLE_INDEX, boostMode);
    return settings;
  }

  private static double usageScoreGap(
      final String marker,
      final SearchSettings base,
      final FieldValueBoost.Modifier modifier,
      final String highId,
      final String lowId) {
    final SearchSettings settings = SearchSettingsTestHelper.copyOf(base);
    SearchSettingsTestHelper.clearBoosts(settings, TABLE_INDEX);
    SearchSettingsTestHelper.addAssetFieldValueBoost(
        settings, TABLE_INDEX, USAGE_COUNT_FIELD, 1.0, modifier, 0.0);
    SearchSettingsTestHelper.setScoreMode(
        settings, TABLE_INDEX, AssetTypeConfiguration.ScoreMode.SUM);
    SearchSettingsTestHelper.setBoostMode(
        settings, TABLE_INDEX, AssetTypeConfiguration.BoostMode.REPLACE);
    final Map<String, Double> scores =
        SearchSettingsTestHelper.previewScores(server, marker, TABLE_INDEX, settings, 10);
    return scores.get(highId) / scores.get(lowId);
  }

  private static double scoreOf(
      final String marker, final SearchSettings settings, final String id) {
    final Double score =
        SearchSettingsTestHelper.previewScores(server, marker, TABLE_INDEX, settings, 10).get(id);
    assertThat(score).as("doc %s must be scored", id).isNotNull();
    return score;
  }

  private static void awaitIndexed(final String namePrefix, final int expected) {
    RelevancyFixtures.awaitTablesIndexed(indices, search, namePrefix, expected, TIMEOUT);
  }
}
