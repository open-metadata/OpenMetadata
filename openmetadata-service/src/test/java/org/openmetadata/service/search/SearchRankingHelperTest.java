package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
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
}
