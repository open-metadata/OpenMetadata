package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;

/**
 * Default implementation of RecreateHandler that provides zero-downtime index recreation.
 */
@Slf4j
public class DefaultRecreateHandler implements RecreateIndexHandler {

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

    return context;
  }

  @Override
  public void finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    String entityType = context.getEntityType();
    String canonicalIndex = context.getCanonicalIndex();
    String stagedIndex = context.getStagedIndex();
    Set<String> aliasesFromMapping = context.getExistingAliases();

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
      try {
        // The alias set was derived from indexMapping.json at recreate time via
        // getAliasesFromMapping; finalize just attaches that captured set. Nothing is read from the
        // live cluster, so the set is deterministic and matches the distributed promotion path.
        Set<String> aliasesToAttach = new HashSet<>();
        if (aliasesFromMapping != null) {
          aliasesFromMapping.stream()
              .filter(alias -> alias != null && !alias.isBlank())
              .forEach(aliasesToAttach::add);
        }

        if (aliasesToAttach.isEmpty()) {
          abortPromotionWithoutAliases(entityType, stagedIndex);
          return;
        }

        Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
        Set<String> oldIndicesToDelete = new HashSet<>();
        for (String oldIndex : allEntityIndices) {
          if (!oldIndex.equals(stagedIndex)) {
            oldIndicesToDelete.add(oldIndex);
          }
        }

        Set<String> concreteToRemove =
            resolveCanonicalRemoval(searchClient, canonicalIndex, oldIndicesToDelete);

        LOG.debug(
            "finalizeReindex entity '{}': aliases={}, oldIndices={}, stagedIndex={}, "
                + "concreteToRemove={}",
            entityType,
            aliasesToAttach,
            oldIndicesToDelete,
            stagedIndex,
            concreteToRemove);

        boolean swapSuccess =
            searchClient.swapAliases(
                oldIndicesToDelete, stagedIndex, aliasesToAttach, concreteToRemove);
        if (!swapSuccess) {
          LOG.error(
              "Failed to atomically swap aliases for entity '{}'. Old indices will not be deleted.",
              entityType);
          return;
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
      }
      return;
    }

    try {
      Set<String> aliasesToAttach =
          getAliasesFromMapping(indexMapping, searchRepository.getClusterAlias());

      if (aliasesToAttach.isEmpty()) {
        abortPromotionWithoutAliases(entityType, stagedIndex);
        return;
      }

      Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
      Set<String> oldIndicesToDelete = new HashSet<>();
      for (String oldIndex : allEntityIndices) {
        if (!oldIndex.equals(stagedIndex)) {
          oldIndicesToDelete.add(oldIndex);
        }
      }

      Set<String> concreteToRemove =
          resolveCanonicalRemoval(searchClient, canonicalIndex, oldIndicesToDelete);

      LOG.debug(
          "promoteEntityIndex '{}': aliases={}, oldIndices={}, stagedIndex={}, concreteToRemove={}",
          entityType,
          aliasesToAttach,
          oldIndicesToDelete,
          stagedIndex,
          concreteToRemove);

      boolean swapSuccess =
          searchClient.swapAliases(
              oldIndicesToDelete, stagedIndex, aliasesToAttach, concreteToRemove);
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
    }
  }

  /**
   * Aborts promotion when no aliases resolved for the staged index. Critically this skips the
   * old-index cleanup: deleting the previously serving index while no alias points at the staged
   * index would orphan the canonical alias and surface to users as
   * "Failed to find index openmetadata_*_search_index". The staged index is retained (its routing
   * is cleared by the caller's finally block) so a subsequent reindex can recover.
   */
  private void abortPromotionWithoutAliases(String entityType, String stagedIndex) {
    LOG.error(
        "Entity '{}': no aliases resolved for staged index '{}'. Skipping alias swap and old-index "
            + "cleanup to avoid orphaning the canonical alias. Staged index retained; reindex must "
            + "be retried.",
        entityType,
        stagedIndex);
    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    if (metrics != null) {
      metrics.recordPromotionFailure(entityType);
    }
  }

  /**
   * Resolves how the canonical index name participates in the alias swap and prunes it from {@code
   * oldIndicesToDelete}.
   *
   * <ul>
   *   <li><b>Concrete index sharing the alias name</b> (the first-install / post-orphan shape): it
   *       is returned so the caller hands it to {@link SearchClient#swapAliases(Set, String, Set,
   *       Set)} for an atomic {@code remove_index}. Deleting it in a separate step before the swap
   *       opens a window where the index is gone but the alias is not yet attached — if the alias
   *       add then fails (e.g. the delete has not propagated, so OS/ES still sees an index with the
   *       alias name), the canonical name resolves to nothing and users hit "Failed to find index
   *       openmetadata_*_search_index".
   *   <li><b>Already an alias</b>: it is simply dropped from the delete set — the swap moves it
   *       atomically, and a delete-by-name on an alias would fail ("matches an alias") and burn
   *       retry backoff.
   * </ul>
   *
   * @return the concrete indices (0 or 1) to remove atomically within the swap
   */
  private Set<String> resolveCanonicalRemoval(
      SearchClient searchClient, String canonicalIndex, Set<String> oldIndicesToDelete) {
    Set<String> concreteToRemove = new HashSet<>();
    if (oldIndicesToDelete.contains(canonicalIndex)) {
      boolean isConcreteIndex =
          searchClient.getIndicesByAlias(canonicalIndex).isEmpty()
              && searchClient.indexExists(canonicalIndex);
      if (isConcreteIndex) {
        concreteToRemove.add(canonicalIndex);
      }
      oldIndicesToDelete.remove(canonicalIndex);
    }
    return concreteToRemove;
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

    // Aliases to attach come solely from indexMapping.json (short alias + parent aliases + raw
    // canonical index name) — never from whatever happens to be on the live index in ES. Reading
    // existing aliases off the cluster is non-deterministic (it propagates stray/leftover aliases),
    // adds a cluster round-trip and failure point, and diverges from the distributed promotion path
    // (promoteEntityIndex). Both paths now funnel through the same getAliasesFromMapping helper.
    Set<String> aliasesFromMapping = getAliasesFromMapping(indexMapping, clusterAlias);
    context.add(
        entityType,
        canonicalIndexName,
        activeIndexName,
        stagedIndexName,
        aliasesFromMapping,
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
}
