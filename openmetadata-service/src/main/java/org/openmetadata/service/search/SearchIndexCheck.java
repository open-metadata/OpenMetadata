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
package org.openmetadata.service.search;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

/**
 * Finds the entity types whose serving index is missing, as after the search cluster comes back
 * empty, or exists without its aliases, as when a live write created it in the meantime, and
 * rebuilds them. Index templates come first, so writes in the gap get the right mapping; then a
 * forced reindex of just those types, which fills them and replaces an index a write created; then
 * the missing indexes, so new writes are searchable while it runs. While another reindex runs,
 * nothing is changed and the next check tries again.
 */
@Slf4j
public class SearchIndexCheck {
  /** An index must look unusable this long before it is rebuilt; a promotion can pass for one. */
  static final Duration CONFIRMATION_DELAY = Duration.ofMinutes(1);

  /** Keeps each alias read's URL short however many entity types there are. */
  static final int INDEXES_PER_REQUEST = 20;

  private final SearchRepository searchRepository;
  private final BooleanSupplier reindexRunning;
  private final Consumer<Set<String>> forcedReindex;
  private final Duration confirmationDelay;

  public SearchIndexCheck(
      final SearchRepository searchRepository,
      final BooleanSupplier reindexRunning,
      final Consumer<Set<String>> forcedReindex) {
    this(searchRepository, reindexRunning, forcedReindex, CONFIRMATION_DELAY);
  }

  SearchIndexCheck(
      final SearchRepository searchRepository,
      final BooleanSupplier reindexRunning,
      final Consumer<Set<String>> forcedReindex,
      final Duration confirmationDelay) {
    this.searchRepository = searchRepository;
    this.reindexRunning = reindexRunning;
    this.forcedReindex = forcedReindex;
    this.confirmationDelay = confirmationDelay;
  }

  /** Rebuilds the indexes that are missing or were not created by OpenMetadata. */
  public void repairUnusableIndexes() throws IOException, InterruptedException {
    final Set<String> unusable = confirmedUnusableTypes();
    if (unusable.isEmpty()) {
      return;
    }
    if (reindexRunning.getAsBoolean()) {
      LOG.info("Search indexes of {} need a rebuild; waiting for the running reindex", unusable);
      return;
    }
    LOG.warn("Search indexes of {} are missing or lack their aliases; rebuilding them", unusable);
    searchRepository.createOrUpdateIndexTemplates();
    forcedReindex.accept(withTablesForColumns(unusable));
    searchRepository.createMissingIndexes();
  }

  /** Types unusable now and still unusable after {@link #confirmationDelay}. */
  private Set<String> confirmedUnusableTypes() throws IOException, InterruptedException {
    final Set<String> unusable = unusableTypes();
    if (!unusable.isEmpty()) {
      TimeUnit.MILLISECONDS.sleep(confirmationDelay.toMillis());
      unusable.retainAll(unusableTypes());
    }
    return unusable;
  }

  /** The managed types whose serving index is missing or does not carry the type's alias. */
  public Set<String> unusableTypes() throws IOException {
    final String clusterAlias = searchRepository.getClusterAlias();
    final Map<String, IndexMapping> mappings = new TreeMap<>();
    searchRepository
        .getIndexedEntityTypes()
        .forEach(
            entityType -> mappings.put(entityType, searchRepository.getIndexMapping(entityType)));
    final Map<String, Set<String>> aliasesByIndex =
        aliasesByIndex(
            mappings.values().stream()
                .map(mapping -> mapping.getIndexName(clusterAlias))
                .distinct()
                .toList());
    return mappings.entrySet().stream()
        .filter(type -> !isUsable(type.getValue(), clusterAlias, aliasesByIndex))
        .map(Map.Entry::getKey)
        .collect(Collectors.toCollection(TreeSet::new));
  }

  private static boolean isUsable(
      final IndexMapping mapping,
      final String clusterAlias,
      final Map<String, Set<String>> aliasesByIndex) {
    final String servingIndex = mapping.getIndexName(clusterAlias);
    final String alias = mapping.getAlias(clusterAlias);
    return aliasesByIndex.entrySet().stream()
        .anyMatch(
            index ->
                (index.getKey().equals(servingIndex) || index.getValue().contains(servingIndex))
                    && index.getValue().contains(alias));
  }

  /** The aliases of those of {@code indexes} that exist, read a few indexes per request. */
  private Map<String, Set<String>> aliasesByIndex(final List<String> indexes) throws IOException {
    final Map<String, Set<String>> aliasesByIndex = new HashMap<>();
    for (int start = 0; start < indexes.size(); start += INDEXES_PER_REQUEST) {
      aliasesByIndex.putAll(
          readAliases(
              indexes.subList(start, Math.min(start + INDEXES_PER_REQUEST, indexes.size()))));
    }
    return aliasesByIndex;
  }

  /**
   * One alias read that names its indexes; those that do not exist are left out of the answer. A
   * read that names no index would resolve against every index in the cluster, which a search
   * role limited to OpenMetadata's indexes may not do.
   */
  private Map<String, Set<String>> readAliases(final List<String> indexes) throws IOException {
    final RawSearchResponse response =
        searchRepository
            .getSearchClient()
            .rawSearchRequest(
                "GET", "/" + String.join(",", indexes) + "/_alias?ignore_unavailable=true", null);
    if (response.statusCode() >= 300) {
      throw new IOException("Reading the aliases of " + indexes + " failed: " + response.body());
    }
    final Map<String, Set<String>> aliasesByIndex = new HashMap<>();
    JsonUtils.readTree(response.body())
        .properties()
        .forEach(
            index -> {
              final Set<String> aliases = new HashSet<>();
              index.getValue().path("aliases").fieldNames().forEachRemaining(aliases::add);
              aliasesByIndex.put(index.getKey(), aliases);
            });
    return aliasesByIndex;
  }

  /** Column documents are rebuilt with their tables, so a column index needs its tables read. */
  static Set<String> withTablesForColumns(final Set<String> entityTypes) {
    final Set<String> types = new TreeSet<>(entityTypes);
    if (types.contains(Entity.TABLE_COLUMN)) {
      types.add(Entity.TABLE);
    }
    return types;
  }
}
