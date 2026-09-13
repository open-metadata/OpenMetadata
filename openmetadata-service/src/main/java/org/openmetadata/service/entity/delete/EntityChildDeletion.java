package org.openmetadata.service.entity.delete;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

/** Enforces recursive deletion and preserves entity-specific shared-child policies. */
@Slf4j
public final class EntityChildDeletion {
  @FunctionalInterface
  public interface Preparation {
    List<EntityRelationshipRecord> prepare(
        UUID parent, List<EntityRelationshipRecord> children, String actor);
  }

  @FunctionalInterface
  public interface Deletion {
    void delete(List<EntityRelationshipRecord> children, boolean hardDelete, String actor);
  }

  public record Hooks(Preparation preparation, Deletion deletion) {}

  private static final List<Integer> CHILD_RELATIONS =
      List.of(Relationship.CONTAINS.ordinal(), Relationship.PARENT_OF.ordinal());

  private final String entityType;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final Hooks hooks;

  public EntityChildDeletion(
      final String entityType,
      final Supplier<EntityRelationshipDAO> relationships,
      final Hooks hooks) {
    this.entityType = entityType;
    this.relationships = relationships;
    this.hooks = hooks;
  }

  public void delete(final UUID parent, final EntityDeletionService.Request request) {
    final var children = relationships.get().findTo(parent, entityType, CHILD_RELATIONS);
    if (children.isEmpty()) {
      LOG.debug("No children to delete for {} {}", entityType, parent);
    } else {
      deleteContained(parent, children, request);
    }
  }

  private void deleteContained(
      final UUID parent,
      final List<EntityRelationshipRecord> children,
      final EntityDeletionService.Request request) {
    LOG.info(
        "Found {} children for {} {} (recursive={}, hardDelete={})",
        children.size(),
        entityType,
        parent,
        request.recursive(),
        request.hardDelete());
    if (!request.recursive()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.entityIsNotEmpty(entityType));
    }
    final var prepared =
        request.hardDelete()
            ? hooks.preparation().prepare(parent, children, request.actor())
            : children;
    deletePrepared(parent, prepared, request);
  }

  private void deletePrepared(
      final UUID parent,
      final List<EntityRelationshipRecord> children,
      final EntityDeletionService.Request request) {
    if (children.isEmpty()) {
      LOG.debug(
          "No children to delete for {} {} after hard-delete preparation", entityType, parent);
    } else {
      hooks.deletion().delete(children, request.hardDelete(), request.actor());
    }
  }
}
