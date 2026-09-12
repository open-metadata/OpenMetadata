package org.openmetadata.service.entity.delete;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Removes tasks and announcements before their MENTIONED_IN relationships disappear. */
@Slf4j
public final class EntityFeedCleanup {
  public record Artifact(String type, Supplier<? extends EntityDAO<?>> rows) {}

  private final String entityType;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final List<Artifact> artifacts;

  public EntityFeedCleanup(
      final String entityType,
      final Supplier<EntityRelationshipDAO> relationships,
      final List<Artifact> artifacts) {
    this.entityType = entityType;
    this.relationships = relationships;
    this.artifacts = List.copyOf(artifacts);
  }

  public void remove(final UUID entityId) {
    artifacts.forEach(artifact -> remove(entityId, artifact));
  }

  public void removeMany(final List<UUID> entityIds) {
    artifacts.forEach(artifact -> removeMany(entityIds, artifact));
  }

  private void remove(final UUID entityId, final Artifact artifact) {
    final EntityDAO<?> rows = artifact.rows().get();
    try {
      final var references =
          relationships
              .get()
              .findTo(entityId, entityType, Relationship.MENTIONED_IN.ordinal(), artifact.type());
      for (final var reference : references) {
        relationships.get().deleteAll(reference.getId(), artifact.type());
        rows.delete(reference.getId());
      }
    } catch (Exception exception) {
      // Feed cleanup has always been best effort: a broken artifact cannot block entity deletion.
      LOG.warn("Failed to delete {} about {} {}", artifact.type(), entityType, entityId, exception);
    }
  }

  private void removeMany(final List<UUID> entityIds, final Artifact artifact) {
    final EntityDAO<?> rows = artifact.rows().get();
    try {
      final List<String> fromIds = entityIds.stream().map(UUID::toString).toList();
      final var references =
          relationships
              .get()
              .findToBatch(
                  fromIds, Relationship.MENTIONED_IN.ordinal(), entityType, artifact.type());
      if (!references.isEmpty()) {
        final List<UUID> ids =
            references.stream().map(reference -> UUID.fromString(reference.getToId())).toList();
        relationships.get().batchDeleteRelationships(ids, artifact.type());
        rows.deleteByIds(ids);
      }
    } catch (Exception exception) {
      LOG.warn(
          "Failed to bulk delete {} about {} {} entities",
          artifact.type(),
          entityType,
          entityIds.size(),
          exception);
    }
  }
}
