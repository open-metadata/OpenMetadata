package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/** Persists relationship rows through the retained DAO and existing RDF/cache effect boundaries. */
public final class EntityRelationshipWriter {
  public record Edge(
      UUID fromId, UUID toId, String fromType, String toType, Relationship relation) {
    private Edge reverse() {
      return new Edge(toId, fromId, toType, fromType, relation);
    }

    private EntityRelationship rdf() {
      return new EntityRelationship()
          .withFromId(fromId)
          .withToId(toId)
          .withFromEntity(fromType)
          .withToEntity(toType)
          .withRelationshipType(relation);
    }
  }

  public record Value(String relationType, String json) {
    public static final Value EMPTY = new Value("", null);
  }

  public record Selection(UUID id, String type, Relationship relation, String relatedType) {}

  public record Batch(
      UUID id, List<UUID> relatedIds, String type, String relatedType, Relationship relation) {}

  public record BatchSelection(
      List<UUID> ids, String type, Relationship relation, String relatedType) {}

  public record Effects(
      Consumer<EntityRelationship> add,
      Consumer<EntityRelationship> remove,
      BiConsumer<String, UUID> invalidate) {}

  private static final Comparator<EntityRelationshipObject> INSERT_ORDER =
      Comparator.comparing(
              EntityRelationshipObject::getFromId, Comparator.nullsLast(String::compareTo))
          .thenComparing(EntityRelationshipObject::getToId, Comparator.nullsLast(String::compareTo))
          .thenComparingInt(EntityRelationshipObject::getRelation)
          .thenComparing(
              EntityRelationshipObject::getFromEntity, Comparator.nullsLast(String::compareTo))
          .thenComparing(
              EntityRelationshipObject::getToEntity, Comparator.nullsLast(String::compareTo));

  private final Supplier<EntityRelationshipDAO> relationships;
  private final Effects effects;
  private static final int DELETE_BATCH_SIZE = 500;

  public EntityRelationshipWriter(
      final Supplier<EntityRelationshipDAO> relationships, final Effects effects) {
    this.relationships = relationships;
    this.effects = effects;
  }

  public void add(final Edge edge, final Value value, final boolean bidirectional) {
    insert(edge, value, bidirectional);
    effects.add().accept(edge.rdf());
    if (bidirectional) {
      effects.add().accept(edge.reverse().rdf());
    }
    invalidate(edge);
  }

  private void insert(final Edge edge, final Value value, final boolean bidirectional) {
    final boolean reverse = bidirectional && edge.fromId().compareTo(edge.toId()) > 0;
    // Single-row inserts historically order only the IDs; bulk symmetric inserts also swap types.
    relationships
        .get()
        .insert(
            reverse ? edge.toId() : edge.fromId(),
            reverse ? edge.fromId() : edge.toId(),
            edge.fromType(),
            edge.toType(),
            edge.relation().ordinal(),
            value.relationType() == null ? "" : value.relationType(),
            value.json());
  }

  public void delete(final Edge edge) {
    relationships
        .get()
        .delete(
            edge.fromId(), edge.fromType(), edge.toId(), edge.toType(), edge.relation().ordinal());
    effects.remove().accept(edge.rdf());
    invalidate(edge);
  }

  private void invalidate(final Edge edge) {
    effects.invalidate().accept(edge.fromType(), edge.fromId());
    effects.invalidate().accept(edge.toType(), edge.toId());
  }

  public void addMany(final Batch batch) {
    relationships
        .get()
        .bulkInsertToRelationship(
            batch.id(),
            batch.relatedIds(),
            batch.type(),
            batch.relatedType(),
            batch.relation().ordinal());
    invalidate(batch);
  }

  public void removeMany(final Batch batch) {
    relationships
        .get()
        .bulkRemoveToRelationship(
            batch.id(),
            batch.relatedIds(),
            batch.type(),
            batch.relatedType(),
            batch.relation().ordinal());
    invalidate(batch);
  }

  private void invalidate(final Batch batch) {
    effects.invalidate().accept(batch.type(), batch.id());
    if (batch.relatedIds() != null) {
      batch.relatedIds().forEach(id -> effects.invalidate().accept(batch.relatedType(), id));
    }
  }

  public void deleteIncoming(final Selection selection) {
    if (selection.relatedType() == null) {
      relationships
          .get()
          .deleteTo(selection.id(), selection.type(), selection.relation().ordinal());
    } else {
      relationships
          .get()
          .deleteTo(
              selection.id(),
              selection.type(),
              selection.relation().ordinal(),
              selection.relatedType());
    }
  }

  public void deleteOutgoing(final Selection selection) {
    relationships
        .get()
        .deleteFrom(
            selection.id(),
            selection.type(),
            selection.relation().ordinal(),
            selection.relatedType());
  }

  public void deleteIncomingMany(final BatchSelection selection) {
    deleteMany(selection, ids -> deleteIncoming(selection, ids));
  }

  public void deleteOutgoingMany(final BatchSelection selection) {
    deleteMany(selection, ids -> deleteOutgoing(selection, ids));
  }

  private void deleteMany(final BatchSelection selection, final Consumer<List<String>> delete) {
    final List<UUID> ids = selection.ids();
    for (int start = 0; start < ids.size(); start += DELETE_BATCH_SIZE) {
      delete.accept(
          ids.subList(start, Math.min(start + DELETE_BATCH_SIZE, ids.size())).stream()
              .map(UUID::toString)
              .toList());
    }
  }

  private void deleteIncoming(final BatchSelection selection, final List<String> ids) {
    if (selection.relatedType() == null) {
      relationships.get().deleteToMany(ids, selection.type(), selection.relation().ordinal());
    } else {
      relationships
          .get()
          .deleteToMany(
              ids, selection.type(), selection.relation().ordinal(), selection.relatedType());
    }
  }

  private void deleteOutgoing(final BatchSelection selection, final List<String> ids) {
    if (selection.relatedType() == null) {
      relationships.get().deleteFromMany(ids, selection.type(), selection.relation().ordinal());
    } else {
      relationships
          .get()
          .deleteFromMany(
              ids, selection.type(), selection.relation().ordinal(), selection.relatedType());
    }
  }

  public void insertMany(final List<EntityRelationshipObject> rows) {
    if (!nullOrEmpty(rows)) {
      // Stable row order reduces conflicting lock acquisition across concurrent mutations.
      final List<EntityRelationshipObject> ordered = new ArrayList<>(rows);
      ordered.sort(INSERT_ORDER);
      relationships.get().bulkInsertTo(ordered);
    }
  }

  public static EntityRelationshipObject row(
      final UUID fromId,
      final UUID toId,
      final String fromType,
      final String toType,
      final Relationship relation) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity(fromType)
        .toEntity(toType)
        .relation(relation.ordinal())
        .build();
  }
}
