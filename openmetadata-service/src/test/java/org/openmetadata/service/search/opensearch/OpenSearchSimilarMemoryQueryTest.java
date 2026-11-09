package org.openmetadata.service.search.opensearch;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

/** A reworded fact shares most words with its original, never all of them in one field. */
class OpenSearchSimilarMemoryQueryTest {
  private static final String TEXT = "how often does payroll run payroll runs every second friday";
  private static final String FILTER =
      "{\"bool\":{\"filter\":[{\"term\":{\"sourceType\":\"FileExtraction\"}}]}}";
  private final AtomicReference<SearchRequest> request = new AtomicReference<>();
  private MockedStatic<Entity> entity;
  private OpenSearchClient client;
  private OpenSearchSearchManager manager;

  @BeforeEach
  void setUp() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.CONTEXT_MEMORY))
        .thenReturn("context_memory_search_index");
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    client = mock(OpenSearchClient.class);
    manager = new OpenSearchSearchManager(client, null, "", null);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void queryIsRankedNotAllTermsRequired() throws Exception {
    answer(false);

    manager.searchSimilarContextMemories(TEXT, FILTER, 20);

    assertEquals(List.of("context_memory_search_index"), request.get().index());
    assertEquals(20, request.get().size());
    assertTrue(request.get().sort().isEmpty(), "hits come back best ranked first");
    JsonNode bool = requestJson().path("query").path("bool");
    JsonNode ranked = bool.path("must").get(0).path("multi_match");
    assertEquals(TEXT, ranked.path("query").asText());
    assertEquals("cross_fields", ranked.path("type").asText());
    assertEquals("or", ranked.path("operator").asText());
    assertEquals("30%", ranked.path("minimum_should_match").asText());
    assertEquals(
        List.of("question", "answer", "title", "summary"),
        JsonUtils.convertValue(ranked.path("fields"), List.class));
    assertEquals(JsonUtils.readTree(FILTER), wrapped(bool.path("filter").get(0)));
    assertFalse(
        requestJson().toString().contains(ContextMemoryIndex.UNANCHORED),
        "no org-wide default hides a memory anchored to its file");
  }

  /** A hit's document can carry an embedding of tens of kilobytes; the check reads its ids alone. */
  @Test
  void onlyTheIdsTheDuplicateCheckReadsAreFetched() throws Exception {
    answer(false);

    manager.searchSimilarContextMemories(TEXT, FILTER, 20);

    JsonNode source = requestJson().path("_source");
    assertEquals(
        List.of("id", "parentId"), JsonUtils.convertValue(source.path("includes"), List.class));
    assertEquals(List.of(), JsonUtils.convertValue(source.path("excludes"), List.class));
  }

  /** A timed-out search read as "no similar memory" would store the fact again. */
  @Test
  void aPartialAnswerFailsInsteadOfFindingNoDuplicate() throws Exception {
    answer(true);

    assertThrows(IOException.class, () -> manager.searchSimilarContextMemories(TEXT, FILTER, 20));
  }

  private void answer(boolean timedOut) throws IOException {
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              request.set(invocation.getArgument(0));
              return new SearchResponse.Builder<JsonData>()
                  .took(1)
                  .timedOut(timedOut)
                  .shards(shards -> shards.total(1).successful(1).failed(0))
                  .hits(hits -> hits.hits(List.of()))
                  .build();
            });
  }

  private JsonNode requestJson() {
    return JsonUtils.readTree(request.get().toJsonString());
  }

  private static JsonNode wrapped(JsonNode wrapper) {
    byte[] query = Base64.getDecoder().decode(wrapper.path("wrapper").path("query").asText());
    return JsonUtils.readTree(new String(query, UTF_8));
  }
}
