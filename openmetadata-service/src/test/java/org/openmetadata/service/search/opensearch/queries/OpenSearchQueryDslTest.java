package org.openmetadata.service.search.opensearch.queries;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.queries.SearchQueryDsl;
import org.openmetadata.service.search.queries.SearchQueryDslParityTest;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;

class OpenSearchQueryDslTest {

  private final SearchQueryDsl dsl = new OpenSearchQueryDsl(new JacksonJsonpMapper());

  @Test
  void toJson_rendersAClauseBuiltWithItsOwnFactory() {
    QueryBuilderFactory factory = dsl.queryBuilderFactory();
    OMQueryBuilder query =
        factory
            .boolQuery()
            .must(List.of(factory.termQuery("deleted", "false")))
            .should(List.of(factory.termsQuery("entityType", List.of("table", "topic"))));

    assertEquals(
        "{\"bool\":{\"must\":[{\"term\":{\"deleted\":{\"value\":\"false\"}}}],"
            + "\"should\":[{\"terms\":{\"entityType\":[\"table\",\"topic\"]}}]}}",
        dsl.toJson(query));
  }

  @Test
  void dataAssetQueryJson_carriesTheRankingShellOfTheSearchSettings() throws Exception {
    String json = SearchQueryDslParityTest.shippedDataAssetQuery(dsl);

    assertTrue(json.contains("\"function_score\""), json);
  }
}
