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

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.IndexMappingVersionTracker;
import org.openmetadata.service.search.IndexMappingVersionTracker.MappingDriftState;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.capability.EntityIndexCapability;
import org.openmetadata.service.search.capability.EntityIndexCapabilityRegistry;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

/** The live search indexes as the reindex planner sees them when a run starts. */
@Slf4j
final class LiveSearchIndexState implements ReindexModePlanner.LiveIndexState {
  private static final String EMBEDDING_MODEL = "embedding_model";
  private static final String EMBEDDING_DIMENSION = "embedding_dimension";

  private final SearchRepository searchRepository;
  private final RawIndexOperations indexOperations;
  private final Map<String, MappingDriftState> drift;

  LiveSearchIndexState(
      final SearchRepository searchRepository,
      final RawIndexOperations indexOperations,
      final Map<String, MappingDriftState> drift) {
    this.searchRepository = searchRepository;
    this.indexOperations = indexOperations;
    this.drift = drift;
  }

  static LiveSearchIndexState capture(
      final CollectionDAO collectionDAO, final SearchRepository searchRepository) {
    return new LiveSearchIndexState(
        searchRepository,
        new RawIndexOperations(searchRepository.getSearchClient()),
        driftSinceLastBuild(collectionDAO));
  }

  private static Map<String, MappingDriftState> driftSinceLastBuild(
      final CollectionDAO collectionDAO) {
    Map<String, MappingDriftState> drift = Map.of();
    try {
      drift = IndexMappingVersionTracker.create(collectionDAO).computeDrift();
    } catch (IOException e) {
      LOG.warn("Could not compare index mappings with the last build; rebuilding every index", e);
    }
    return drift;
  }

  @Override
  public MappingDriftState drift(final String entityType) {
    return drift.getOrDefault(entityType, MappingDriftState.UNTRACKED);
  }

  @Override
  public boolean exists(final String entityType) {
    final IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    return indexMapping != null && searchRepository.indexExists(indexMapping);
  }

  /** A vector field built for another embedding model or dimension cannot take this run's. */
  @Override
  public boolean embeddingSettingsMatch(final String entityType) {
    return !storesEmbeddings(entityType) || isBuiltForCurrentEmbeddings(entityType);
  }

  /** Time-series types the reindex reads, and entity types backed by an entity table. */
  @Override
  public boolean hasReader(final String entityType) {
    final EntityIndexCapability capability = EntityIndexCapabilityRegistry.get(entityType);
    return SearchIndexEntityTypes.isTimeSeriesEntity(entityType)
        || (capability != null && !capability.isTimeSeries());
  }

  private boolean storesEmbeddings(final String entityType) {
    return searchRepository.isVectorEmbeddingEnabled()
        && searchRepository.getEmbeddingClient() != null
        && AvailableEntityTypes.isVectorIndexable(entityType);
  }

  private boolean isBuiltForCurrentEmbeddings(final String entityType) {
    final EmbeddingClient embeddingClient = searchRepository.getEmbeddingClient();
    final String liveIndex =
        searchRepository
            .getIndexMapping(entityType)
            .getIndexName(searchRepository.getClusterAlias());
    boolean matches = false;
    try {
      final JsonNode meta = indexOperations.mappingMeta(liveIndex);
      matches =
          embeddingClient.getModelId().equals(meta.path(EMBEDDING_MODEL).asText(null))
              && embeddingClient.getDimension() == meta.path(EMBEDDING_DIMENSION).asInt(-1);
    } catch (IOException e) {
      LOG.warn("Could not read the embedding settings of {}; rebuilding it", liveIndex, e);
    }
    return matches;
  }
}
