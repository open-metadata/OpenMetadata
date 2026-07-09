package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
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
}
