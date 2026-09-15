package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
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

    assertTrue(SearchRankingHelper.hasPrunableFuzzyStage(settings));

    SearchSettings precise = SearchRankingHelper.withoutFuzzyStages(settings);
    List<String> preciseStages =
        precise.getDefaultConfiguration().getRanking().getStages().stream()
            .map(RankingStage::getName)
            .toList();

    assertEquals(List.of("exactName", "phraseName"), preciseStages);
    assertFalse(SearchRankingHelper.hasPrunableFuzzyStage(precise));
    // The original must be untouched — the widened second pass reuses it.
    assertTrue(SearchRankingHelper.hasPrunableFuzzyStage(settings));
  }

  @Test
  void withoutFuzzyStagesIsANoOpWhenNoStageIsFuzzy() {
    SearchSettings settings = settingsWithStages("exactName", "phraseName");

    assertFalse(SearchRankingHelper.hasPrunableFuzzyStage(settings));
    assertEquals(
        2,
        SearchRankingHelper.withoutFuzzyStages(settings)
            .getDefaultConfiguration()
            .getRanking()
            .getStages()
            .size());
  }

  /**
   * Pruning must not reach back into the settings it was given. An earlier version memoised the
   * pruned copy on the source instance, which could never hit — SettingsCache.getSetting runs
   * JsonUtils.convertValue on every retrieval, so each request holds a fresh instance — and only
   * kept a strong reference to a dead object. What has to hold is that the source is untouched, so
   * the widened first pass still has its fuzzy stage on the next request.
   */
  @Test
  void withoutFuzzyStagesLeavesTheSourceSettingsIntact() {
    SearchSettings settings = settingsWithStages("exactName", "fuzzyName");

    SearchSettings precise = SearchRankingHelper.withoutFuzzyStages(settings);

    assertNotSame(settings, precise, "the pruned settings must be an independent copy");
    assertEquals(
        List.of("exactName", "fuzzyName"),
        settings.getDefaultConfiguration().getRanking().getStages().stream()
            .map(RankingStage::getName)
            .toList(),
        "pruning must not mutate the settings the widened pass still uses");
    assertEquals(
        List.of("exactName"),
        precise.getDefaultConfiguration().getRanking().getStages().stream()
            .map(RankingStage::getName)
            .toList());
  }

  /**
   * A ranking whose only stage is fuzzy has no precise pass to offer. Pruning it would empty the
   * stage list, and {@code buildRankedSimpleQueryV2} then falls back to {@code
   * buildLegacySimpleQueryV2}, whose OR {@code multi_match} on {@code fullyQualifiedName} carries no
   * minimum-should-match at all — wider than the stage that was removed, so the second pass would
   * return more siblings than the first. Skip it: leave the stage in place and report it unprunable.
   */
  @Test
  void aFuzzyOnlyRankingIsLeftAloneRatherThanEmptied() {
    SearchSettings settings = settingsWithStages("fuzzyName");

    assertFalse(
        SearchRankingHelper.hasPrunableFuzzyStage(settings),
        "With nothing precise left to run, the second pass must not happen at all");
    assertEquals(
        List.of("fuzzyName"),
        SearchRankingHelper.withoutFuzzyStages(settings)
            .getDefaultConfiguration()
            .getRanking()
            .getStages()
            .stream()
            .map(RankingStage::getName)
            .toList(),
        "Emptying the stage list would drop the query into the wider legacy builder");
  }

  /**
   * On upgrade {@code SearchSettingsHandler.mergeSearchSettings} only adopts the shipped default
   * ranking when the stored {@code defaultConfiguration} has none, so an existing install keeps
   * whatever stage list is already in its SEARCH_SETTINGS row — a differently named stage, and
   * {@code fullyQualifiedName} still among its fields. The precise pass must therefore key off
   * {@code matchType} alone, never a stage name or field list, so that the fix reaches upgraded
   * deployments without migrating stored settings.
   */
  @Test
  void withoutFuzzyStagesIgnoresStageNamesAndFieldLists() {
    RankingStage storedFuzzyStage =
        new RankingStage()
            .withName("legacyTypoFallback")
            .withFields(List.of("name", "displayName", "fullyQualifiedName"))
            .withMatchType(RankingStage.MatchType.FUZZY);
    SearchSettings stored = settingsWithStages("exactName");
    stored
        .getDefaultConfiguration()
        .getRanking()
        .setStages(
            List.of(
                stored.getDefaultConfiguration().getRanking().getStages().getFirst(),
                storedFuzzyStage));

    assertTrue(SearchRankingHelper.hasPrunableFuzzyStage(stored));

    SearchSettings precise = SearchRankingHelper.withoutFuzzyStages(stored);

    assertFalse(SearchRankingHelper.hasPrunableFuzzyStage(precise));
    assertEquals(
        List.of("exactName"),
        precise.getDefaultConfiguration().getRanking().getStages().stream()
            .map(RankingStage::getName)
            .toList(),
        "A stored stage must be dropped on matchType, whatever it is called or which fields it names");
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
            fqn, List.of("user_id", fqn, "user_email", "svc.db.schema.table.user_email").stream()));
  }

  @Test
  void identifiesAnExactNameLookupCaseInsensitivelyAndTrimmed() {
    assertTrue(
        SearchRankingHelper.isExactIdentifierLookup("  Orders ", List.of("orders").stream()));
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
            List.of("xqz_lhr__incoming_flights", "svc.db.xqz_lhr__incoming_flights").stream()));
  }

  @Test
  void doesNotIdentifyAMisspelledQuery() {
    assertFalse(
        SearchRankingHelper.isExactIdentifierLookup(
            "xqz_lhr__incaming_flights", List.of("xqz_lhr__incoming_flights").stream()));
  }

  @Test
  void doesNotIdentifyABlankQuery() {
    assertFalse(SearchRankingHelper.isExactIdentifierLookup("  ", List.of("orders").stream()));
  }

  /**
   * Every page of one query must come from one result set.
   *
   * <p>The exactly-named document sits in the top band, so judging "is this an identifier lookup"
   * from the page that was asked for gives different answers per page: {@code from=0} sees it and
   * returns the pruned set, {@code from=15} looks at hits 16-30, does not see it, and returns the
   * widened one. The pages then disagree about hits.total and about which document is 16th, and
   * rows repeat or vanish across the boundary. This fake pass reproduces exactly that corpus --
   * the identifier is only ever in the top window -- and both pages must still be pruned.
   */
  @Test
  void everyPageOfOneQueryUsesTheSameResultSet() throws IOException {
    SearchSettings settings = settingsWithStages("exactName", "fuzzyName");
    List<String> prunedWindows = new ArrayList<>();

    for (int from : List.of(0, 15, 300)) {
      prunedWindows.clear();
      SearchRankingHelper.SearchPass<List<String>> pass =
          (used, window) -> {
            boolean pruned =
                used.getDefaultConfiguration().getRanking().getStages().stream()
                    .noneMatch(stage -> "fuzzyName".equals(stage.getName()));
            if (pruned) {
              prunedWindows.add(window.from() + ":" + window.size());
            }
            // Only the top of the ranking holds the exactly-named document, as the exact band does.
            return window.from() == 0 ? List.of("orders") : List.of("orders_archive");
          };

      SearchRankingHelper.searchWithIdentifierPrecision(
          "orders",
          settings,
          new SearchRankingHelper.SearchWindow(from, 15, false),
          pass,
          List::stream);

      assertEquals(
          List.of(from + ":15"),
          prunedWindows,
          "page at from=" + from + " must be served from the pruned result set");
    }
  }

  /** A query that names nothing must never pay for a second pass, on any page. */
  @Test
  void anOrdinaryQueryIsNotRerunOnAnyPage() throws IOException {
    SearchSettings settings = settingsWithStages("exactName", "fuzzyName");
    for (int from : List.of(0, 15)) {
      List<String> windows = new ArrayList<>();
      SearchRankingHelper.SearchPass<List<String>> pass =
          (used, window) -> {
            windows.add(window.from() + ":" + window.size());
            return List.of("something_else");
          };
      SearchRankingHelper.searchWithIdentifierPrecision(
          "orders",
          settings,
          new SearchRankingHelper.SearchWindow(from, 15, false),
          pass,
          List::stream);
      assertFalse(
          windows.contains(from + ":15") && windows.size() > 2,
          "no more than a probe and the page itself: " + windows);
    }
  }

  /**
   * A search_after cursor request also carries from=0, but the cursor has scrolled it away from the
   * top. Treating its window as the top-of-ranking check would let the pruned/widened decision flip
   * between cursor pages exactly as it did between offset pages, and would judge on whatever the
   * caller had scrolled to. The probe must therefore run without the cursor.
   */
  @Test
  void aCursorPageIsNotMistakenForTheTopOfTheRanking() throws IOException {
    SearchSettings settings = settingsWithStages("exactName", "fuzzyName");
    List<String> prunedWindows = new ArrayList<>();
    List<Boolean> probeCursors = new ArrayList<>();

    SearchRankingHelper.SearchPass<List<String>> pass =
        (used, window) -> {
          boolean pruned =
              used.getDefaultConfiguration().getRanking().getStages().stream()
                  .noneMatch(stage -> "fuzzyName".equals(stage.getName()));
          if (pruned) {
            prunedWindows.add(window.from() + ":" + window.size());
          } else {
            probeCursors.add(window.cursorPaged());
          }
          // The cursor has scrolled past the exactly-named document; only an uncursored read of the
          // top can still see it.
          return window.cursorPaged() ? List.of("orders_archive") : List.of("orders");
        };

    SearchRankingHelper.searchWithIdentifierPrecision(
        "orders", settings, new SearchRankingHelper.SearchWindow(0, 15, true), pass, List::stream);

    assertEquals(
        List.of("0:15"),
        prunedWindows,
        "a cursor page must be served from the same pruned result set as page one");
    assertTrue(
        probeCursors.contains(false),
        "the probe must drop the cursor so it reads the actual top: " + probeCursors);
  }
}
