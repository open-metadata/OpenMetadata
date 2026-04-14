package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;

/**
 * Request-scoped read bundle.
 *
 * <p>Semantics:
 *
 * <ul>
 *   <li>Optional.empty() means "not loaded"
 *   <li>Optional.of(emptyList()) means "loaded and empty"
 * </ul>
 */
final class ReadBundle {
  private final Map<RelationKey, List<EntityReference>> relationValues = new HashMap<>();
  private final Set<RelationKey> loadedRelations = new HashSet<>();
  private final Map<UUID, Map<String, Set<Include>>> loadedRelationIncludesByField =
      new HashMap<>();

  private final Map<UUID, List<TagLabel>> tagValues = new HashMap<>();
  private final Set<UUID> loadedTags = new HashSet<>();

  private final Map<UUID, Votes> voteValues = new HashMap<>();
  private final Set<UUID> loadedVotes = new HashSet<>();

  private final Map<UUID, Object> extensionValues = new HashMap<>();
  private final Set<UUID> loadedExtensions = new HashSet<>();

  void putRelations(UUID entityId, String field, Include include, List<EntityReference> refs) {
    Include normalizedInclude = normalize(include);
    RelationKey key = new RelationKey(entityId, field, normalizedInclude);
    loadedRelations.add(key);
    relationValues.put(key, refs == null ? Collections.emptyList() : List.copyOf(refs));
    loadedRelationIncludesByField
        .computeIfAbsent(entityId, ignored -> new HashMap<>())
        .computeIfAbsent(field, ignored -> new HashSet<>())
        .add(normalizedInclude);
  }

  Optional<List<EntityReference>> getRelations(UUID entityId, String field, Include include) {
    RelationKey key = new RelationKey(entityId, field, normalize(include));
    if (!loadedRelations.contains(key)) {
      return Optional.empty();
    }
    return Optional.of(relationValues.getOrDefault(key, Collections.emptyList()));
  }

  boolean hasLoadedRelationForField(UUID entityId, String field) {
    Map<String, Set<Include>> includesByField = loadedRelationIncludesByField.get(entityId);
    return includesByField != null && includesByField.containsKey(field);
  }

  Set<Include> getLoadedIncludesForField(UUID entityId, String field) {
    Map<String, Set<Include>> includesByField = loadedRelationIncludesByField.get(entityId);
    if (includesByField == null) {
      return Collections.emptySet();
    }
    Set<Include> includes = includesByField.get(field);
    return includes == null ? Collections.emptySet() : Set.copyOf(includes);
  }

  void putTags(UUID entityId, List<TagLabel> tags) {
    loadedTags.add(entityId);
    tagValues.put(entityId, tags == null ? Collections.emptyList() : List.copyOf(tags));
  }

  Optional<List<TagLabel>> getTags(UUID entityId) {
    if (!loadedTags.contains(entityId)) {
      return Optional.empty();
    }
    return Optional.of(tagValues.getOrDefault(entityId, Collections.emptyList()));
  }

  void putVotes(UUID entityId, Votes votes) {
    loadedVotes.add(entityId);
    voteValues.put(entityId, votes == null ? new Votes() : votes);
  }

  Optional<Votes> getVotes(UUID entityId) {
    if (!loadedVotes.contains(entityId)) {
      return Optional.empty();
    }
    return Optional.of(voteValues.getOrDefault(entityId, new Votes()));
  }

  void putExtension(UUID entityId, Object extension) {
    loadedExtensions.add(entityId);
    extensionValues.put(entityId, extension);
  }

  boolean hasExtension(UUID entityId) {
    return loadedExtensions.contains(entityId);
  }

  Object getExtensionOrNull(UUID entityId) {
    return extensionValues.get(entityId);
  }

  private Include normalize(Include include) {
    return include == null ? ALL : include;
  }

  private record RelationKey(UUID entityId, String field, Include include) {}
}
