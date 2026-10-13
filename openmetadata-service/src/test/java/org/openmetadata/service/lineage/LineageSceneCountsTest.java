package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchRepository;

class LineageSceneCountsTest {

  @Test
  void rootAndFocusedTotalsUseTheSameUserFilterAsAssetSelection() throws Exception {
    String rootField = LineageSceneSearch.SERVICE_FQN_KEYWORD_FIELD;
    String bucketField = LineageSceneSearch.DATABASE_SCHEMA_FQN_KEYWORD_FIELD;
    String schemaFqn = "service.database.schema";
    LineageSceneRequest request =
        new LineageSceneRequest(
            "service.database",
            Entity.DATABASE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            1,
            1,
            10,
            LineageSceneQuery.parseQueryFilter("{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}"),
            false,
            null,
            null);
    SearchRepository repository = mock(SearchRepository.class);
    List<String> filters = new ArrayList<>();
    when(repository.genericAggregation(
            anyString(), anyString(), any(SearchAggregation.class), isNull()))
        .thenAnswer(
            call -> {
              filters.add(call.getArgument(0));
              return new DataQualityReport()
                  .withData(
                      List.of(
                          new Datum()
                              .withAdditionalProperty(rootField, "service")
                              .withAdditionalProperty(bucketField, schemaFqn)
                              .withAdditionalProperty("entityType", Entity.TABLE)
                              .withAdditionalProperty("document_count", "3")));
            });
    when(repository.getIndexOrAliasName(Entity.DATABASE_SCHEMA)).thenReturn(Entity.DATABASE_SCHEMA);
    Map<String, Object> schema =
        Map.of(
            "id",
            "schema-id",
            "entityType",
            Entity.DATABASE_SCHEMA,
            "fullyQualifiedName",
            schemaFqn,
            "database",
            Map.of("fullyQualifiedName", "service.database"));
    Map<String, Object> hits =
        Map.of("total", Map.of("value", 1), "hits", List.of(Map.of("_source", schema)));
    when(repository.search(any(SearchRequest.class), isNull()))
        .thenAnswer(call -> Response.ok(JsonUtils.pojoToJson(Map.of("hits", hits))).build());
    LineageSceneCounts counts =
        new LineageSceneCounts(repository, request, new LineageSceneSearch(repository, request));

    assertEquals(
        Map.of("service", Map.of(Entity.TABLE, 3)),
        counts.fetchRootAssetCountsByLens(rootField).counts());
    var lineage = LineageSceneLoader.emptyLineage();
    counts.enrichFocusedContainerTotals(lineage);

    assertEquals(2, filters.size());
    assertTrue(filters.stream().allMatch(filter -> filter.contains("PII.Sensitive")));
    assertEquals(
        3, lineage.getNodes().values().iterator().next().getEntity().get("lineageSceneCount"));
  }
}
