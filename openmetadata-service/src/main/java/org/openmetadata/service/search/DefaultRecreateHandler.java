package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.BulkIndexOverrides;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;

/**
 * Default implementation of RecreateHandler that provides zero-downtime index recreation.
 *
 * <p>Two-phase index settings:
 *
 * <ul>
 *   <li>On staged-index creation: bulk overrides (refresh=-1, replicas=0, translog=async) are
 *       applied so the bulk reindex writes as fast as possible. Nothing reads from the staged
 *       index, so disabling refresh and replicas is safe.
 *   <li>Before alias swap (in {@link #finalizeReindex}): live settings (refresh=1s, replicas=1,
 *       translog=request) are applied so search results stay near-real-time after promotion.
 *       Optionally force-merge to one segment.
 * </ul>
 *
 * <p>Settings come from the {@link EventPublisherJob} configured by the admin via the
 * SearchIndexing application. Callers must invoke {@link #withJobData(EventPublisherJob)} before
 * {@code reCreateIndexes} / {@code finalizeReindex} for settings to take effect; otherwise the
 * handler uses sensible built-in defaults.
 */
@Slf4j
public class DefaultRecreateHandler implements RecreateIndexHandler {

  private static final String REPLICAS = "number_of_replicas";
  private static final String REFRESH_INTERVAL = "refresh_interval";
  private static final String TRANSLOG = "translog";
  private static final String DURABILITY = "durability";
  private static final String SYNC_INTERVAL = "sync_interval";

  private EventPublisherJob jobData;

  public DefaultRecreateHandler withJobData(EventPublisherJob jobData) {
    this.jobData = jobData;
    return this;
  }

  @Override
  public ReindexContext reCreateIndexes(Set<String> entities) {
    ReindexContext context = new ReindexContext();
    SearchRepository searchRepository = Entity.getSearchRepository();

    if (nullOrEmpty(entities)) {
      return context;
    }

    for (String entityType : entities) {
      IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
      if (indexMapping == null) {
        LOG.warn(
            "No index mapping found for entityType '{}'. Skipping index recreation.", entityType);
        continue;
      }

      recreateIndexFromMapping(context, indexMapping, entityType);
    }

    // When recreating the table index, also recreate the column index since columns
    // are indexed as part of table processing (columns are not standalone entities)
    if (entities.contains(Entity.TABLE)) {
      IndexMapping columnIndexMapping = searchRepository.getIndexMapping(Entity.TABLE_COLUMN);
      if (columnIndexMapping != null && !entities.contains(Entity.TABLE_COLUMN)) {
        recreateIndexFromMapping(context, columnIndexMapping, Entity.TABLE_COLUMN);
      }
    }

    return context;
  }

  @Override
  public void finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    String entityType = context.getEntityType();
    String canonicalIndex = context.getCanonicalIndex();
    String activeIndex = context.getActiveIndex();
    String stagedIndex = context.getStagedIndex();
    Set<String> existingAliases = context.getExistingAliases();
    String canonicalAlias = context.getCanonicalAliases();
    Set<String> parentAliases = context.getParentAliases();

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient searchClient = searchRepository.getSearchClient();

    if (canonicalIndex == null || stagedIndex == null) {
      LOG.error(
          "Cannot finalize reindex for entity '{}'. canonicalIndex={}, stagedIndex={}",
          entityType,
          canonicalIndex,
          stagedIndex);
      return;
    }

    // Always-promote: partial data is better than no data. When reindex failed but the staged
    // index has documents, promote it. Only delete if truly empty.
    boolean shouldPromote = reindexSuccess;
    if (!shouldPromote) {
      long docCount = searchClient.getDocumentCount(stagedIndex);
      if (docCount > 0) {
        LOG.info(
            "Reindex failed for entity '{}' but staged index '{}' has {} documents. "
                + "Promoting partial data (partial data > no data).",
            entityType,
            stagedIndex,
            docCount);
        shouldPromote = true;
      } else if (docCount == 0) {
        LOG.info(
            "Reindex failed for entity '{}' and staged index '{}' has 0 documents. "
                + "Deleting empty staged index.",
            entityType,
            stagedIndex);
      } else {
        LOG.warn(
            "Could not determine doc count for staged index '{}' (entity '{}'). "
                + "Promoting to avoid data loss.",
            stagedIndex,
            entityType);
        shouldPromote = true;
      }
    }

