package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSearchManager;
import org.openmetadata.service.search.opensearch.OpenSearchSearchManager;

/** A successful HTTP response can still be incomplete; exports must not turn it into a full estate. */
class SearchExportCompletenessTest {
  private MockedStatic<Entity> entities;
  private MockedStatic<SettingsCache> settings;

  @BeforeEach
  void configureSearch() throws IOException {
    entities = mockStatic(Entity.class);
    settings = mockStatic(SettingsCache.class);
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexNameWithoutAlias(anyString())).thenReturn("table_search_index");
    entities.when(Entity::getSearchRepository).thenReturn(repository);
    try (var input = getClass().getResourceAsStream("/json/data/settings/searchSettings.json")) {
      SearchSettings config =
          JsonUtils.readValue(
              new String(input.readAllBytes(), StandardCharsets.UTF_8), SearchSettings.class);
      settings
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(config);
    }
  }

  @AfterEach
  void closeStatics() {
    settings.close();
    entities.close();
  }

  @ParameterizedTest
  @CsvSource({"true,0", "false,1", "false,0"})
  void elasticsearchRetriesAndRejectsPersistentIncompleteResponses(boolean timeout, int failed)
      throws IOException {
    var client = mock(es.co.elastic.clients.elasticsearch.ElasticsearchClient.class);
    var response = elasticsearchResponse(timeout, failed);
    when(client.search(
            any(es.co.elastic.clients.elasticsearch.core.SearchRequest.class),
            eq(es.co.elastic.clients.json.JsonData.class)))
        .thenReturn(response);
    var manager = new ElasticSearchSearchManager(client, null, "", null);
    if (timeout || failed > 0) {
      IOException error =
          assertThrows(IOException.class, () -> manager.searchForExport(request(), null));
      assertTrue(error.getMessage().contains("timedOut=" + timeout));
      assertTrue(error.getMessage().contains("failedShards=" + failed));
      verify(client, times(3))
          .search(
              any(es.co.elastic.clients.elasticsearch.core.SearchRequest.class),
              eq(es.co.elastic.clients.json.JsonData.class));
    } else {
      assertTrue(manager.searchForExport(request(), null).getResults().isEmpty());
      verify(client)
          .search(
              any(es.co.elastic.clients.elasticsearch.core.SearchRequest.class),
              eq(es.co.elastic.clients.json.JsonData.class));
    }
  }

  @ParameterizedTest
  @CsvSource({"true,0", "false,1", "false,0"})
  void opensearchRetriesAndRejectsPersistentIncompleteResponses(boolean timeout, int failed)
      throws IOException {
    var client = mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    var response = opensearchResponse(timeout, failed);
    when(client.search(
            any(os.org.opensearch.client.opensearch.core.SearchRequest.class),
            eq(os.org.opensearch.client.json.JsonData.class)))
        .thenReturn(response);
    var manager = new OpenSearchSearchManager(client, null, "", null);
    if (timeout || failed > 0) {
      IOException error =
          assertThrows(IOException.class, () -> manager.searchForExport(request(), null));
      assertTrue(error.getMessage().contains("timedOut=" + timeout));
      assertTrue(error.getMessage().contains("failedShards=" + failed));
      verify(client, times(3))
          .search(
              any(os.org.opensearch.client.opensearch.core.SearchRequest.class),
              eq(os.org.opensearch.client.json.JsonData.class));
    } else {
      assertTrue(manager.searchForExport(request(), null).getResults().isEmpty());
      verify(client)
          .search(
              any(os.org.opensearch.client.opensearch.core.SearchRequest.class),
              eq(os.org.opensearch.client.json.JsonData.class));
    }
  }

  @Test
  void elasticsearchRecoversWhenRetryReturnsACompletePage() throws IOException {
    var client = mock(es.co.elastic.clients.elasticsearch.ElasticsearchClient.class);
    when(client.search(
            any(es.co.elastic.clients.elasticsearch.core.SearchRequest.class),
            eq(es.co.elastic.clients.json.JsonData.class)))
        .thenReturn(elasticsearchResponse(false, 1), elasticsearchResponse(false, 0));

    var manager = new ElasticSearchSearchManager(client, null, "", null);

    assertTrue(manager.searchForExport(request(), null).getResults().isEmpty());
    verify(client, times(2))
        .search(
            any(es.co.elastic.clients.elasticsearch.core.SearchRequest.class),
            eq(es.co.elastic.clients.json.JsonData.class));
  }

  @Test
  void opensearchRecoversWhenRetryReturnsACompletePage() throws IOException {
    var client = mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    when(client.search(
            any(os.org.opensearch.client.opensearch.core.SearchRequest.class),
            eq(os.org.opensearch.client.json.JsonData.class)))
        .thenReturn(opensearchResponse(true, 0), opensearchResponse(false, 0));

    var manager = new OpenSearchSearchManager(client, null, "", null);

    assertTrue(manager.searchForExport(request(), null).getResults().isEmpty());
    verify(client, times(2))
        .search(
            any(os.org.opensearch.client.opensearch.core.SearchRequest.class),
            eq(os.org.opensearch.client.json.JsonData.class));
  }

  private static es.co.elastic.clients.elasticsearch.core.SearchResponse<
          es.co.elastic.clients.json.JsonData>
      elasticsearchResponse(boolean timeout, int failed) {
    return es.co.elastic.clients.elasticsearch.core.SearchResponse.of(
        builder ->
            builder
                .took(1)
                .timedOut(timeout)
                .shards(shards -> shards.total(1).failed(failed).successful(1 - failed))
                .hits(hits -> hits.hits(List.of())));
  }

  private static os.org.opensearch.client.opensearch.core.SearchResponse<
          os.org.opensearch.client.json.JsonData>
      opensearchResponse(boolean timeout, int failed) {
    return new os.org.opensearch.client.opensearch.core.SearchResponse.Builder<
            os.org.opensearch.client.json.JsonData>()
        .took(1)
        .timedOut(timeout)
        .shards(shards -> shards.total(1).failed(failed).successful(1 - failed))
        .hits(hits -> hits.hits(List.of()))
        .build();
  }

  private static org.openmetadata.schema.search.SearchRequest request() {
    return new org.openmetadata.schema.search.SearchRequest()
        .withIndex("di-data-assets-*")
        .withQuery("*")
        .withIncludeAggregations(false)
        .withSortFieldParam("id.keyword");
  }
}
