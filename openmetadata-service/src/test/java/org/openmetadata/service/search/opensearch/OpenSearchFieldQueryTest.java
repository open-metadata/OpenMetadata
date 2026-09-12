package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

class OpenSearchFieldQueryTest {
  private final AtomicReference<SearchRequest> request = new AtomicReference<>();
  private MockedStatic<Entity> entity;
  private OpenSearchSearchManager manager;

  @BeforeEach
  void setUp() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.TABLE)).thenReturn("table_search_index");
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    OpenSearchClient client = mock(OpenSearchClient.class);
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              request.set(invocation.getArgument(0));
              return new SearchResponse.Builder<JsonData>()
                  .took(1)
                  .timedOut(false)
                  .shards(shards -> shards.total(1).successful(1).failed(0))
                  .hits(hits -> hits.hits(List.of()))
                  .build();
            });
    manager = new OpenSearchSearchManager(client, null, "", null);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void legacyFieldQueriesKeepEngineDefaultsAndCaseSensitiveMatching() throws Exception {
    manager.searchByField("name", "Orders*", Entity.TABLE, false, 10, 5).close();

    assertEquals(List.of("table_search_index"), request.get().index());
    assertEquals(10, request.get().from());
    assertEquals(5, request.get().size());
    assertNull(request.get().trackTotalHits());
    assertTrue(request.get().sort().isEmpty());
    assertNull(requestJson().findValue("case_insensitive"));
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
  }

  @Test
  void sceneFieldQueriesApplyProjectionExistsAndDisabledHitCounting() throws Exception {
    manager
        .searchByFieldWithOptions(
            "name", "Orders*", Entity.TABLE, false, 0, 5, List.of("id"), "lineage", false)
        .close();

    assertFalse(request.get().trackTotalHits().enabled());
    assertEquals(List.of("id"), request.get().source().filter().includes());
    assertEquals("lineage", requestJson().findValue("exists").path("field").asText());
    assertTrue(requestJson().findValue("case_insensitive").asBoolean());
    assertEquals(1, request.get().sort().size());
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
    assertTrue(requestJson().toString().contains("\"Entity\""));
  }

  @Test
  void sceneTermQueriesPreserveLiteralValuesAndCanCountHits() throws Exception {
    manager
        .searchByTerms(
            "id", List.of("literal*", "literal?"), Entity.TABLE, true, 0, 5, List.of(), true)
        .close();

    assertTrue(request.get().trackTotalHits().enabled());
    assertNull(request.get().source());
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
    assertTrue(requestJson().toString().contains("\"Entity\""));
    assertEquals(
        List.of("literal*", "literal?"),
        JsonUtils.convertValue(requestJson().findValue("terms").path("id"), List.class));
  }

  private JsonNode requestJson() throws Exception {
    return JsonUtils.readTree(request.get().toJsonString());
  }
}
