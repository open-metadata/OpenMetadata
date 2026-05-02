package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.BulkIndexOverrides;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexSettings;
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

  private static final String SHARDS = "number_of_shards";
  private static final String REPLICAS = "number_of_replicas";
  private static final String REFRESH_INTERVAL = "refresh_interval";
  private static final String TRANSLOG_DURABILITY = "translog.durability";
  private static final String TRANSLOG_SYNC_INTERVAL = "translog.sync_interval";

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
   * <p>Safety guarantee: if bulk overrides were applied during the build (refresh=-1, replicas=0,
   * etc.) but the admin did not configure {@code liveIndexSettings}, this still applies a minimal
   * revert ({@code refresh_interval=1s}, {@code number_of_replicas=1}) so the promoted index does
   * not silently inherit unsearchable bulk-build values. Admins can override with explicit
   * {@code liveIndexSettings} in the SearchIndexing app config.
   */
  private void applyLiveServingSettings(
      SearchClient searchClient, String stagedIndex, String entityType) {
    IndexSettings settings = resolveLiveSettings(entityType);
    String json = buildLiveSettingsJson(settings);
    if (json == null && bulkOverridesWereApplied()) {
      json = buildSafetyRevertJson();
      LOG.warn(
          "Bulk index overrides were applied but no liveIndexSettings configured for entity '{}'. "
              + "Applying safety revert {} to keep the promoted index searchable. Configure "
              + "liveIndexSettings in the SearchIndexing app to customize.",
          entityType,
          json);
    }
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

  private boolean bulkOverridesWereApplied() {
    return jobData != null
        && jobData.getBulkIndexSettings() != null
        && buildBulkSettingsJson(jobData.getBulkIndexSettings()) != null;
  }

  private static String buildSafetyRevertJson() {
    return "{\"" + REFRESH_INTERVAL + "\":\"1s\",\"" + REPLICAS + "\":1}";
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

  private void maybeForceMerge(
      SearchClient searchClient, String stagedIndex, String entityType) {
    BulkIndexOverrides overrides = jobData != null ? jobData.getBulkIndexSettings() : null;
    if (overrides == null || !Boolean.TRUE.equals(overrides.getForceMergeOnPromote())) {
      return;
    }
    LOG.info("Force-merging staged index '{}' (entity '{}') before promotion", stagedIndex, entityType);
    searchClient.forceMerge(stagedIndex, 1);
  }

  /**
   * Build the OS/ES PUT _settings JSON body for bulk-build phase. Returns null if no overrides
   * are configured (in which case the index keeps the cluster defaults from creation time).
   */
  static String buildBulkSettingsJson(BulkIndexOverrides overrides) {
    if (overrides == null) {
      return null;
    }
    StringBuilder body = new StringBuilder("{");
    boolean first = true;
    if (overrides.getNumberOfReplicas() != null) {
      first = appendNumber(body, REPLICAS, overrides.getNumberOfReplicas(), first);
    }
    if (overrides.getRefreshInterval() != null) {
      first = appendString(body, REFRESH_INTERVAL, overrides.getRefreshInterval(), first);
    }
    if (overrides.getTranslogDurability() != null) {
      first =
          appendString(body, TRANSLOG_DURABILITY, overrides.getTranslogDurability().value(), first);
    }
    if (overrides.getTranslogSyncInterval() != null) {
      first = appendString(body, TRANSLOG_SYNC_INTERVAL, overrides.getTranslogSyncInterval(), first);
    }
    if (first) {
      return null;
    }
    body.append('}');
    return body.toString();
  }

  /**
   * Build the OS/ES PUT _settings JSON body for live-serving phase. number_of_shards is
   * intentionally not included — it cannot be changed on an existing index and must be set at
   * creation time via the mapping JSON.
   */
  static String buildLiveSettingsJson(IndexSettings settings) {
    if (settings == null) {
      return null;
    }
    StringBuilder body = new StringBuilder("{");
    boolean first = true;
    if (settings.getNumberOfReplicas() != null) {
      first = appendNumber(body, REPLICAS, settings.getNumberOfReplicas(), first);
    }
    if (settings.getRefreshInterval() != null) {
      first = appendString(body, REFRESH_INTERVAL, settings.getRefreshInterval(), first);
    }
    if (settings.getTranslogDurability() != null) {
      first =
          appendString(body, TRANSLOG_DURABILITY, settings.getTranslogDurability().value(), first);
    }
    if (settings.getTranslogSyncInterval() != null) {
      first = appendString(body, TRANSLOG_SYNC_INTERVAL, settings.getTranslogSyncInterval(), first);
    }
    if (first) {
      return null;
    }
    body.append('}');
    return body.toString();
  }

  private static boolean appendString(StringBuilder body, String key, String value, boolean first) {
    if (!first) {
      body.append(',');
    }
    body.append('"').append(key).append("\":\"").append(value).append('"');
    return false;
  }

  private static boolean appendNumber(StringBuilder body, String key, Number value, boolean first) {
    if (!first) {
      body.append(',');
    }
    body.append('"').append(key).append("\":").append(value);
    return false;
  }
}
