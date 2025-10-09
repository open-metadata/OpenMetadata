package org.openmetadata.service.search;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Interface for cleaning up resources during reindexing operations.
 * This allows for different implementations to be provided for different deployment tiers.
 */
public interface RecreateIndexHandler {
  ReindexContext reCreateIndexes(Set<String> entities);

  default void finalizeReindex(ReindexContext context, boolean success) {}

  /**
   * Finalize reindex for a specific entity. This allows per-entity index swapping
   * to reduce memory footprint during reindexing.
   *
   * @param context The reindex context containing staged index information
   * @param entityType The entity type to finalize
   * @param success Whether the reindexing was successful for this entity
   */
  default void finalizeEntityReindex(ReindexContext context, String entityType, boolean success) {}

  class ReindexContext {
    private final Map<String, String> canonicalIndexByEntity = new HashMap<>();
    private final Map<String, String> originalIndexByEntity = new HashMap<>();
    private final Map<String, String> stagedIndexByEntity = new HashMap<>();
    private final Map<String, Set<String>> existingAliasesByEntity = new HashMap<>();
    private final Map<String, String> canonicalAliasByEntity = new HashMap<>();
    private final Map<String, List<String>> parentAliasesByEntity = new HashMap<>();
    private final Set<String> finalizedEntities = new HashSet<>();

    public void add(
        String entity,
        String canonicalIndex,
        String originalIndex,
        String stagedIndex,
        Set<String> existingAliases,
        String canonicalAlias,
        List<String> parentAliases) {
      canonicalIndexByEntity.put(entity, canonicalIndex);
      originalIndexByEntity.put(entity, originalIndex);
      stagedIndexByEntity.put(entity, stagedIndex);
      existingAliasesByEntity.put(
          entity, new HashSet<>(Optional.ofNullable(existingAliases).orElseGet(HashSet::new)));
      canonicalAliasByEntity.put(entity, canonicalAlias);
      parentAliasesByEntity.put(entity, parentAliases != null ? parentAliases : List.of());
    }

    public synchronized void markFinalized(String entity) {
      finalizedEntities.add(entity);
    }

    public synchronized boolean isFinalized(String entity) {
      return finalizedEntities.contains(entity);
    }

    public Optional<String> getCanonicalIndex(String entity) {
      return Optional.ofNullable(canonicalIndexByEntity.get(entity));
    }

    public Set<String> getEntities() {
      return Collections.unmodifiableSet(stagedIndexByEntity.keySet());
    }

    public Optional<String> getStagedIndex(String entity) {
      return Optional.ofNullable(stagedIndexByEntity.get(entity));
    }

    public Optional<String> getOriginalIndex(String entity) {
      return Optional.ofNullable(originalIndexByEntity.get(entity));
    }

    public Set<String> getExistingAliases(String entity) {
      return existingAliasesByEntity.getOrDefault(entity, Collections.emptySet());
    }

    public Optional<String> getCanonicalAlias(String entity) {
      return Optional.ofNullable(canonicalAliasByEntity.get(entity));
    }

    public List<String> getParentAliases(String entity) {
      return parentAliasesByEntity.getOrDefault(entity, List.of());
    }

    public boolean isEmpty() {
      return stagedIndexByEntity.isEmpty();
    }
  }
}
