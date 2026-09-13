package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Selection;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/** Applies recorded reference differences without changing the owning mutation's transaction. */
public final class EntityRelationshipUpdates {
  public interface Session {
    boolean recordReferenceChanges(String field, ListChange<EntityReference> values);

    boolean recordReferenceChange(String field, EntityReference original, EntityReference updated);
  }

  public record Target(
      String field, UUID id, String type, String relatedType, Relationship relation) {
    private Selection selection() {
      return new Selection(id, type, relation, relatedType);
    }
  }

  public record References(List<EntityReference> original, List<EntityReference> updated) {
    private ListChange<EntityReference> changes() {
      return new ListChange<>(
          original, updated, new ArrayList<>(), new ArrayList<>(), entityReferenceMatch);
    }
  }

  private static final Comparator<EntityReference> REFERENCE_ORDER =
      Comparator.comparing(EntityReference::getName, Comparator.nullsLast(String::compareTo))
          .thenComparing(EntityReference::getType, Comparator.nullsLast(String::compareTo))
          .thenComparing(EntityReference::getId, Comparator.nullsLast(UUID::compareTo));

  private final Supplier<EntityRelationshipDAO> relationships;
  private final EntityRelationshipWriter writer;

  public EntityRelationshipUpdates(
      final Supplier<EntityRelationshipDAO> relationships, final EntityRelationshipWriter writer) {
    this.relationships = relationships;
    this.writer = writer;
  }

  public void outgoing(
      final Session session,
      final Target target,
      final References references,
      final boolean bidirectional) {
    final ListChange<EntityReference> changes = references.changes();
    if (session.recordReferenceChanges(target.field(), changes)) {
      removeOutgoing(target, changes.deleted(), bidirectional);
      addOutgoing(target, changes.added(), bidirectional);
      sortReferences(references.updated());
      sortReferences(references.original());
    }
  }

  private void removeOutgoing(
      final Target target, final List<EntityReference> deleted, final boolean bidirectional) {
    if (!deleted.isEmpty()) {
      idsByType(deleted)
          .forEach(
              (type, ids) -> {
                relationships
                    .get()
                    .bulkRemoveToRelationship(
                        target.id(), ids, target.type(), type, target.relation().ordinal());
                if (bidirectional) {
                  relationships
                      .get()
                      .bulkRemoveFromRelationship(
                          ids, target.id(), type, target.type(), target.relation().ordinal());
                }
              });
    }
  }

  private void addOutgoing(
      final Target target, final List<EntityReference> added, final boolean bidirectional) {
    if (!added.isEmpty()) {
      if (bidirectional) {
        writer.insertMany(
            added.stream().map(reference -> symmetricRow(target, reference)).toList());
      } else {
        final List<UUID> ids = added.stream().map(EntityReference::getId).toList();
        relationships
            .get()
            .bulkInsertToRelationship(
                target.id(), ids, target.type(), target.relatedType(), target.relation().ordinal());
      }
    }
  }

  private EntityRelationshipObject symmetricRow(
      final Target target, final EntityReference reference) {
    return target.id().compareTo(reference.getId()) > 0
        ? EntityRelationshipWriter.row(
            reference.getId(), target.id(), reference.getType(), target.type(), target.relation())
        : EntityRelationshipWriter.row(
            target.id(), reference.getId(), target.type(), reference.getType(), target.relation());
  }

  public void incoming(final Session session, final Target target, final References references) {
    final ListChange<EntityReference> changes = references.changes();
    if (session.recordReferenceChanges(target.field(), changes)) {
      removeIncoming(target, changes.deleted());
      addIncoming(target, changes.added());
      sortReferences(references.updated());
      sortReferences(references.original());
    }
  }

  private void removeIncoming(final Target target, final List<EntityReference> deleted) {
    if (!deleted.isEmpty()) {
      idsByType(deleted)
          .forEach(
              (type, ids) ->
                  relationships
                      .get()
                      .bulkRemoveFromRelationship(
                          ids, target.id(), type, target.type(), target.relation().ordinal()));
    }
  }

  private void addIncoming(final Target target, final List<EntityReference> added) {
    if (!added.isEmpty()) {
      writer.insertMany(
          added.stream()
              .map(
                  reference ->
                      EntityRelationshipWriter.row(
                          reference.getId(),
                          target.id(),
                          reference.getType(),
                          target.type(),
                          target.relation()))
              .toList());
    }
  }

  private Map<String, List<UUID>> idsByType(final List<EntityReference> references) {
    return references.stream()
        .collect(
            Collectors.groupingBy(
                EntityReference::getType,
                Collectors.mapping(EntityReference::getId, Collectors.toList())));
  }

  private void sortReferences(final List<EntityReference> references) {
    if (!nullOrEmpty(references) && references.size() > 1) {
      final List<EntityReference> sorted = new ArrayList<>(references);
      sorted.sort(REFERENCE_ORDER);
      try {
        references.clear();
        references.addAll(sorted);
      } catch (UnsupportedOperationException ignored) {
        // Read bundles expose immutable snapshots; ordering must not mutate those shared lists.
      }
    }
  }

  public void outgoingSingle(
      final Session session,
      final Target target,
      final EntityReference original,
      final EntityReference updated,
      final boolean bidirectional) {
    if (session.recordReferenceChange(target.field(), original, updated)) {
      writer.deleteOutgoing(target.selection());
      if (bidirectional) {
        writer.deleteIncoming(target.selection());
      }
      if (updated != null) {
        writer.add(
            new Edge(
                target.id(),
                updated.getId(),
                target.type(),
                target.relatedType(),
                target.relation()),
            Value.EMPTY,
            bidirectional);
      }
    }
  }

  public void incomingSingle(
      final Session session,
      final Target target,
      final EntityReference original,
      final EntityReference updated) {
    if (session.recordReferenceChange(target.field(), original, updated)) {
      writer.deleteIncoming(target.selection());
      if (updated != null) {
        writer.add(
            new Edge(
                updated.getId(),
                target.id(),
                target.relatedType(),
                target.type(),
                target.relation()),
            Value.EMPTY,
            false);
      }
    }
  }
}
