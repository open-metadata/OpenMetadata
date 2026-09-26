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
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient.IndexStats;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Cleans up orphaned rebuild indices from failed or interrupted reindex operations. An index is
 * considered orphaned if:
 *
 * <ul>
 *   <li>It contains "_rebuild_" in its name (created during staged reindexing)
 *   <li>It has ZERO aliases pointing to it (not serving any traffic)
 * </ul>
 *
 * <p>This is safe because active indices always have at least one alias (the entity type alias like
 * "table", "user", etc.). Zero aliases = definitively not serving traffic.
 *
 * <p>It also detaches indexes left behind by an entity-type rename from the aliases this release
 * manages — see {@link #detachOrphanedIndexesFromAliases(SearchRepository)}.
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

  /**
   * Every entity index registered in {@code indexMapping.json} is named {@code *_search_index}.
   * Requiring the suffix turns the sweep into an allow-rule rather than a deny-rule: an index it has
   * never heard of is left alone instead of being assumed disposable.
   *
   * <p>That is what keeps it off the indexes a release manages outside {@code entityIndexMap} — the
   * vector chunk index {@code data_asset_embeddings_chunks} and its generations, which carry the
   * {@code dataAssetEmbeddings} alias so the vector read path sees chunk docs, and the Data Insights
   * datastreams. Detaching either would silently empty semantic search.
   *
   * <p>The rule can only ever under-detach. The five {@code *_report_data_index} mappings lack the
   * suffix, so an orphan of one would be missed — they have been registered in every release shipped
   * so far, and a missed orphan is the status quo this repairs, whereas detaching a live index is a
   * new outage.
   */
  private static final String ENTITY_INDEX_SUFFIX = "_search_index";

  /**
   * Detach every index that no longer backs a registered entity type from the aliases this release
   * manages, and report how many alias links were removed.
   *
   * <p>An index whose entity type was renamed or dropped between releases is never revisited:
   * {@code createIndexes()}, {@code updateIndexes()} and {@code deleteIndex()} all walk
   * {@code entityIndexMap}, so none of them can even see an index that has left it. The orphan keeps
   * the parent alias its own release attached, so {@code index=all} still expands onto it and queries
   * it with clauses written against this release's mappings. 1.12's {@code aiAgent} index — renamed
   * to {@code aiApplication} since — maps {@code owners} as a plain object, so the nested
   * {@code owners} filter {@code RBACConditionEvaluator} adds for every non-admin user throws
   * {@code query_shard_exception} on that shard. The engine still answers 200 from the surviving
   * shards, and {@code SearchShardFailures} then refuses the zero-hit ones, turning an ordinary "no
   * results" search into a 500.
   *
   * <p>Detaching rather than deleting: the alias is the only thing that makes an orphan reachable,
   * so removing it is the entire fix, and the documents stay put for an operator to inspect or
   * reindex before dropping the index.
   *
   * <p>Runs as a SearchIndexApp preflight rather than from {@code SearchRepository}, so no server
   * pays a cluster-wide alias walk on startup. An upgrade reindexes, which is what reaches this.
   */
  public int detachOrphanedIndexesFromAliases(SearchRepository repository) {
    SearchClient client = repository.getSearchClient();
    int detached = 0;
    for (String alias : managedAliases(repository)) {
      for (String indexName : client.getIndicesByAlias(alias)) {
        detached += detachIfOrphaned(repository, indexName, alias);
      }
    }
    LOG.info("Detached {} orphaned index-to-alias links", detached);
    return detached;
  }

  private int detachIfOrphaned(SearchRepository repository, String indexName, String alias) {
    if (!isOrphanedIndex(repository, indexName)) {
      return 0;
    }
    SearchClient client = repository.getSearchClient();
    try {
      client.removeAliases(indexName, Set.of(alias));
    } catch (Exception ex) {
      LOG.warn("Failed to detach orphaned index '{}' from alias '{}'", indexName, alias, ex);
      return 0;
    }
    // Both index managers log and swallow an unavailable client, a rejected request and an
    // unacknowledged response, so returning normally does not mean the alias is gone. Re-read it:
    // a count that cannot be trusted is worse than no count.
    if (client.getIndicesByAlias(alias).contains(indexName)) {
      LOG.warn(
          "Detach of orphaned index '{}' from alias '{}' did not take effect", indexName, alias);
      return 0;
    }
    LOG.info(
        "Detached orphaned index '{}' from alias '{}': no registered entity type maps to it",
        indexName,
        alias);
    return 1;
  }

  private boolean isOrphanedIndex(SearchRepository repository, String indexName) {
    // The _rebuild_ term is redundant today — DefaultRecreateHandler stages as
    // <canonical>_rebuild_<millis>, which the suffix rule already excludes — but a staged index
    // holds the aliases it is about to be promoted into, so it stays as an interlock against a
    // future change to that naming.
    return indexName.endsWith(ENTITY_INDEX_SUFFIX)
        && !indexName.contains(REBUILD_PATTERN)
        && !isKnownCanonicalIndex(repository, indexName);
  }

  private boolean isKnownCanonicalIndex(SearchRepository repository, String indexName) {
    for (IndexMapping mapping : repository.getEntityIndexMap().values()) {
      if (mapping != null && indexName.equals(mapping.getIndexName(repository.getClusterAlias()))) {
        return true;
      }
    }
    return false;
  }

  /**
   * The aliases this release attaches to its own indexes, and so the only ones it may detach an
   * index from. Data Insights aliases are deliberately left out: they front datastream indexes that
   * never appear in {@code entityIndexMap}, so every one of them would read as an orphan here.
   */
  private Set<String> managedAliases(SearchRepository repository) {
    String clusterAlias = repository.getClusterAlias();
    Set<String> aliases = new HashSet<>();
    for (IndexMapping mapping : repository.getEntityIndexMap().values()) {
      // The cluster-prefixing getters dereference the raw lists, which a mapping is free to leave
      // unset.
      if (mapping.getAlias() != null) {
        aliases.add(mapping.getAlias(clusterAlias));
      }
      if (mapping.getParentAliases() != null) {
        aliases.addAll(mapping.getParentAliases(clusterAlias));
      }
    }
    return aliases;
  }

  public int countRebuildIndices(SearchClient client) {
    return findAllRebuildIndices(client).size();
  }

  int countRebuildIndices(List<IndexStats> indexStats) {
    return (int)
        indexStats.stream().filter(stats -> stats.name().contains(REBUILD_PATTERN)).count();
  }

  int countOrphanedIndices(List<IndexStats> indexStats) {
    long now = System.currentTimeMillis();
    return (int)
        indexStats.stream()
            .filter(stats -> stats.name().contains(REBUILD_PATTERN))
            .filter(stats -> isOldEnough(stats.name(), now))
            .filter(stats -> stats.aliases() == null || stats.aliases().isEmpty())
            .count();
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
