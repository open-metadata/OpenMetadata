package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class LineageSceneSearchTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}",
        "{\"query\":{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}}"
      })
  void everyAssetLookupPreservesUserFilterAndDomainScope(String filter) throws Exception {
    SubjectContext subject =
        new SubjectContext(
            new User()
                .withName("reader")
                .withRoles(List.of(new EntityReference().withName("DomainOnlyAccessRole")))
                .withDomains(List.of(new EntityReference().withFullyQualifiedName("Engineering"))),
            null);
    LineageSceneRequest request =
        new LineageSceneRequest(
            "service",
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.FIELD,
            1,
            2,
            25,
            LineageSceneQuery.parseQueryFilter(filter),
            true,
            null,
            subject);
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString()))
        .thenAnswer(call -> "test_" + call.getArgument(0));
    List<SearchRequest> searches = new ArrayList<>();
    when(repository.search(any(SearchRequest.class), eq(subject)))
        .thenAnswer(
            call -> {
              searches.add(call.getArgument(0));
              return Response.ok(
                      "{\"hits\":{\"hits\":[{\"_source\":{\"id\":\"asset\"}}],\"total\":{\"value\":1}}}")
                  .build();
            });
    LineageSceneSearch search = new LineageSceneSearch(repository, request);

    assertEquals(
        List.of(Map.of("id", "asset")),
        search.searchRootAssets("service.name", "service", Entity.TABLE, 25).assets());
    search.searchFocusedAssets("service.name", "service", 25, "upstreamLineage.docId");
    search.searchFeederDocuments("service", 25);
    search.searchAssetsByTerms(
        "fullyQualifiedName", List.of("service.db.schema.table"), "dataAsset", 25);

    JsonNode userClause = JsonUtils.readTree(request.queryFilterJson()).path("query");
    assertEquals(4, searches.size());
    for (SearchRequest captured : searches) {
      JsonNode query = JsonUtils.readTree(captured.getQueryFilter());
      assertTrue(
          StreamSupport.stream(query.at("/query/bool/must").spliterator(), false)
              .anyMatch(userClause::equals));
      assertTrue(query.toString().contains("Engineering"));
      assertTrue(captured.getDeleted());
      assertFalse(captured.getIncludeAggregations());
    }
    assertEquals("test_dataAsset", searches.get(1).getIndex());
    assertEquals(
        LineageSceneSearch.ROOT_ASSET_ENTITY_TYPES,
        JsonUtils.convertValue(
            JsonUtils.readTree(searches.get(1).getQueryFilter())
                .at("/query/bool/filter/0/terms/entityType"),
            List.class));
    assertEquals(List.of("upstreamLineage"), searches.get(2).getIncludeSourceFields());
  }
}
