package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.search.elasticsearch.ElasticSearchRequestBuilder;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;

class SearchRequestBuilderTotalHitsTest {

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void elasticSearchHonorsExplicitTotalHitsSetting(boolean enabled) {
    var request =
        new ElasticSearchRequestBuilder().trackTotalHits(enabled).build("table_search_index");

    assertEquals(enabled, request.trackTotalHits().enabled());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void openSearchHonorsExplicitTotalHitsSetting(boolean enabled) {
    var request =
        new OpenSearchRequestBuilder().trackTotalHits(enabled).build("table_search_index");

    assertEquals(enabled, request.trackTotalHits().enabled());
  }

  @Test
  void engineDefaultsArePreservedWhenTotalHitsSettingIsOmitted() {
    assertNull(new ElasticSearchRequestBuilder().build("table_search_index").trackTotalHits());
    assertNull(new OpenSearchRequestBuilder().build("table_search_index").trackTotalHits());
  }

  @Test
  void boundedTotalHitsRemainAvailable() {
    assertEquals(
        100,
        new ElasticSearchRequestBuilder()
            .trackTotalHitsUpTo(100)
            .build("table_search_index")
            .trackTotalHits()
            .count());
    assertEquals(
        100,
        new OpenSearchRequestBuilder()
            .trackTotalHitsUpTo(100)
            .build("table_search_index")
            .trackTotalHits()
            .count());
  }
}