    if (shouldPromote) {
      // Restore live serving settings on the staged index before alias swap. The bulk-build
      // overrides (refresh=-1, replicas=0, async translog) must NOT be the new live settings.
      applyLiveServingSettings(searchClient, stagedIndex, entityType);
      maybeForceMerge(searchClient, stagedIndex, entityType);

      // Always clear staged-index routing on the way out, regardless of outcome:
      //   - swap success      → alias now points at staged; canonical and staged resolve to the
      //                         same index, so unregistering keeps reads/writes consistent.
      //   - swap failure / empty aliases / exception → leaving routing active would silently
      //                         send live writes to a staged index nothing reads from, which
      //                         is strictly worse than the writes going back to the canonical
      //                         alias target. Operators need to retry the reindex either way.
      try {
        Set<String> aliasesToAttach = new HashSet<>();

        existingAliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .forEach(aliasesToAttach::add);

        if (!nullOrEmpty(canonicalAlias)) {
          aliasesToAttach.add(canonicalAlias);
        }

        parentAliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .forEach(aliasesToAttach::add);

        aliasesToAttach.removeIf(alias -> alias == null || alias.isBlank());

        Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
        Set<String> oldIndicesToDelete = new HashSet<>();
        for (String oldIndex : allEntityIndices) {
          if (!oldIndex.equals(stagedIndex)) {
            oldIndicesToDelete.add(oldIndex);
          }
        }

        LOG.debug(
            "finalizeReindex entity '{}': aliases={}, oldIndices={}, stagedIndex={}",
            entityType,
            aliasesToAttach,
            oldIndicesToDelete,
            stagedIndex);

        if (oldIndicesToDelete.contains(canonicalIndex)) {
          if (searchClient.indexExists(canonicalIndex)) {
            searchClient.deleteIndexWithBackoff(canonicalIndex);
            oldIndicesToDelete.remove(canonicalIndex);
            LOG.info("Cleaned up old index '{}' for entity '{}'.", canonicalIndex, entityType);
          }
        }

        if (!aliasesToAttach.isEmpty()) {
          boolean swapSuccess =
              searchClient.swapAliases(oldIndicesToDelete, stagedIndex, aliasesToAttach);
          if (!swapSuccess) {
            LOG.error(
                "Failed to atomically swap aliases for entity '{}'. Old indices will not be deleted.",
                entityType);
            return;
          }
        } else {
          LOG.warn("Entity '{}': aliasesToAttach is empty, skipping alias swap", entityType);
        }

        LOG.info(
            "Promoted staged index '{}' to serve entity '{}' (aliases: {}, reindexSuccess: {}).",
            stagedIndex,
            entityType,
            aliasesToAttach,
            reindexSuccess);

        ReindexingMetrics metrics = ReindexingMetrics.getInstance();
        if (metrics != null) {
          metrics.recordPromotionSuccess(entityType);
        }

        for (String oldIndex : oldIndicesToDelete) {
          try {
            if (searchClient.indexExists(oldIndex)) {
              searchClient.deleteIndexWithBackoff(oldIndex);
              LOG.info("Cleaned up old index '{}' for entity '{}'.", oldIndex, entityType);
            }
          } catch (Exception deleteEx) {
            LOG.warn(
                "Failed to delete old index '{}' for entity '{}'.", oldIndex, entityType, deleteEx);
          }
        }
      } catch (Exception ex) {
        LOG.error(
            "Failed to promote staged index '{}' for entity '{}'.", stagedIndex, entityType, ex);
        ReindexingMetrics metrics = ReindexingMetrics.getInstance();
        if (metrics != null) {
          metrics.recordPromotionFailure(entityType);
        }
      } finally {
        searchRepository.unregisterStagedIndex(entityType, stagedIndex);
      }
    } else {
      try {
        if (searchClient.indexExists(stagedIndex)) {
          searchClient.deleteIndexWithBackoff(stagedIndex);
          LOG.info(
              "Deleted staged index '{}' after unsuccessful reindex for entity '{}'.",
              stagedIndex,
              entityType);
        }
      } catch (Exception ex) {
        LOG.warn(
            "Failed to delete staged index '{}' for entity '{}' after failure.",
            stagedIndex,
            entityType,
            ex);
      } finally {
        searchRepository.unregisterStagedIndex(entityType, stagedIndex);
      }
    }
  }

  /**
   * Promotes a single entity's staged index immediately after reindexing completes.
   * Uses aliases from indexMapping.json instead of reading from old index.
   */
  public void promoteEntityIndex(EntityReindexContext context, boolean reindexSuccess) {
    String entityType = context.getEntityType();
    String stagedIndex = context.getStagedIndex();
    String canonicalIndex = context.getCanonicalIndex();

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient searchClient = searchRepository.getSearchClient();
    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);

    if (canonicalIndex == null || stagedIndex == null) {
      LOG.error(
          "Cannot promote index for entity '{}'. canonicalIndex={}, stagedIndex={}",
          entityType,
          canonicalIndex,
          stagedIndex);
      return;
    }

    // Always-promote: check doc count when reindex failed
    boolean shouldPromote = reindexSuccess;
    if (!shouldPromote) {
      long docCount = searchClient.getDocumentCount(stagedIndex);
      if (docCount > 0) {
        LOG.info(
            "Per-entity reindex failed for '{}' but staged index '{}' has {} documents. Promoting.",
            entityType,
            stagedIndex,
            docCount);
        shouldPromote = true;
      } else if (docCount == 0) {
        LOG.info(
            "Per-entity reindex failed for '{}' and staged index '{}' is empty. Deleting.",
            entityType,
            stagedIndex);
      } else {
        LOG.warn(
            "Could not determine doc count for staged index '{}' (entity '{}'). Promoting.",
            stagedIndex,
            entityType);
        shouldPromote = true;
      }
    }

    if (!shouldPromote) {
      try {
        if (searchClient.indexExists(stagedIndex)) {
          searchClient.deleteIndexWithBackoff(stagedIndex);
          LOG.info(
              "Deleted staged index '{}' after unsuccessful reindex for entity '{}'.",
              stagedIndex,
              entityType);
        }
      } catch (Exception ex) {
        LOG.warn(
            "Failed to delete staged index '{}' for entity '{}' after failure.",
            stagedIndex,
            entityType,
            ex);
      } finally {
        searchRepository.unregisterStagedIndex(entityType, stagedIndex);
      }
      return;
    }

    // Always clear staged-index routing on the way out — see the rationale in finalizeReindex.
    try {
      Set<String> aliasesToAttach =
          getAliasesFromMapping(indexMapping, searchRepository.getClusterAlias());

      Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
      Set<String> oldIndicesToDelete = new HashSet<>();
      for (String oldIndex : allEntityIndices) {
        if (!oldIndex.equals(stagedIndex)) {
          oldIndicesToDelete.add(oldIndex);
        }
      }

      LOG.debug(
          "promoteEntityIndex '{}': aliases={}, oldIndices={}, stagedIndex={}",
          entityType,
          aliasesToAttach,
          oldIndicesToDelete,
          stagedIndex);

      if (oldIndicesToDelete.contains(canonicalIndex)) {
        if (searchClient.indexExists(canonicalIndex)) {
          searchClient.deleteIndexWithBackoff(canonicalIndex);
          oldIndicesToDelete.remove(canonicalIndex);
          LOG.info("Cleaned up old index '{}' for entity '{}'.", canonicalIndex, entityType);
        }
      }

      if (!aliasesToAttach.isEmpty()) {
        boolean swapSuccess =
            searchClient.swapAliases(oldIndicesToDelete, stagedIndex, aliasesToAttach);
        if (!swapSuccess) {
          LOG.error(
              "Failed to atomically swap aliases for entity '{}'. "
                  + "oldIndices={}, stagedIndex={}, aliases={}",
              entityType,
              oldIndicesToDelete,
              stagedIndex,
              aliasesToAttach);
          return;
        }
      } else {
        LOG.warn("Entity '{}': aliasesToAttach is empty, skipping alias swap", entityType);
      }

      LOG.info(
          "Promoted staged index '{}' to serve entity '{}' (aliases: {}, reindexSuccess: {}).",
          stagedIndex,
          entityType,
          aliasesToAttach,
          reindexSuccess);

      ReindexingMetrics promoteMetrics = ReindexingMetrics.getInstance();
      if (promoteMetrics != null) {
        promoteMetrics.recordPromotionSuccess(entityType);
      }

      for (String oldIndex : oldIndicesToDelete) {
        try {
          if (searchClient.indexExists(oldIndex)) {
            searchClient.deleteIndexWithBackoff(oldIndex);
            LOG.info("Cleaned up old index '{}' for entity '{}'.", oldIndex, entityType);
          }
        } catch (Exception deleteEx) {
          LOG.warn(
              "Failed to delete old index '{}' for entity '{}'.", oldIndex, entityType, deleteEx);
        }
      }
    } catch (Exception ex) {
      LOG.error(
          "Failed to promote staged index '{}' for entity '{}'.", stagedIndex, entityType, ex);
      ReindexingMetrics promoteMetrics = ReindexingMetrics.getInstance();
      if (promoteMetrics != null) {
        promoteMetrics.recordPromotionFailure(entityType);
      }
    } finally {
      searchRepository.unregisterStagedIndex(entityType, stagedIndex);
    }
  }

  /**
   * Gets aliases from indexMapping.json configuration.
   */
  private Set<String> getAliasesFromMapping(IndexMapping indexMapping, String clusterAlias) {
    Set<String> aliases = new HashSet<>();

    if (indexMapping == null) {
      return aliases;
    }

    // Add parent aliases (e.g., "all", "dataAsset")
    if (indexMapping.getParentAliases(clusterAlias) != null) {
      indexMapping.getParentAliases(clusterAlias).stream()
          .filter(alias -> alias != null && !alias.isBlank())
          .forEach(aliases::add);
    }

    // Add short alias (e.g., "table")
    String shortAlias = indexMapping.getAlias(clusterAlias);
    if (!nullOrEmpty(shortAlias)) {
      aliases.add(shortAlias);
    }

    // Add canonical index name as alias (e.g., "table_search_index")
    String indexName = indexMapping.getIndexName(clusterAlias);
    if (!nullOrEmpty(indexName)) {
      aliases.add(indexName);
    }

    return aliases;
  }

  protected void recreateIndexFromMapping(
      ReindexContext context, IndexMapping indexMapping, String entityType) {
    if (indexMapping == null) {
      LOG.warn("IndexMapping is null for entityType '{}'. Cannot recreate index.", entityType);
      return;
    }

    if (context == null) {
      LOG.warn("ReindexContext is null for entityType '{}'. Cannot recreate index.", entityType);
      return;
    }

    SearchRepository searchRepository = Entity.getSearchRepository();
    String clusterAlias = searchRepository.getClusterAlias();
    SearchClient searchClient = searchRepository.getSearchClient();

    String canonicalIndexName = indexMapping.getIndexName(clusterAlias);
    String activeIndexName = canonicalIndexName;

    if (!searchClient.indexExists(canonicalIndexName)) {
      Set<String> aliasTargets =
          searchClient.getIndicesByAlias(indexMapping.getAlias(clusterAlias));
      if (!aliasTargets.isEmpty()) {
        activeIndexName = aliasTargets.iterator().next();
        LOG.debug(
            "Resolved active index '{}' for entity '{}' via alias '{}'.",
            activeIndexName,
            entityType,
            indexMapping.getAlias(clusterAlias));
      } else {
        LOG.debug(
            "No existing index or alias found for entity '{}'. Rebuilding from scratch.",
            entityType);
        activeIndexName = null;
      }
    }

    String mappingContent = searchRepository.readIndexMapping(indexMapping);
    if (mappingContent == null) {
      LOG.warn(
          "Unable to read index mapping content for '{}'. Cannot recreate index.",
          canonicalIndexName);
      return;
    }

    String stagedIndexName = buildStagedIndexName(canonicalIndexName);
    searchClient.createIndex(stagedIndexName, mappingContent);
    applyBulkBuildSettings(searchClient, stagedIndexName, entityType);
    searchRepository.registerStagedIndex(entityType, stagedIndexName);

    Set<String> existingAliases =
        activeIndexName != null ? searchClient.getAliases(activeIndexName) : new HashSet<>();

    // Add the default index
    existingAliases.add(indexMapping.getAlias(clusterAlias));
    existingAliases.add(indexMapping.getIndexName(clusterAlias));
    context.add(
        entityType,
        canonicalIndexName,
        activeIndexName,
        stagedIndexName,
        existingAliases,
        indexMapping.getAlias(clusterAlias),
        indexMapping.getParentAliases(clusterAlias));

    LOG.info(
        "Created staged index '{}' for entity '{}' using provided IndexMapping.",
        stagedIndexName,
        entityType);
  }

  private String buildStagedIndexName(String originalIndexName) {
    return String.format("%s_rebuild_%d", originalIndexName, System.currentTimeMillis());
  }

  /**
   * Applied to a freshly-created staged index, before the bulk reindex starts writing to it.
   * Disables refresh and replicas so writes go straight to disk without indexing-side
   * amplification. Reverted by {@link #applyLiveServingSettings} before alias swap.
   */
  private void applyBulkBuildSettings(
      SearchClient searchClient, String stagedIndex, String entityType) {
    BulkIndexOverrides overrides = jobData != null ? jobData.getBulkIndexSettings() : null;
    String json = buildBulkSettingsJson(overrides);
    if (json == null) {
      return;
    }
    LOG.info(
        "Applying bulk-build index settings to staged index '{}' for entity '{}': {}",
        stagedIndex,
        entityType,
        json);
    searchClient.updateIndexSettings(stagedIndex, json);
  }

  /**
   * Applied to the staged index immediately before the alias swap. Restores production-grade
   * read settings (refresh interval, replica count, durable translog). Per-entity overrides take
   * precedence over the global liveIndexSettings.
   *
   * <p>Safety guarantee: every bulk-override field gets a corresponding revert. If the admin's
   * configured {@code liveIndexSettings} is missing fields that {@code bulkIndexSettings}
   * disabled (e.g. bulk sets {@code refresh_interval=-1} and {@code translog.durability=async}
   * but {@code liveIndexSettings} only sets {@code translogDurability=request}), this method
   * fills the gaps with safe live defaults so the promoted index never inherits unsearchable
   * or non-durable bulk values. The merge order is: built-in safety defaults, then admin's
   * {@code liveIndexSettings}, last-write-wins.
   */
  private void applyLiveServingSettings(
      SearchClient searchClient, String stagedIndex, String entityType) {
    IndexSettings settings = resolveLiveSettings(entityType);
    String json =
        buildRevertJson(settings, jobData != null ? jobData.getBulkIndexSettings() : null);
    if (json == null) {
      return;
    }
    LOG.info(
        "Applying live serving settings to staged index '{}' for entity '{}': {}",
        stagedIndex,
        entityType,
        json);
    searchClient.updateIndexSettings(stagedIndex, json);
  }

  /**
   * Compose the live-revert JSON. For every field that the bulk overrides actually applied,
   * ensure the live JSON sets a value — falling back to safe defaults (refresh=1s,
   * replicas=1, durability=request) if the admin's liveIndexSettings doesn't supply one.
   * Fields the bulk phase did not touch only appear in the output if the admin explicitly
   * set them on liveIndexSettings (no-change otherwise).
   */
  static String buildRevertJson(IndexSettings live, BulkIndexOverrides bulk) {
    if (live == null && bulk == null) {
      return null;
    }
    String refresh = pickRefreshInterval(live, bulk);
    Integer replicas = pickReplicas(live, bulk);
    String translogDurability = pickTranslogDurability(live, bulk);
    String translogSyncInterval = pickTranslogSyncInterval(live, bulk);

    ObjectNode body = JsonUtils.getObjectNode();
    if (replicas != null) {
      body.put(REPLICAS, replicas);
    }
    if (refresh != null) {
      body.put(REFRESH_INTERVAL, refresh);
    }
    ObjectNode translog = null;
    if (translogDurability != null) {
      translog = body.putObject(TRANSLOG);
      translog.put(DURABILITY, translogDurability);
    }
    if (translogSyncInterval != null) {
      if (translog == null) {
        translog = body.putObject(TRANSLOG);
      }
      translog.put(SYNC_INTERVAL, translogSyncInterval);
    }
    if (body.size() == 0) {
      return null;
    }
    return body.toString();
  }

  private static String pickRefreshInterval(IndexSettings live, BulkIndexOverrides bulk) {
    if (live != null && live.getRefreshInterval() != null) {
      return live.getRefreshInterval();
    }
    if (bulk != null && bulk.getRefreshInterval() != null) {
      return "1s"; // bulk disabled refresh; restore near-real-time default
    }
    return null;
  }

  private static Integer pickReplicas(IndexSettings live, BulkIndexOverrides bulk) {
    if (live != null && live.getNumberOfReplicas() != null) {
      return live.getNumberOfReplicas();
    }
    if (bulk != null && bulk.getNumberOfReplicas() != null) {
      return 1; // bulk dropped replicas; restore HA default
    }
    return null;
  }

  private static String pickTranslogDurability(IndexSettings live, BulkIndexOverrides bulk) {
    if (live != null && live.getTranslogDurability() != null) {
      return live.getTranslogDurability().value();
    }
    if (bulk != null && bulk.getTranslogDurability() != null) {
      return "request"; // bulk used async; restore durable default
    }
    return null;
  }

  private static String pickTranslogSyncInterval(IndexSettings live, BulkIndexOverrides bulk) {
    if (live != null && live.getTranslogSyncInterval() != null) {
      return live.getTranslogSyncInterval();
    }
    if (bulk != null && bulk.getTranslogSyncInterval() != null) {
      return "5s"; // bulk used relaxed sync; restore default
    }
    return null;
  }

  private IndexSettings resolveLiveSettings(String entityType) {
    if (jobData == null) {
      return null;
    }
    Map<String, IndexSettings> overrides = jobData.getLiveIndexSettingsByEntity();
    if (overrides != null && entityType != null && overrides.containsKey(entityType)) {
      return overrides.get(entityType);
    }
    return jobData.getLiveIndexSettings();
  }

  private void maybeForceMerge(SearchClient searchClient, String stagedIndex, String entityType) {
    BulkIndexOverrides overrides = jobData != null ? jobData.getBulkIndexSettings() : null;
    if (overrides == null || !Boolean.TRUE.equals(overrides.getForceMergeOnPromote())) {
      return;
    }
    LOG.info(
        "Force-merging staged index '{}' (entity '{}') before promotion", stagedIndex, entityType);
    searchClient.forceMerge(stagedIndex, 1);
  }

  /**
   * Build the OS/ES PUT _settings JSON body for bulk-build phase. Returns null if no overrides
   * are configured (in which case the index keeps the cluster defaults from creation time).
   * Uses Jackson so admin-supplied string values (refreshInterval, syncInterval) are properly
   * escaped, and translog fields land in a nested object — the shape the typed OS/ES
   * {@code IndexSettings} model expects when {@code _DESERIALIZER} parses the body.
   */
  static String buildBulkSettingsJson(BulkIndexOverrides overrides) {
    if (overrides == null) {
      return null;
    }
    ObjectNode body = JsonUtils.getObjectNode();
    if (overrides.getNumberOfReplicas() != null) {
      body.put(REPLICAS, overrides.getNumberOfReplicas());
    }
    if (overrides.getRefreshInterval() != null) {
      body.put(REFRESH_INTERVAL, overrides.getRefreshInterval());
    }
    ObjectNode translog = null;
    if (overrides.getTranslogDurability() != null) {
      translog = body.putObject(TRANSLOG);
      translog.put(DURABILITY, overrides.getTranslogDurability().value());
    }
    if (overrides.getTranslogSyncInterval() != null) {
      if (translog == null) {
        translog = body.putObject(TRANSLOG);
      }
      translog.put(SYNC_INTERVAL, overrides.getTranslogSyncInterval());
    }
    if (body.size() == 0) {
      return null;
    }
    return body.toString();
  }
}
