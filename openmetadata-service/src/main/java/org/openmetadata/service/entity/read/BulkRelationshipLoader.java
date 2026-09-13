package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.read.BulkRelationshipField.Value;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Resolves only requested references, sharing each type's lookup across both edge directions. */
public final class BulkRelationshipLoader {
  private final String entityType;
  private final List<BulkRelationshipField> supportedFields;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final ReferenceSource references;

  public record ReferenceSource(
      Predicate<String> supportsType, BiFunction<String, List<UUID>, List<EntityReference>> load) {}

  private record Identity(String type, UUID id) {}

  private record Assignment(
      BulkRelationshipField field, UUID entityId, Identity reference, String json) {}

  public BulkRelationshipLoader(
      String entityType,
      List<BulkRelationshipField> fields,
      Supplier<EntityRelationshipDAO> relationships,
      ReferenceSource references) {
    this.entityType = entityType;
    this.supportedFields = List.copyOf(fields);
    this.relationships = relationships;
    this.references = references;
  }

  public Set<String> load(List<? extends EntityInterface> entities, Fields fields) {
    if (nullOrEmpty(entities) || fields == null) {
      return Set.of();
    }
    final List<BulkRelationshipField> requested =
        supportedFields.stream().filter(field -> fields.contains(field.name())).toList();
    final List<Assignment> assignments = readAssignments(entities, requested);
    final Map<Identity, EntityReference> loaded = loadReferences(assignments);
    assignFields(entities, requested, groupValues(assignments, loaded));
    return requested.stream()
        .map(BulkRelationshipField::name)
        .collect(Collectors.toUnmodifiableSet());
  }

  private List<Assignment> readAssignments(
      List<? extends EntityInterface> entities, List<BulkRelationshipField> fields) {
    final List<Assignment> assignments = new ArrayList<>();
    if (!fields.isEmpty()) {
      final List<String> ids = entities.stream().map(entity -> entity.getId().toString()).toList();
      collectAssignments(ids, fields, true, assignments);
      collectAssignments(ids, fields, false, assignments);
    }
    return assignments;
  }

  private void collectAssignments(
      List<String> ids,
      List<BulkRelationshipField> fields,
      boolean incoming,
      List<Assignment> assignments) {
    final Map<Integer, List<BulkRelationshipField>> byRelation =
        fields.stream()
            .filter(field -> field.selection().incoming() == incoming)
            .collect(Collectors.groupingBy(field -> field.selection().relationship().ordinal()));
    if (!byRelation.isEmpty()) {
      final List<Integer> ordinals = List.copyOf(byRelation.keySet());
      final List<EntityRelationshipObject> records =
          incoming
              ? relationships.get().findFromBatchWithRelations(ids, entityType, ordinals, ALL)
              : relationships.get().findToBatchWithRelations(ids, entityType, ordinals, ALL);
      for (final EntityRelationshipObject record : records) {
        collectAssignments(
            record,
            byRelation.getOrDefault(record.getRelation(), List.of()),
            incoming,
            assignments);
      }
    }
  }

  private void collectAssignments(
      EntityRelationshipObject record,
      List<BulkRelationshipField> fields,
      boolean incoming,
      List<Assignment> assignments) {
    final String relatedType = incoming ? record.getFromEntity() : record.getToEntity();
    final String relatedId = incoming ? record.getFromId() : record.getToId();
    if (nullOrEmpty(relatedType)
        || nullOrEmpty(relatedId)
        || !references.supportsType().test(relatedType)) {
      return;
    }
    for (final BulkRelationshipField field : fields) {
      if (field.selection().relatedType() == null
          || field.selection().relatedType().equals(relatedType)) {
        final UUID entityId = UUID.fromString(incoming ? record.getToId() : record.getFromId());
        assignments.add(
            new Assignment(
                field,
                entityId,
                new Identity(relatedType, UUID.fromString(relatedId)),
                record.getJson()));
      }
    }
  }

  private Map<Identity, EntityReference> loadReferences(List<Assignment> assignments) {
    final Map<String, Set<UUID>> idsByType = new HashMap<>();
    assignments.forEach(
        assignment ->
            idsByType
                .computeIfAbsent(assignment.reference().type(), ignored -> new LinkedHashSet<>())
                .add(assignment.reference().id()));
    final Map<Identity, EntityReference> loaded = new HashMap<>();
    idsByType.forEach(
        (type, ids) ->
            references
                .load()
                .apply(type, List.copyOf(ids))
                .forEach(
                    reference ->
                        loaded.putIfAbsent(new Identity(type, reference.getId()), reference)));
    return loaded;
  }

  private Map<BulkRelationshipField, Map<UUID, List<Value>>> groupValues(
      List<Assignment> assignments, Map<Identity, EntityReference> references) {
    final Map<BulkRelationshipField, Map<UUID, List<Value>>> values = new HashMap<>();
    for (final Assignment assignment : assignments) {
      final EntityReference reference = references.get(assignment.reference());
      if (reference != null) {
        values
            .computeIfAbsent(assignment.field(), ignored -> new HashMap<>())
            .computeIfAbsent(assignment.entityId(), ignored -> new ArrayList<>())
            .add(new Value(RelatedEntityResolver.copyReference(reference), assignment.json()));
      }
    }
    return values;
  }

  private void assignFields(
      List<? extends EntityInterface> entities,
      List<BulkRelationshipField> fields,
      Map<BulkRelationshipField, Map<UUID, List<Value>>> values) {
    for (final BulkRelationshipField field : fields) {
      final Map<UUID, List<Value>> byEntity = values.getOrDefault(field, Map.of());
      entities.forEach(
          entity ->
              field.assign().accept(entity, byEntity.getOrDefault(entity.getId(), List.of())));
    }
  }
}
