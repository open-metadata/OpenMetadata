package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/** Resolves batch references for entity-specific and fallback relationship projections. */
@Slf4j
public final class EntityBatchReferenceReader {
  @FunctionalInterface
  public interface References {
    List<EntityReference> get(String type, List<UUID> ids, Include include);
  }

  private enum Direction {
    INCOMING,
    OUTGOING;

    String entityId(final EntityRelationshipObject row) {
      return this == INCOMING ? row.getToId() : row.getFromId();
    }

    String referenceId(final EntityRelationshipObject row) {
      return this == INCOMING ? row.getFromId() : row.getToId();
    }
  }

  private final Supplier<EntityRelationshipDAO> relationships;
  private final References references;

  public EntityBatchReferenceReader(
      final Supplier<EntityRelationshipDAO> relationships, final References references) {
    this.relationships = relationships;
    this.references = references;
  }

  public Map<UUID, List<EntityReference>> incoming(
      final List<? extends EntityInterface> entities,
      final Relationship relationship,
      final String relatedType) {
    return nullOrEmpty(entities)
        ? new HashMap<>()
        : group(
            relationships
                .get()
                .findFromBatch(entityIds(entities), relationship.ordinal(), relatedType, ALL),
            relatedType,
            Direction.INCOMING);
  }

  public Map<UUID, List<EntityReference>> outgoing(
      final List<? extends EntityInterface> entities,
      final Relationship relationship,
      final String relatedType) {
    return nullOrEmpty(entities)
        ? new HashMap<>()
        : group(
            relationships
                .get()
                .findToBatch(entityIds(entities), relationship.ordinal(), relatedType, ALL),
            relatedType,
            Direction.OUTGOING);
  }

  public Map<UUID, List<EntityReference>> children(
      final List<? extends EntityInterface> entities, final String entityType) {
    if (nullOrEmpty(entities)) {
      return new HashMap<>();
    }
    final List<EntityRelationshipObject> rows =
        relationships
            .get()
            .findToBatch(entityIds(entities), Relationship.CONTAINS.ordinal(), entityType, ALL);
    return nullOrEmpty(rows)
        ? new HashMap<>()
        : group(rows, rows.getFirst().getToEntity(), Direction.OUTGOING);
  }

  private Map<UUID, List<EntityReference>> group(
      final List<EntityRelationshipObject> rows,
      final String relatedType,
      final Direction direction) {
    final List<UUID> ids =
        rows.stream().map(row -> UUID.fromString(direction.referenceId(row))).distinct().toList();
    final Map<String, EntityReference> found =
        references.get(relatedType, ids, ALL).stream()
            .collect(
                Collectors.toMap(reference -> reference.getId().toString(), Function.identity()));
    final Map<UUID, List<EntityReference>> result = new HashMap<>();
    for (final EntityRelationshipObject row : rows) {
      final UUID id = UUID.fromString(direction.entityId(row));
      final EntityReference reference = found.get(direction.referenceId(row));
      if (reference != null) {
        result.computeIfAbsent(id, ignored -> new ArrayList<>()).add(reference);
      }
    }
    return result;
  }

  public Map<UUID, EntityReference> singleIncoming(
      final List<? extends EntityInterface> entities, final Relationship relationship) {
    if (nullOrEmpty(entities)) {
      return new HashMap<>();
    }
    final List<EntityRelationshipObject> rows =
        relationships.get().findFromBatch(entityIds(entities), relationship.ordinal(), ALL);
    final Map<String, EntityReference> found = resolveByType(rows);
    final Map<UUID, EntityReference> result = new HashMap<>();
    for (final EntityRelationshipObject row : rows) {
      final UUID id = UUID.fromString(row.getToId());
      final EntityReference reference = found.get(row.getFromId());
      if (reference != null) {
        result.put(id, reference);
      }
    }
    return result;
  }

  private Map<String, EntityReference> resolveByType(final List<EntityRelationshipObject> rows) {
    final Map<String, List<String>> idsByType =
        rows.stream()
            .collect(
                Collectors.groupingBy(
                    EntityRelationshipObject::getFromEntity,
                    Collectors.mapping(EntityRelationshipObject::getFromId, Collectors.toList())));
    final Map<String, EntityReference> result = new HashMap<>();
    idsByType.forEach(
        (type, ids) ->
            references
                .get(type, ids.stream().map(UUID::fromString).distinct().toList(), ALL)
                .forEach(reference -> result.put(reference.getId().toString(), reference)));
    return result;
  }

