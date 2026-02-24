/*
 *  Copyright 2024 Collate
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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchClient;

/**
 * Cleans up orphaned rebuild indices from failed or interrupted reindex operations. An index is
 * considered orphaned if:
 *
 * <ul>
 *   <li>It contains "_rebuild_" in its name (created during recreateIndex=true)
 *   <li>It has ZERO aliases pointing to it (not serving any traffic)
 * </ul>
 *
 * <p>This is safe because active indices always have at least one alias (the entity type alias like
 * "table", "user", etc.). Zero aliases = definitively not serving traffic.
 */
@Slf4j
public class OrphanedIndexCleaner {

  private static final String REBUILD_PATTERN = "_rebuild_";
  private static final long MIN_AGE_MS = 30 * 60 * 1000L; // 30 minutes

  public record OrphanedIndex(String indexName, Set<String> aliases) {
    public boolean isOrphaned() {
      return aliases == null || aliases.isEmpty();
    }
  }

  public record CleanupResult(int found, int deleted, int failed, List<String> deletedIndices) {}

  public List<OrphanedIndex> findOrphanedRebuildIndices(SearchClient client) {
    List<OrphanedIndex> orphaned = new ArrayList<>();

    try {
      Set<String> allRebuildIndices = findAllRebuildIndices(client);

      LOG.info("Found {} rebuild indices to check for orphans", allRebuildIndices.size());

      long now = System.currentTimeMillis();

      for (String indexName : allRebuildIndices) {
        try {
          if (!isOldEnough(indexName, now)) {
            LOG.debug("Index {} is too recent, skipping", indexName);
            continue;
          }

          Set<String> aliases = client.getAliases(indexName);
          if (aliases == null || aliases.isEmpty()) {
            orphaned.add(new OrphanedIndex(indexName, aliases));
            LOG.debug("Found orphaned index: {} (no aliases)", indexName);
          } else {
            LOG.debug("Index {} has aliases {}, not orphaned", indexName, aliases);
          }
        } catch (Exception e) {
          LOG.warn("Failed to get aliases for index {}: {}", indexName, e.getMessage());
        }
      }

      LOG.info(
          "Found {} orphaned rebuild indices out of {} total rebuild indices",
          orphaned.size(),
          allRebuildIndices.size());

    } catch (Exception e) {
      LOG.error("Failed to find orphaned rebuild indices: {}", e.getMessage(), e);
    }

    return orphaned;
  }

  public CleanupResult cleanupOrphanedIndices(SearchClient client) {
    List<OrphanedIndex> orphaned = findOrphanedRebuildIndices(client);
    List<String> deletedIndices = new ArrayList<>();
    int failed = 0;

    for (OrphanedIndex index : orphaned) {
      try {
        LOG.info("Deleting orphaned index: {}", index.indexName());
        client.deleteIndex(index.indexName());
        deletedIndices.add(index.indexName());
        LOG.info("Successfully deleted orphaned index: {}", index.indexName());
      } catch (Exception e) {
        LOG.error("Failed to delete orphaned index {}: {}", index.indexName(), e.getMessage());
        failed++;
      }
    }

    CleanupResult result =
        new CleanupResult(orphaned.size(), deletedIndices.size(), failed, deletedIndices);

    if (!deletedIndices.isEmpty()) {
      LOG.info(
          "Orphan cleanup complete: found={}, deleted={}, failed={}",
          result.found(),
          result.deleted(),
          result.failed());
    }

    return result;
  }

  public int countOrphanedIndices(SearchClient client) {
    return findOrphanedRebuildIndices(client).size();
  }

  public int countRebuildIndices(SearchClient client) {
    return findAllRebuildIndices(client).size();
  }

  private Set<String> findAllRebuildIndices(SearchClient client) {
    Set<String> rebuildIndices = new HashSet<>();

    try {
      Set<String> allIndices = client.listIndicesByPrefix("");

      for (String indexName : allIndices) {
        if (indexName.contains(REBUILD_PATTERN)) {
          rebuildIndices.add(indexName);
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to list indices: {}", e.getMessage(), e);
    }

    return rebuildIndices;
  }

  private boolean isOldEnough(String indexName, long now) {
    int lastUnderscore = indexName.lastIndexOf('_');
    if (lastUnderscore < 0) {
      return true;
    }
    try {
      long timestamp = Long.parseLong(indexName.substring(lastUnderscore + 1));
      return (now - timestamp) > MIN_AGE_MS;
    } catch (NumberFormatException e) {
      return true;
    }
  }

  private boolean isOrphaned(SearchClient client, String indexName) {
    if (!indexName.contains(REBUILD_PATTERN)) {
      return false;
    }

    try {
      Set<String> aliases = client.getAliases(indexName);
      return aliases == null || aliases.isEmpty();
    } catch (Exception e) {
      LOG.warn("Failed to check if index {} is orphaned: {}", indexName, e.getMessage());
      return false;
    }
  }
}
