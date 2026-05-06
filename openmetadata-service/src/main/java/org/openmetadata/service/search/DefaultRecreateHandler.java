package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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
  private final Set<String> failedPromotions = ConcurrentHashMap.newKeySet();
  private final Set<String> dataLossPromotions = ConcurrentHashMap.newKeySet();

  public DefaultRecreateHandler withJobData(EventPublisherJob jobData) {
    this.jobData = jobData;
    return this;
  }

  public Set<String> getFailedPromotions() {
    return Set.copyOf(failedPromotions);
  }

  public Set<String> getDataLossPromotions() {
    return Set.copyOf(dataLossPromotions);
  }

  private void markPromotionFailed(String entityType, boolean dataLoss) {
    failedPromotions.add(entityType);
    if (dataLoss) {
      dataLossPromotions.add(entityType);
    }
    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    if (metrics != null) {
      metrics.recordPromotionFailure(entityType);
    }
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
    promote(context, reindexSuccess);
  }

  /**
   * Per-entity entry point used by distributed and single-server callbacks the moment all of an
   * entity's partitions complete. Delegates to the same core as {@link #finalizeReindex}; both
   * names exist for caller-site clarity.
   */
  public void promoteEntityIndex(EntityReindexContext context, boolean reindexSuccess) {
    promote(context, reindexSuccess);
  }

  /**
   * Single core promote path. Both {@link #finalizeReindex} (end-of-job) and {@link
   * #promoteEntityIndex} (per-entity) delegate here to avoid the parallel-method-drift class of
   * regression where a feature gets added to one entry but not the other.
   */
  private void promote(EntityReindexContext context, boolean reindexSuccess) {
    String entityType = context.getEntityType();
    String canonicalIndex = context.getCanonicalIndex();
    String stagedIndex = context.getStagedIndex();

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient searchClient = searchRepository.getSearchClient();

    if (canonicalIndex == null || stagedIndex == null) {
      LOG.error(
          "Cannot promote index for entity '{}'. canonicalIndex={}, stagedIndex={}",
          entityType,
          canonicalIndex,
          stagedIndex);
      return;
    }

    boolean shouldPromote =
        decideShouldPromote(searchClient, entityType, stagedIndex, reindexSuccess);

    if (!shouldPromote) {
      deleteStagedIndexAndUnregister(searchClient, searchRepository, entityType, stagedIndex);
      return;
    }

    try {
      applyLiveServingSettings(searchClient, stagedIndex, entityType);
      maybeForceMerge(searchClient, stagedIndex, entityType);

      Set<String> aliasesToAttach = buildAliasesToAttach(context);
      if (aliasesToAttach.isEmpty()) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED reason=empty-aliases entity={} stagedIndex={} canonicalIndex={} canonicalAlias={} parentAliases={} existingAliases={}] "
                + "Refusing to swap. Canonical not deleted.",
            entityType,
            stagedIndex,
            canonicalIndex,
            context.getCanonicalAliases(),
            context.getParentAliases(),
            context.getExistingAliases());
        markPromotionFailed(entityType, false);
        return;
      }

      Set<String> oldIndicesToCleanup = new HashSet<>();
      for (String oldIndex : searchClient.listIndicesByPrefix(canonicalIndex)) {
        if (!oldIndex.equals(stagedIndex)) {
          oldIndicesToCleanup.add(oldIndex);
        }
      }

      promoteWithDeferredCanonicalDelete(
          searchClient,
          entityType,
          canonicalIndex,
          stagedIndex,
          aliasesToAttach,
          oldIndicesToCleanup,
          reindexSuccess);
    } catch (Exception ex) {
      LOG.error(
          "[ALIAS_PROMOTE_FAILED phase=exception entity={} stagedIndex={} canonicalIndex={}] "
              + "Unexpected exception during promotion.",
          entityType,
          stagedIndex,
          canonicalIndex,
          ex);
      markPromotionFailed(entityType, false);
    } finally {
      searchRepository.unregisterStagedIndex(entityType, stagedIndex);
    }
  }

  /**
   * Always-promote semantics: even on reindex failure, if the staged index has data we still
   * promote (partial data {@literal >} no data). Only an empty staged index after a failed
   * reindex gets deleted. An indeterminate doc count (negative return) defaults to promoting,
   * since losing indexed data because we couldn't query the count would be worse.
   */
  private boolean decideShouldPromote(
      SearchClient searchClient, String entityType, String stagedIndex, boolean reindexSuccess) {
    if (reindexSuccess) {
      return true;
    }
    long docCount = searchClient.getDocumentCount(stagedIndex);
    if (docCount > 0) {
      LOG.info(
          "Reindex failed for entity '{}' but staged index '{}' has {} documents. Promoting partial data.",
          entityType,
          stagedIndex,
          docCount);
      return true;
    }
    if (docCount == 0) {
      LOG.info(
          "Reindex failed for entity '{}' and staged index '{}' is empty. Deleting.",
          entityType,
          stagedIndex);
      return false;
    }
    LOG.warn(
        "Could not determine doc count for staged index '{}' (entity '{}'). Promoting.",
        stagedIndex,
        entityType);
    return true;
  }

  private void deleteStagedIndexAndUnregister(
      SearchClient searchClient,
      SearchRepository searchRepository,
      String entityType,
      String stagedIndex) {
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

  /**
   * Resolves the alias set to attach to the promoted staged index. Combines the operator-visible
   * aliases captured at stage-create time ({@code existingAliases} — read from the live index,
   * preserves operator-added aliases), the canonical short alias, and parent aliases. Blanks are
   * filtered. The canonical index name is included as one of these aliases when populated by the
   * caller (recreateIndexFromMapping seeds it via existingAliases).
   */
  private Set<String> buildAliasesToAttach(EntityReindexContext context) {
    Set<String> aliases = new HashSet<>();
    if (context.getExistingAliases() != null) {
      context.getExistingAliases().stream()
          .filter(a -> a != null && !a.isBlank())
          .forEach(aliases::add);
    }
    if (!nullOrEmpty(context.getCanonicalAliases())) {
      aliases.add(context.getCanonicalAliases());
    }
    if (context.getParentAliases() != null) {
      context.getParentAliases().stream()
          .filter(a -> a != null && !a.isBlank())
          .forEach(aliases::add);
    }
    return aliases;
  }

  /**
   * Three-step alias swap that defers canonical-index deletion until after parent aliases are
   * safely on the staged index. Returns true on full success.
   *
   * <p>Step 1: atomic swap of all non-canonical-name aliases (parents + short alias) from old
   * indices to staged. If this fails, canonical still serves with all original aliases — no data
   * loss.
   *
   * <p>Step 2: delete the canonical index to free its name. If this fails, parent aliases work
   * but canonical-name lookups still hit the (stale) old canonical index — degraded, not lost.
   *
   * <p>Step 3: add the canonical name as an alias to staged. If this fails, canonical-name
   * lookups return 404 — this is the only data-loss path, and it requires both the canonical
   * being deleted and the alias-add failing transiently.
   */
  private boolean promoteWithDeferredCanonicalDelete(
      SearchClient searchClient,
      String entityType,
      String canonicalIndex,
      String stagedIndex,
      Set<String> aliasesToAttach,
      Set<String> oldIndicesToCleanup,
      boolean reindexSuccess) {
    boolean needsCanonicalAlias = aliasesToAttach.contains(canonicalIndex);
    Set<String> nonCanonicalAliases = new HashSet<>(aliasesToAttach);
    nonCanonicalAliases.remove(canonicalIndex);

    if (!nonCanonicalAliases.isEmpty()) {
      boolean step1 =
          searchClient.swapAliases(oldIndicesToCleanup, stagedIndex, nonCanonicalAliases);
      if (!step1) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED phase=swap1 entity={} stagedIndex={} canonicalIndex={} aliases={}] "
                + "Canonical not deleted; old index still serves all original aliases.",
            entityType,
            stagedIndex,
            canonicalIndex,
            nonCanonicalAliases);
        markPromotionFailed(entityType, false);
        return false;
      }
    }

    // deleteIndexWithBackoff and addAliases swallow transport exceptions and return void in
    // both ES and OS clients (ElasticSearchIndexManager#deleteIndexWithBackoff,
    // ElasticSearchIndexManager#addAliasesInternal — same shape on the OS side). A try/catch
    // alone cannot detect failure. Verify outcome via post-state checks: the index is gone,
    // the alias is attached.
    if (needsCanonicalAlias && searchClient.indexExists(canonicalIndex)) {
      try {
        searchClient.deleteIndexWithBackoff(canonicalIndex);
      } catch (Exception ex) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED phase=delete-canonical entity={} stagedIndex={} canonicalIndex={} reason=exception] "
                + "Parent aliases on staged; canonical-name lookups still hit old index until retry.",
            entityType,
            stagedIndex,
            canonicalIndex,
            ex);
        markPromotionFailed(entityType, false);
        return false;
      }
      if (searchClient.indexExists(canonicalIndex)) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED phase=delete-canonical entity={} stagedIndex={} canonicalIndex={} reason=delete-not-acknowledged] "
                + "Client did not throw, but canonical index still exists. Old index keeps serving canonical-name lookups.",
            entityType,
            stagedIndex,
            canonicalIndex);
        markPromotionFailed(entityType, false);
        return false;
      }
    }

    if (needsCanonicalAlias) {
      try {
        searchClient.addAliases(stagedIndex, Set.of(canonicalIndex));
      } catch (Exception ex) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED phase=swap2 entity={} stagedIndex={} canonicalIndex={} reason=exception] "
                + "DATA UNAVAILABLE: canonical was deleted but canonical-name alias add failed. "
                + "Parent aliases work; canonical-name lookups will 404 until manual repair.",
            entityType,
            stagedIndex,
            canonicalIndex,
            ex);
        markPromotionFailed(entityType, true);
        return false;
      }
      if (!searchClient.getAliases(stagedIndex).contains(canonicalIndex)) {
        LOG.error(
            "[ALIAS_PROMOTE_FAILED phase=swap2 entity={} stagedIndex={} canonicalIndex={} reason=alias-not-attached] "
                + "DATA UNAVAILABLE: client did not throw, but canonical-name alias is not on staged index. "
                + "Parent aliases work; canonical-name lookups will 404 until manual repair.",
            entityType,
            stagedIndex,
            canonicalIndex);
        markPromotionFailed(entityType, true);
        return false;
      }
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

    for (String oldIndex : oldIndicesToCleanup) {
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
    return true;
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
