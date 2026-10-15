/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.capability.EntityIndexCapability;
import org.openmetadata.service.search.capability.EntityIndexCapabilityRegistry;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class LiveSearchIndexStateTest {
  private static final String MODEL = "model-a";
  private static final int DIMENSION = 768;

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final EmbeddingClient embeddingClient = mock(EmbeddingClient.class);

  @BeforeEach
  void embeddingsAreOn() {
    when(searchRepository.getIndexMapping(Entity.TABLE))
        .thenReturn(IndexMapping.builder().indexName("table_search_index").build());
    when(searchRepository.getClusterAlias()).thenReturn("");
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.getModelId()).thenReturn(MODEL);
    when(embeddingClient.getDimension()).thenReturn(DIMENSION);
  }

  @Test
  void anIndexBuiltForTheConfiguredEmbeddingsCanBeRewrittenInPlace() throws IOException {
    liveIndexMeta("{\"embedding_model\":\"" + MODEL + "\",\"embedding_dimension\":768}");

    assertTrue(state().embeddingSettingsMatch(Entity.TABLE));
  }

  @Test
  void anIndexBuiltForAnotherModelNeedsANewIndex() throws IOException {
    liveIndexMeta("{\"embedding_model\":\"model-b\",\"embedding_dimension\":768}");

    assertFalse(state().embeddingSettingsMatch(Entity.TABLE));
  }

  @Test
  void anIndexBuiltForAnotherDimensionNeedsANewIndex() throws IOException {
    liveIndexMeta("{\"embedding_model\":\"" + MODEL + "\",\"embedding_dimension\":384}");

    assertFalse(state().embeddingSettingsMatch(Entity.TABLE));
  }

  @Test
  void anIndexBuiltBeforeEmbeddingsWereOnNeedsANewIndex() throws IOException {
    liveIndexMeta("{}");

    assertFalse(state().embeddingSettingsMatch(Entity.TABLE));
  }

  @Test
  void withEmbeddingsOffTheVectorFieldDoesNotMatter() {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);

    assertTrue(state().embeddingSettingsMatch(Entity.TABLE));
  }

  @Test
  void onlyTypesTheReindexCanReadHaveAReader() {
    EntityIndexCapabilityRegistry.register(EntityIndexCapability.forEntity(Entity.DASHBOARD));
    EntityIndexCapabilityRegistry.register(
        EntityIndexCapability.forTimeSeries(Entity.MCP_EXECUTION));

    assertTrue(state().hasReader(Entity.DASHBOARD));
    assertTrue(state().hasReader(Entity.TEST_CASE_RESULT));
    assertFalse(state().hasReader(Entity.MCP_EXECUTION));
    assertFalse(state().hasReader("pipelineStatus"));
  }

  private void liveIndexMeta(final String meta) throws IOException {
    when(searchClient.rawSearchRequest(
            eq("GET"), startsWith("/table_search_index/_mapping"), any()))
        .thenReturn(
            new RawSearchResponse(
                200, "{\"table_search_index_rebuild_1\":{\"mappings\":{\"_meta\":" + meta + "}}}"));
  }

  private LiveSearchIndexState state() {
    return new LiveSearchIndexState(
        searchRepository, new RawIndexOperations(searchClient), Map.of());
  }
}
