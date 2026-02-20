package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;

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
    String activeIndex = context.getActiveIndex();
    String stagedIndex = context.getStagedIndex();
    Set<String> existingAliases = context.getExistingAliases();
    String canonicalAlias = context.getCanonicalAliases();
    Set<String> parentAliases = context.getParentAliases();

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient searchClient = searchRepository.getSearchClient();

    if (canonicalIndex == null || stagedIndex == null) {
      LOG.error(
          "Cannot finalize reindex for entity '{}'. Missing canonical or staged index name.",
          entityType);
      return;
    }

    if (reindexSuccess) {
      try {
        Set<String> aliasesToAttach = new HashSet<>();

        // Existing Aliases
        existingAliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .forEach(aliasesToAttach::add);

        // Canonical Alias
        if (!nullOrEmpty(canonicalAlias)) {
          aliasesToAttach.add(canonicalAlias);
        }

        // Parent Aliases
        parentAliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .forEach(aliasesToAttach::add);

        // Remove any null or blank aliases
        aliasesToAttach.removeIf(alias -> alias == null || alias.isBlank());

        // Collect all old indices to delete (except staged)
        Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
        Set<String> oldIndicesToDelete = new HashSet<>();
        for (String oldIndex : allEntityIndices) {
          if (!oldIndex.equals(stagedIndex)) {
            oldIndicesToDelete.add(oldIndex);
          }
        }

        // Canonical Indexes needs to be removed before attached that as aliases
        if (oldIndicesToDelete.contains(canonicalIndex)) {
          if (searchClient.indexExists(canonicalIndex)) {
            searchClient.deleteIndexWithBackoff(canonicalIndex);
            oldIndicesToDelete.remove(canonicalIndex);
            LOG.info("Cleaned up old index '{}' for entity '{}'.", canonicalIndex, entityType);
          }
        }

        // Atomically swap aliases from old indices to staged index
        // This ensures zero-downtime: aliases point to new index before old ones are deleted
        if (!aliasesToAttach.isEmpty()) {
          boolean swapSuccess =
              searchClient.swapAliases(oldIndicesToDelete, stagedIndex, aliasesToAttach);
          if (!swapSuccess) {
            LOG.error(
                "Failed to atomically swap aliases for entity '{}'. Old indices will not be deleted.",
                entityType);
            return;
          }
        }

        LOG.info(
            "Promoted staged index '{}' to serve entity '{}' (aliases: {}).",
            stagedIndex,
            entityType,
            aliasesToAttach);

        // Delete old indices after successful alias swap (with backoff for snapshot scenarios)
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
          "Cannot promote index for entity '{}'. Missing canonical or staged index name.",
          entityType);
      return;
    }

    if (!reindexSuccess) {
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
      // Get aliases from indexMapping.json (not from old index)
      Set<String> aliasesToAttach =
          getAliasesFromMapping(indexMapping, searchRepository.getClusterAlias());

      // Find old indices with this prefix (except staged)
      Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
      Set<String> oldIndicesToDelete = new HashSet<>();
      for (String oldIndex : allEntityIndices) {
        if (!oldIndex.equals(stagedIndex)) {
          oldIndicesToDelete.add(oldIndex);
        }
      }

      // Canonical Indexes needs to be removed before attached that as aliases
      if (oldIndicesToDelete.contains(canonicalIndex)) {
        if (searchClient.indexExists(canonicalIndex)) {
          searchClient.deleteIndexWithBackoff(canonicalIndex);
          oldIndicesToDelete.remove(canonicalIndex);
          LOG.info("Cleaned up old index '{}' for entity '{}'.", canonicalIndex, entityType);
        }
      }

      // Atomically swap aliases from old indices to staged index
      // This ensures zero-downtime: aliases point to new index before old ones are deleted
      if (!aliasesToAttach.isEmpty()) {
        boolean swapSuccess =
            searchClient.swapAliases(oldIndicesToDelete, stagedIndex, aliasesToAttach);
        if (!swapSuccess) {
          LOG.error(
              "Failed to atomically swap aliases for entity '{}'. Old indices will not be deleted.",
              entityType);
          return;
        }
      }

      LOG.info(
          "Promoted staged index '{}' to serve entity '{}' (aliases: {}).",
          stagedIndex,
          entityType,
          aliasesToAttach);

      // Delete old indices after successful alias swap (with backoff for snapshot scenarios)
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
}
