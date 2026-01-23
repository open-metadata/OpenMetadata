package org.openmetadata.service.search;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public class ReindexContext {
  private final Map<String, String> canonicalIndexByEntity = new HashMap<>();
  private final Map<String, String> originalIndexByEntity = new HashMap<>();
  private final Map<String, String> stagedIndexByEntity = new HashMap<>();
  private final Map<String, Set<String>> existingAliasesByEntity = new HashMap<>();
  private final Map<String, String> canonicalAliasByEntity = new HashMap<>();
  private final Map<String, List<String>> parentAliasesByEntity = new HashMap<>();

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

  /**
   * Get the complete staged index mapping for serialization/sharing with participant servers.
   *
   * @return Map of entity type to staged index name
   */
  public Map<String, String> getStagedIndexMapping() {
    return new HashMap<>(stagedIndexByEntity);
  }

  /**
   * Create a minimal ReindexContext from a staged index mapping. Used by participant servers to
   * reconstruct context from the job's stored mapping.
   *
   * @param stagedIndexMapping Map of entity type to staged index name
   * @return A ReindexContext with only staged index information
   */
  public static ReindexContext fromStagedIndexMapping(Map<String, String> stagedIndexMapping) {
    ReindexContext context = new ReindexContext();
    if (stagedIndexMapping != null) {
      for (Map.Entry<String, String> entry : stagedIndexMapping.entrySet()) {
        context.stagedIndexByEntity.put(entry.getKey(), entry.getValue());
      }
    }
    return context;
  }
}
