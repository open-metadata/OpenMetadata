package org.openmetadata.service.search;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.RecreateIndexHandler.ReindexContext;

/**
 * Default implementation of RecreateHandler that provides zero-downtime index recreation.
 */
@Slf4j
public class DefaultRecreateHandler implements RecreateIndexHandler {

  @Override
  public ReindexContext reCreateIndexes(Set<String> entities) {
    ReindexContext context = new ReindexContext();
    SearchRepository searchRepository = Entity.getSearchRepository();

    if (CommonUtil.nullOrEmpty(entities)) {
      return context;
    }

    String clusterAlias = searchRepository.getClusterAlias();
    SearchClient<?> searchClient = searchRepository.getSearchClient();

    for (String entityType : entities) {
      IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
      if (indexMapping == null) {
        LOG.warn(
            "No index mapping found for entityType '{}'. Skipping index recreation.", entityType);
        continue;
      }

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
            "Unable to read index mapping content for '{}'. Skipping staged recreation.",
            canonicalIndexName);
        continue;
      }

      String stagedIndexName = buildStagedIndexName(canonicalIndexName);
      searchClient.createIndex(stagedIndexName, mappingContent);

      Set<String> existingAliases =
          activeIndexName != null ? searchClient.getAliases(activeIndexName) : Set.of();

      context.add(
          entityType,
          canonicalIndexName,
          activeIndexName,
          stagedIndexName,
          existingAliases,
          indexMapping.getAlias(clusterAlias),
          indexMapping.getParentAliases(clusterAlias));
      LOG.info(
          "Created staged index '{}' for entity '{}' to support zero-downtime recreation.",
          stagedIndexName,
          entityType);
    }

    return context;
  }

  @Override
  public void finalizeEntityReindex(ReindexContext context, String entityType, boolean success) {
    if (context == null || entityType == null) {
      return;
    }

    // Check if already finalized
    if (context.isFinalized(entityType)) {
      LOG.debug("Entity '{}' already finalized, skipping", entityType);
      return;
    }

    String canonicalIndex = context.getCanonicalIndex(entityType).orElse(null);
    String activeIndex = context.getOriginalIndex(entityType).orElse(null);
    String stagedIndex = context.getStagedIndex(entityType).orElse(null);

    if (canonicalIndex == null || stagedIndex == null) {
      LOG.debug("Skipping finalization for entity '{}' - missing index information", entityType);
      return;
    }

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepository.getSearchClient();

    if (success) {
      promoteIndexForEntity(
          context, entityType, canonicalIndex, activeIndex, stagedIndex, searchClient);
    } else {
      cleanupStagedIndexForEntity(entityType, stagedIndex, searchClient);
    }

    // Mark as finalized
    context.markFinalized(entityType);
  }

  @Override
  public void finalizeReindex(ReindexContext context, boolean success) {
    if (context == null || context.isEmpty()) {
      return;
    }

    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepository.getSearchClient();

    for (String entityType : context.getEntities()) {
      // Skip if already finalized per-entity
      if (context.isFinalized(entityType)) {
        LOG.debug(
            "Entity '{}' already finalized per-entity, skipping in batch finalization", entityType);
        continue;
      }

      String canonicalIndex = context.getCanonicalIndex(entityType).orElse(null);
      String activeIndex = context.getOriginalIndex(entityType).orElse(null);
      String stagedIndex = context.getStagedIndex(entityType).orElse(null);

      if (canonicalIndex == null || stagedIndex == null) {
        continue;
      }

      if (success) {
        promoteIndexForEntity(
            context, entityType, canonicalIndex, activeIndex, stagedIndex, searchClient);
      } else {
        cleanupStagedIndexForEntity(entityType, stagedIndex, searchClient);
      }

      // Mark as finalized
      context.markFinalized(entityType);
    }
  }

  private void promoteIndexForEntity(
      ReindexContext context,
      String entityType,
      String canonicalIndex,
      String activeIndex,
      String stagedIndex,
      SearchClient<?> searchClient) {
    try {
      Set<String> aliasesToAttach = new HashSet<>();
      aliasesToAttach.addAll(context.getExistingAliases(entityType));
      context.getCanonicalAlias(entityType).ifPresent(aliasesToAttach::add);

      // Add canonical index name as an alias so queries using the full index name still work
      // But only if no index exists with that name
      if (!searchClient.indexExists(canonicalIndex)) {
        aliasesToAttach.add(canonicalIndex);
      }

      List<String> parentAliases = context.getParentAliases(entityType);
      if (parentAliases != null) {
        parentAliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .forEach(aliasesToAttach::add);
      }
      aliasesToAttach.removeIf(alias -> alias == null || alias.isBlank());

      for (String alias : aliasesToAttach) {
        Set<String> targets = searchClient.getIndicesByAlias(alias);
        for (String target : targets) {
          if (target.equals(stagedIndex)) {
            continue;
          }

          boolean belongsToEntity =
              target.equals(canonicalIndex) || target.startsWith(canonicalIndex + "_rebuild_");

          if (!belongsToEntity) {
            LOG.debug(
                "Skipping alias '{}' removal from index '{}' as it does not belong to entity '{}'.",
                alias,
                target,
                entityType);
            continue;
          }

          searchClient.removeAliases(target, Set.of(alias));
          LOG.info(
              "Removed alias '{}' from index '{}' during promotion for entity '{}'.",
              alias,
              target,
              entityType);

          if (searchClient.indexExists(target)) {
            searchClient.deleteIndex(target);
            LOG.debug("Replaced old index '{}' for entity '{}'.", target, entityType);
          }
        }
      }

      if (activeIndex != null && searchClient.indexExists(activeIndex)) {
        searchClient.deleteIndex(activeIndex);
        LOG.debug("Replaced old index '{}' for entity '{}'.", activeIndex, entityType);
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
  }

  private void cleanupStagedIndexForEntity(
      String entityType, String stagedIndex, SearchClient<?> searchClient) {
    try {
      if (searchClient.indexExists(stagedIndex)) {
        searchClient.deleteIndex(stagedIndex);
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

  private String buildStagedIndexName(String originalIndexName) {
    return String.format("%s_rebuild_%d", originalIndexName, System.currentTimeMillis());
  }
}
