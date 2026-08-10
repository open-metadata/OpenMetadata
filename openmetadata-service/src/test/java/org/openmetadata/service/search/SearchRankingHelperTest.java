package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingSignals;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.StopWordsByLanguage;

class SearchRankingHelperTest {

  @Test
  void exactMatchTextsBuildsSeparatorVariantsAfterStopwordRemoval() {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withStopWordsByLanguage(
                new StopWordsByLanguage().withAdditionalProperty("en", List.of("in")));

    String significantQuery =
        SearchRankingHelper.significantQueryText("Provider Address in Texas", ranking);

    assertEquals("provider address texas", significantQuery);
    assertEquals(
        List.of(
            "provider address texas",
            "provider_address_texas",
            "provider-address-texas",
            "provider.address.texas",
            "provideraddresstexas"),
        SearchRankingHelper.exactMatchTexts(significantQuery));
  }

  @Test
  void exactMatchTextsHandlesNullAndBlankQueries() {
    assertEquals(List.of(), SearchRankingHelper.exactMatchTexts((String) null));
    assertEquals(List.of(), SearchRankingHelper.exactMatchTexts(Arrays.asList(null, "  ")));
  }

  @Test
  void exactMatchTextsStripSingleSurroundingQuotePair() {
    assertEquals(
        List.of(
            "customer orders",
            "customer_orders",
            "customer-orders",
            "customer.orders",
            "customerorders"),
        SearchRankingHelper.exactMatchTexts("\"customer orders\""));
  }

  @Test
  void exactMatchTextsIncludeRawVariantsBeforeStopwordStrippedVariants() {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withStopWordsByLanguage(
                new StopWordsByLanguage().withAdditionalProperty("en", List.of("of")));

    String rawQuery = "cost of goods sold";
    String significantQuery = SearchRankingHelper.significantQueryText(rawQuery, ranking);

    assertEquals("cost goods sold", significantQuery);
    assertEquals(
        List.of(
            "cost of goods sold",
            "cost_of_goods_sold",
            "cost-of-goods-sold",
            "cost.of.goods.sold",
            "costofgoodssold",
            "cost goods sold",
            "cost_goods_sold",
            "cost-goods-sold",
            "cost.goods.sold",
            "costgoodssold"),
        SearchRankingHelper.exactMatchTexts(List.of(rawQuery, significantQuery)));
  }

  @Test
  void significantQueryTextPreservesUnderscoreAndDottedIdentifiers() {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withStopWordsByLanguage(
                new StopWordsByLanguage().withAdditionalProperty("en", List.of("in")));

    // Identifier queries must stay intact so they still match the keyword fqnParts parts and the
    // om_analyzer compound tokens. Splitting "sample_data" into "sample data" made the ranked
    // query miss every asset whose FQN carries the service/database identifier.
    assertEquals("sample_data", SearchRankingHelper.significantQueryText("sample_data", ranking));
    assertEquals(
        "sample_data.ecommerce",
        SearchRankingHelper.significantQueryText("sample_data.ecommerce", ranking));

    // Stop-word removal still applies, but only on whitespace boundaries.
    assertEquals(
        "provider_address texas",
        SearchRankingHelper.significantQueryText("provider_address in texas", ranking));
  }

  @Test
  void exactMatchTextsPreserveCaseAndIncludeLowercaseVariants() {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withStopWordsByLanguage(
                new StopWordsByLanguage().withAdditionalProperty("en", List.of("in")));

    String significantQuery =
        SearchRankingHelper.significantQueryTextPreservingCase("Table 2 in Warehouse", ranking);

    assertEquals("Table 2 Warehouse", significantQuery);
    assertEquals(
        List.of(
            "Table 2 Warehouse",
            "Table_2_Warehouse",
            "Table-2-Warehouse",
            "Table.2.Warehouse",
            "Table2Warehouse",
            "table 2 warehouse",
            "table_2_warehouse",
            "table-2-warehouse",
            "table.2.warehouse",
            "table2warehouse"),
        SearchRankingHelper.exactMatchTexts(significantQuery));
  }

  @Test
  void significantQueryTextPreservingCaseDeduplicatesMixedCaseTokens() {
    String significantQuery =
        SearchRankingHelper.significantQueryTextPreservingCase(
            "Warehouse warehouse", new RankingConfiguration());

    assertEquals("Warehouse", significantQuery);
    assertEquals(
        List.of("Warehouse", "warehouse"), SearchRankingHelper.exactMatchTexts(significantQuery));
  }

  @Test
  void unescapePlainTextQueryRemovesUiEscapes() {
    assertEquals(
        "pw-ml-model-service.pw-mlmodel",
        SearchRankingHelper.unescapePlainTextQuery("pw\\-ml\\-model\\-service.pw\\-mlmodel"));
    assertEquals(
        "customer:orders (daily)",
        SearchRankingHelper.unescapePlainTextQuery("customer\\:orders \\(daily\\)"));
    assertEquals("path\\name", SearchRankingHelper.unescapePlainTextQuery("path\\\\name"));
    assertNull(SearchRankingHelper.unescapePlainTextQuery(null));
  }