  private List<String> entityIds(final List<? extends EntityInterface> entities) {
    return entities.stream().map(entity -> entity.getId().toString()).toList();
  }

  public Map<UUID, EntityReference> containers(
      final List<? extends EntityInterface> entities,
      final String parentType,
      final Include include) {
    if (nullOrEmpty(entities)) {
      return new HashMap<>();
    }
    final List<String> ids = entityIds(entities);
    final List<EntityRelationshipObject> rows =
        parentType == null
            ? relationships.get().findFromBatch(ids, Relationship.CONTAINS.ordinal(), include)
            : relationships
                .get()
                .findFromBatch(ids, Relationship.CONTAINS.ordinal(), parentType, include);
    return nullOrEmpty(rows) ? new HashMap<>() : resolveContainers(rows, include);
  }

  private Map<UUID, EntityReference> resolveContainers(
      final List<EntityRelationshipObject> rows, final Include include) {
    final Map<String, Map<UUID, EntityReference>> found = containerReferences(rows, include);
    final Map<UUID, EntityReference> result = new HashMap<>();
    for (final EntityRelationshipObject row : rows) {
      if (hasContainerIdentity(row) && row.getToId() != null) {
        final Map<UUID, EntityReference> type = found.get(row.getFromEntity());
        final EntityReference parent =
            type == null ? null : type.get(UUID.fromString(row.getFromId()));
        if (parent != null) {
          result.putIfAbsent(UUID.fromString(row.getToId()), parent);
        }
      }
    }
    return result;
  }

  private Map<String, Map<UUID, EntityReference>> containerReferences(
      final List<EntityRelationshipObject> rows, final Include include) {
    final Map<String, Set<UUID>> ids = containerIds(rows);
    final Map<String, Map<UUID, EntityReference>> result = new HashMap<>();
    ids.forEach(
        (type, values) ->
            result.put(
                type,
                references.get(type, new ArrayList<>(values), include).stream()
                    .collect(Collectors.toMap(EntityReference::getId, Function.identity()))));
    return result;
  }

  private Map<String, Set<UUID>> containerIds(final List<EntityRelationshipObject> rows) {
    final Map<String, Set<UUID>> ids = new HashMap<>();
    for (final EntityRelationshipObject row : rows) {
      if (hasContainerIdentity(row)) {
        ids.computeIfAbsent(row.getFromEntity(), ignored -> new HashSet<>())
            .add(UUID.fromString(row.getFromId()));
      }
    }
    return ids;
  }

  private boolean hasContainerIdentity(final EntityRelationshipObject row) {
    return row.getFromEntity() != null && row.getFromId() != null;
  }

  public Map<UUID, EntityReference> inheritanceParents(
      final List<? extends EntityInterface> entities, final String entityType) {
    final Map<UUID, EntityReference> parents = new HashMap<>();
    if (!nullOrEmpty(entities)) {
      final List<EntityRelationshipObject> rows =
          relationships
              .get()
              .findFromBatch(
                  entityIds(entities), Relationship.CONTAINS.ordinal(), Include.NON_DELETED);
      final Set<UUID> warned = new HashSet<>();
      for (final EntityRelationshipObject row : rows) {
        if (row.getToId() != null
            && !nullOrEmpty(row.getFromEntity())
            && !nullOrEmpty(row.getFromId())) {
          addInheritanceParent(parents, warned, row, entityType);
        }
      }
    }
    return parents;
  }

  private void addInheritanceParent(
      final Map<UUID, EntityReference> parents,
      final Set<UUID> warned,
      final EntityRelationshipObject row,
      final String entityType) {
    final UUID id = UUID.fromString(row.getToId());
    final EntityReference parent =
        new EntityReference()
            .withId(UUID.fromString(row.getFromId()))
            .withType(row.getFromEntity());
    if (parents.putIfAbsent(id, parent) != null && warned.add(id)) {
      LOG.warn(
          "{} {} has multiple live CONTAINS parents; inheriting from the first "
              + "(possible duplicate/stale relationship rows)",
          entityType,
          id);
    }
  }
}
