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

import static java.util.stream.Collectors.toCollection;

import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.Mode;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;

/**
 * The indexes one reindex run writes: which it rewrites in place and which it rebuilds into a new
 * index, the targets it prepares for them, and the cleanup of the in-place ones once written.
 */
@Slf4j
final class ReindexTargets {
  private final SearchRepository searchRepository;
  private final Set<String> requestedTypes;
  private final Map<String, Mode> modes;

  ReindexTargets(
      final SearchRepository searchRepository,
      final Set<String> requestedTypes,
      final Map<String, Mode> modes) {
    this.searchRepository = searchRepository;
    this.requestedTypes = requestedTypes;
    this.modes = modes;
  }

  static ReindexTargets plan(
      final CollectionDAO collectionDAO,
      final SearchRepository searchRepository,
      final Set<String> requestedTypes,
      final boolean forceRecreate) {
    final Map<String, Mode> modes =
        ReindexModePlanner.plan(
            withColumnIndex(requestedTypes),
            LiveSearchIndexState.capture(collectionDAO, searchRepository),
            forceRecreate);
    LOG.info("Reindex modes: {}", modes);
    return new ReindexTargets(searchRepository, requestedTypes, modes);
  }

  /** Columns are built while tables are read, so rebuilding tables rebuilds the column index. */
  private static Set<String> withColumnIndex(final Set<String> requestedTypes) {
    final Set<String> types = new LinkedHashSet<>(requestedTypes);
    if (types.contains(Entity.TABLE)) {
      types.add(Entity.TABLE_COLUMN);
    }
    return types;
  }

  /** The requested types the run reads from the database. */
  Set<String> typesToRead() {
    return requestedTypes.stream()
        .filter(entityType -> modes.get(entityType) != Mode.SKIP)
        .collect(toCollection(LinkedHashSet::new));
  }

  /** Creates the new indexes, adds the live ones rewritten in place, and returns both. */
  ReindexContext prepare(final RecreateIndexHandler recreateHandler) {
    final ReindexContext context = recreateHandler.reCreateIndexes(typesIn(Mode.NEW_INDEX));
    if (context == null) {
      throw new IllegalStateException("Index preparation returned no reindex context");
    }
    for (final String entityType : typesIn(Mode.IN_PLACE)) {
      context.addInPlace(entityType, liveIndexName(entityType));
    }
    if (context.isEmpty()) {
      throw new IllegalStateException("Reindex preparation did not produce any target indexes");
    }
    return context;
  }

  /**
   * Removes the documents of deleted rows from every index rewritten in place and applies the
   * configured live settings to it. Returns false when any index could not be finished.
   */
  boolean finishInPlace(
      final RecreateIndexHandler recreateHandler,
      final ReindexContext context,
      final long runStart) {
    final InPlaceIndexSweep sweep =
        new InPlaceIndexSweep(
            new RawIndexOperations(searchRepository.getSearchClient()),
            InPlaceIndexSweep::databaseRows,
            searchRepository.getVectorIndexService());
    boolean finished = true;
    for (final String entityType : context.getInPlaceEntities()) {
      final String liveIndex = context.getInPlaceIndex(entityType).orElseThrow();
      finished &= finishInPlace(sweep, recreateHandler, entityType, liveIndex, runStart);
    }
    return finished;
  }

  private static boolean finishInPlace(
      final InPlaceIndexSweep sweep,
      final RecreateIndexHandler recreateHandler,
      final String entityType,
      final String liveIndex,
      final long runStart) {
    boolean finished = false;
    try {
      final long removed = sweep.removeOrphans(entityType, liveIndex, runStart);
      LOG.info("Finished {} in place: removed {} orphaned documents", liveIndex, removed);
      if (recreateHandler instanceof DefaultRecreateHandler defaultHandler) {
        defaultHandler.applyConfiguredLiveSettings(liveIndex, entityType);
      }
      finished = true;
    } catch (IOException | RuntimeException e) {
      LOG.error("Could not finish {} after rewriting it in place", liveIndex, e);
    }
    return finished;
  }

  private Set<String> typesIn(final Mode mode) {
    return modes.entrySet().stream()
        .filter(entry -> entry.getValue() == mode)
        .map(Map.Entry::getKey)
        .collect(toCollection(LinkedHashSet::new));
  }

  private String liveIndexName(final String entityType) {
    return searchRepository
        .getIndexMapping(entityType)
        .getIndexName(searchRepository.getClusterAlias());
  }
}