  @Test
  void resolveRankingHandlesDefaultRankingWithoutStages() {
    SearchSettings settings =
        new SearchSettings()
            .withDefaultConfiguration(
                new AssetTypeConfiguration()
                    .withRanking(new RankingConfiguration().withEnabled(true)));

    RankingConfiguration resolved =
        SearchRankingHelper.resolveRanking(
            settings,
            new AssetTypeConfiguration()
                .withSearchFields(List.of(new FieldBoost().withField("name"))));

    assertNotNull(resolved);
    assertEquals(List.of(), resolved.getStages());
  }

  @Test
  void resolveRankingDerivesFuzzyNameStageFromPrimaryNameFields() {
    SearchSettings settings =
        new SearchSettings()
            .withDefaultConfiguration(
                new AssetTypeConfiguration()
                    .withRanking(
                        new RankingConfiguration()
                            .withEnabled(true)
                            .withStages(
                                List.of(
                                    new RankingStage()
                                        .withName("closeName")
                                        .withFields(List.of("name"))
                                        .withMatchType(RankingStage.MatchType.TOKEN_COVERAGE),
                                    new RankingStage()
                                        .withName("fuzzyName")
                                        .withFields(List.of("name"))
                                        .withMatchType(RankingStage.MatchType.FUZZY)))));

    RankingConfiguration resolved =
        SearchRankingHelper.resolveRanking(
            settings,
            new AssetTypeConfiguration()
                .withSearchFields(
                    List.of(
                        new FieldBoost().withField("description"),
                        new FieldBoost().withField("displayName"),
                        new FieldBoost().withField("name"))));

    RankingStage fuzzyName =
        resolved.getStages().stream()
            .filter(stage -> "fuzzyName".equals(stage.getName()))
            .findFirst()
            .orElseThrow();

    assertEquals(RankingStage.MatchType.FUZZY, fuzzyName.getMatchType());
    assertEquals(List.of("displayName", "name"), fuzzyName.getFields());
  }

  @Test
  void resolveRankingDerivesPartialNameStageFromNgramFields() {
    SearchSettings settings =
        new SearchSettings()
            .withDefaultConfiguration(
                new AssetTypeConfiguration()
                    .withRanking(
                        new RankingConfiguration()
                            .withEnabled(true)
                            .withStages(
                                List.of(
                                    new RankingStage()
                                        .withName("partialName")
                                        .withFields(List.of("name.ngram"))
                                        .withMatchType(RankingStage.MatchType.STANDARD)))));

    RankingConfiguration resolved =
        SearchRankingHelper.resolveRanking(
            settings,
            new AssetTypeConfiguration()
                .withSearchFields(
                    List.of(
                        new FieldBoost().withField("name"),
                        new FieldBoost().withField("name.ngram"),
                        new FieldBoost().withField("displayName.ngram"),
                        new FieldBoost().withField("description"))));

    RankingStage partialName =
        resolved.getStages().stream()
            .filter(stage -> "partialName".equals(stage.getName()))
            .findFirst()
            .orElseThrow();

    // The partial-name stage must keep the n-gram fields that every other stage drops; without
    // them substring queries like "ord" silently stop matching "orders_fact".
    assertEquals(List.of("name.ngram", "displayName.ngram"), partialName.getFields());
  }

  @Test
  void stageSearchAnalyzerUsesPlainAnalyzerOnlyForNgramStages() {
    // n-gram-only stage: query with a plain analyzer so a long token cannot re-n-gram into
    // hundreds of clauses and trip OpenSearch's maxClauseCount.
    assertEquals(
        "standard",
        SearchRankingHelper.stageSearchAnalyzer(
            new RankingStage().withFields(List.of("name.ngram", "displayName.ngram"))));

    // Non-n-gram stages keep the field's own analyzer.
    assertNull(
        SearchRankingHelper.stageSearchAnalyzer(
            new RankingStage().withFields(List.of("name", "displayName"))));

    // A mixed stage must not force the plain analyzer onto the non-n-gram fields.
    assertNull(
        SearchRankingHelper.stageSearchAnalyzer(
            new RankingStage().withFields(List.of("name", "name.ngram"))));
  }

  @Test
  void signalFieldEnabledUsesRankingSignalsAllowList() {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withSignals(
                new RankingSignals()
                    .withFields(List.of("tier.tagFQN", "usageSummary.weeklyStats.percentileRank")));

    assertTrue(SearchRankingHelper.signalFieldEnabled(ranking, "tier.tagFQN"));
    assertFalse(SearchRankingHelper.signalFieldEnabled(ranking, "usageSummary.weeklyStats.count"));
    assertTrue(
        SearchRankingHelper.signalFieldEnabled(new RankingConfiguration(), "unlisted.signal"));
  }

