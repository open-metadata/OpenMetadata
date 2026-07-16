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

  /**
   * Reserved pseudo-entity key carrying the staged vector-chunk generation through the SAME
   * staged-mapping wire the entity staged indexes travel (context -> job record -> distributed
   * participants), so workers on other nodes receive it without any new serialization. Never a
   * real entity type; filtered out of {@link #getEntities()}.
   */
  public static final String STAGED_CHUNK_KEY = "__vectorChunks__";

  /**
   * Staged vector-chunk generation created by this run's reCreateIndexes, or empty when the run
   * did not stage one (partial recreates, normal runs).
   */
  public Optional<String> getStagedChunkIndex() {
    return Optional.ofNullable(stagedIndexByEntity.get(STAGED_CHUNK_KEY));
  }

  public void setStagedChunkIndex(String stagedChunkIndex) {
    if (stagedChunkIndex == null) {
      stagedIndexByEntity.remove(STAGED_CHUNK_KEY);
    } else {
      stagedIndexByEntity.put(STAGED_CHUNK_KEY, stagedChunkIndex);
    }
  }

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
    Set<String> entities = new java.util.HashSet<>(stagedIndexByEntity.keySet());
    entities.remove(STAGED_CHUNK_KEY);
    return Collections.unmodifiableSet(entities);
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
      context.stagedIndexByEntity.putAll(stagedIndexMapping);
    }
    return context;
  }
}
