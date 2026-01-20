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

        Set<String> allEntityIndices = searchClient.listIndicesByPrefix(canonicalIndex);
        for (String oldIndex : allEntityIndices) {
          if (oldIndex.equals(stagedIndex)) {
            LOG.debug(
                "Skipping deletion of staged index '{}' for entity '{}'.", stagedIndex, entityType);
            continue;
          }

          if (activeIndex != null && oldIndex.equals(activeIndex)) {
            LOG.debug(
                "Skipping deletion of currently active index '{}' for entity '{}' (will be deleted after alias swap).",
                activeIndex,
                entityType);
            continue;
          }

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

        if (activeIndex != null && searchClient.indexExists(activeIndex)) {
          searchClient.deleteIndexWithBackoff(activeIndex);
          LOG.info(
              "Deleted previously active index '{}' for entity '{}'.", activeIndex, entityType);
        }

        if (!aliasesToAttach.isEmpty()) {
          searchClient.addAliases(stagedIndex, aliasesToAttach);
        }
        LOG.info(
            "Promoted staged index '{}' to serve entity '{}' (aliases: {}).",
            stagedIndex,
            entityType,
            aliasesToAttach);
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
