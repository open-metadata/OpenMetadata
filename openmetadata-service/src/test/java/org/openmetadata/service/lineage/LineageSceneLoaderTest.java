package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.lineage.LineageSceneLoader.LoadedScene;
import org.openmetadata.service.search.SearchRepository;

class LineageSceneLoaderTest {
  private static final String FOCUS = "service.database.schema";
  private static final String FILTER = "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}";

  @Test
  void focusedInventoryUsesOneParticipantAndOneFillQueryAcrossAssetTypes() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    List<SearchRequest> searches = new ArrayList<>();
    when(repository.getIndexOrAliasName(anyString())).thenAnswer(call -> call.getArgument(0));
    when(repository.search(any(SearchRequest.class), isNull()))
        .thenAnswer(
            call -> {
              SearchRequest request = call.getArgument(0);
              searches.add(request);
              JsonNode query = JsonUtils.readTree(request.getQueryFilter());
              assertTrue(query.toString().contains("PII.Sensitive"));
              if (request.getIncludeSourceFields().equals(List.of("upstreamLineage"))) {
                return response(
                    List.of(
                        Map.of(
                            "upstreamLineage",
                            List.of(
                                Map.of(
                                    "fromEntity",
                                    Map.of("fullyQualifiedName", FOCUS + ".feeder"))))));
              }
              if (query.findValue("terms") != null
                  && query.findValue("terms").has("fullyQualifiedName")) {
                return response(List.of(asset("feeder", Entity.TABLE)));
              }
              if (query.findValue("exists") != null) {
                return response(List.of(asset("participant", Entity.TABLE)));
              }
              return response(
                  List.of(
                      asset("participant", Entity.TABLE),
                      asset("feeder", Entity.TABLE),
                      asset("inventory", Entity.STORED_PROCEDURE)));
            });
    when(repository.searchLineage(any(SearchLineageRequest.class), isNull()))
        .thenAnswer(
            call -> {
              SearchLineageRequest request = call.getArgument(0);
              assertTrue(request.getQueryFilter().contains("PII.Sensitive"));
              assertEquals(1, request.getUpstreamDepth());
              assertEquals(2, request.getDownstreamDepth());
              return LineageSceneLoader.emptyLineage();
            });

    LoadedScene loaded = new LineageSceneLoader(repository, request()).load();

    assertEquals(
        Set.of(FOCUS + ".participant", FOCUS + ".feeder", FOCUS + ".inventory"),
        loaded.lineage().getNodes().keySet());
    assertFalse(loaded.sampled());
    assertEquals(4, searches.size());
    assertTrue(searches.stream().allMatch(search -> "dataAsset".equals(search.getIndex())));
    for (SearchRequest search : List.of(searches.getFirst(), searches.getLast())) {
      assertEquals(
          LineageSceneSearch.ROOT_ASSET_ENTITY_TYPES,
          JsonUtils.convertValue(
              JsonUtils.readTree(search.getQueryFilter())
                  .at("/query/bool/filter/0/terms/entityType"),
              List.class));
    }
  }

  @Test
  void failedChildLookupMarksTheLoadedSceneSampledAndKeepsSuccessfulResults() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString())).thenAnswer(call -> call.getArgument(0));
    when(repository.search(any(SearchRequest.class), isNull()))
        .thenAnswer(
            call -> {
              SearchRequest search = call.getArgument(0);
              return response(
                  search.getIncludeSourceFields().equals(List.of("upstreamLineage"))
                      ? List.of()
                      : List.of(asset("success", Entity.TABLE), asset("failed", Entity.TABLE)));
            });
    when(repository.searchLineage(any(SearchLineageRequest.class), isNull()))
        .thenAnswer(
            call -> {
              SearchLineageRequest search = call.getArgument(0);
              if (search.getFqn().endsWith(".failed")) {
                throw new IOException("search unavailable");
              }
              return LineageSceneLoader.emptyLineage()
                  .withNodes(
                      Map.of(
                          "neighbor",
                          new NodeInformation().withEntity(asset("neighbor", Entity.TABLE))));
            });

    LoadedScene loaded = new LineageSceneLoader(repository, request()).load();

    assertTrue(loaded.sampled());
    assertTrue(loaded.lineage().getNodes().containsKey("neighbor"));
    assertTrue(loaded.lineage().getNodes().containsKey(FOCUS + ".success"));
  }

  private static LineageSceneRequest request() {
    return new LineageSceneRequest(
        FOCUS,
        Entity.DATABASE_SCHEMA,
        LineageLens.SERVICE,
        LineageBand.ASSET,
        1,
        2,
        10,
        LineageSceneQuery.parseQueryFilter(FILTER),
        false,
        null,
        null);
  }

  private static Map<String, Object> asset(String name, String type) {
    return Map.of("id", name, "fullyQualifiedName", FOCUS + "." + name, "entityType", type);
  }

  private static Response response(List<Map<String, Object>> assets) {
    return Response.ok(
            JsonUtils.pojoToJson(
                Map.of(
                    "hits",
                    Map.of(
                        "total", Map.of("value", assets.size()),
                        "hits", assets.stream().map(asset -> Map.of("_source", asset)).toList()))))
        .build();
  }
}