  @Test
  void stageFieldWeightsNormalizeConfiguredSearchFieldBoosts() {
    RankingStage stage =
        new RankingStage().withFields(List.of("displayName", "name", "description"));
    AssetTypeConfiguration assetConfig =
        new AssetTypeConfiguration()
            .withSearchFields(
                List.of(
                    new FieldBoost().withField("displayName").withBoost(20.0),
                    new FieldBoost().withField("name").withBoost(10.0),
                    new FieldBoost().withField("description").withBoost(1.0)));

    Map<String, Float> weights = SearchRankingHelper.stageFieldWeights(stage, assetConfig);

    assertEquals(1.25F, weights.get("displayName"));
    assertEquals(1.0F, weights.get("name"));
    assertEquals(0.775F, weights.get("description"));
  }

  /**
   * The precise pass must keep every stage that decides recall on its own merits and drop only the
   * fuzzy fallback. Ranking stages sit under a should with minimum_should_match:1, so the fuzzy
   * stage admits documents rather than only scoring them: anything missing one of the query's
   * tokens clears its partial-coverage threshold, which on an FQN is exactly its siblings (#31227).
   */
  @Test
  void withoutFuzzyStagesDropsOnlyTheFuzzyStage() {
    SearchSettings settings = settingsWithStages("exactName", "phraseName", "fuzzyName");

    assertTrue(SearchRankingHelper.hasFuzzyStage(settings));

    SearchSettings precise = SearchRankingHelper.withoutFuzzyStages(settings);
    List<String> preciseStages =
        precise.getDefaultConfiguration().getRanking().getStages().stream()
            .map(RankingStage::getName)
            .toList();

    assertEquals(List.of("exactName", "phraseName"), preciseStages);
    assertFalse(SearchRankingHelper.hasFuzzyStage(precise));
    // The original must be untouched — the widened second pass reuses it.
    assertTrue(SearchRankingHelper.hasFuzzyStage(settings));
  }

  @Test
  void withoutFuzzyStagesIsANoOpWhenNoStageIsFuzzy() {
    SearchSettings settings = settingsWithStages("exactName", "phraseName");

    assertFalse(SearchRankingHelper.hasFuzzyStage(settings));
    assertEquals(
        2,
        SearchRankingHelper.withoutFuzzyStages(settings)
            .getDefaultConfiguration()
            .getRanking()
            .getStages()
            .size());
  }

  private static RankingStage.MatchType matchTypeFor(String stageName) {
    return switch (stageName) {
      case "fuzzyName" -> RankingStage.MatchType.FUZZY;
      case "phraseName" -> RankingStage.MatchType.PHRASE;
        // closeName is itself a partial-coverage stage, so it must not count as an identity match.
      case "closeName" -> RankingStage.MatchType.TOKEN_COVERAGE;
      default -> RankingStage.MatchType.EXACT;
    };
  }

  private static SearchSettings settingsWithStages(String... stageNames) {
    List<RankingStage> stages =
        Arrays.stream(stageNames)
            .map(
                name ->
                    new RankingStage()
                        .withName(name)
                        .withFields(List.of("name"))
                        .withMatchType(matchTypeFor(name)))
            .toList();
    AssetTypeConfiguration defaultConfig =
        new AssetTypeConfiguration()
            .withAssetType("default")
            .withRanking(new RankingConfiguration().withEnabled(true).withStages(stages));
    return new SearchSettings().withDefaultConfiguration(defaultConfig);
  }

  /**
   * The FQN lookup: the query is exactly the target column's fullyQualifiedName, so partial-coverage
   * recall can only add its siblings — which is the "count 1 vs results 7381" bug (#31227).
   */
  @Test
  void identifiesAnExactFqnLookup() {
    String fqn = "svc.db.schema.table.user_id";
    assertTrue(
        SearchRankingHelper.isExactIdentifierLookup(
            fqn, List.of("user_id", fqn, "user_email", "svc.db.schema.table.user_email")));
  }

  @Test
  void identifiesAnExactNameLookupCaseInsensitivelyAndTrimmed() {
    assertTrue(SearchRankingHelper.isExactIdentifierLookup("  Orders ", List.of("orders")));
  }

  /**
   * A half-typed or misspelled query names nothing exactly, so the fuzzy stage keeps its recall —
   * this is the SearchResourceIT autocomplete/typo behaviour that earlier stage-provenance
   * heuristics discarded.
   */
  @Test
  void doesNotIdentifyAHalfTypedQuery() {
    assertFalse(
        SearchRankingHelper.isExactIdentifierLookup(
            "xqz_lhr__i",
            List.of("xqz_lhr__incoming_flights", "svc.db.xqz_lhr__incoming_flights")));
  }

  @Test
  void doesNotIdentifyAMisspelledQuery() {
    assertFalse(
        SearchRankingHelper.isExactIdentifierLookup(
            "xqz_lhr__incaming_flights", List.of("xqz_lhr__incoming_flights")));
  }

  @Test
  void doesNotIdentifyABlankQuery() {
    assertFalse(SearchRankingHelper.isExactIdentifierLookup("  ", List.of("orders")));
  }
}
