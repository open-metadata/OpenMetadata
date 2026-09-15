package org.openmetadata.service.entity.delete;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;

/** Deletes dependent metadata through DAOs bound to the caller's deletion transaction. */
public final class EntityDependentCleanup<T extends EntityInterface> {
  public record Rows(
      Supplier<EntityRelationshipDAO> relationships,
      Supplier<FieldRelationshipDAO> fieldRelationships,
      Supplier<EntityExtensionDAO> extensions,
      Supplier<TagUsageDAO> tags,
      Supplier<UsageDAO> usage) {}

  public record Policy(
      BooleanSupplier cleanupFqnDependents, BooleanSupplier ancestorCoversDescendants) {}

  private record Identifiers(List<UUID> ids, List<String> strings) {
    private static Identifiers of(final List<? extends EntityInterface> entities) {
      final List<UUID> ids = new ArrayList<>(entities.size());
      final List<String> strings = new ArrayList<>(entities.size());
      for (final EntityInterface entity : entities) {
        ids.add(entity.getId());
        strings.add(entity.getId().toString());
      }
      return new Identifiers(ids, strings);
    }
  }

  private final String entityType;
  private final Rows rows;
  private final Policy policy;
  private final EntityFeedCleanup feed;
  private final Consumer<List<UUID>> conversations;

  public EntityDependentCleanup(
      final String entityType,
      final Rows rows,
      final Policy policy,
      final EntityFeedCleanup feed,
      final Consumer<List<UUID>> conversations) {
    this.entityType = entityType;
    this.rows = rows;
    this.policy = policy;
    this.feed = feed;
    this.conversations = conversations;
  }

  public void remove(final T entity) {
    final UUID id = entity.getId();
    feed.remove(id);
    rows.relationships().get().deleteAll(id, entityType);
    if (policy.cleanupFqnDependents().getAsBoolean()) {
      rows.fieldRelationships().get().deleteAllByPrefix(entity.getFullyQualifiedName());
    }
    // deleteAll includes custom properties; per-property deletes would repeat this work.
    rows.extensions().get().deleteAll(id);
    if (policy.cleanupFqnDependents().getAsBoolean()) {
      removeTags(entity.getFullyQualifiedName());
    }
    rows.usage().get().delete(id);
    conversations.accept(List.of(id));
  }

  public void removeMany(final List<T> entities) {
    final Identifiers ids = Identifiers.of(entities);
    removeIdDependencies(ids);
    removeFqnDependencies(entities);
    removeUsageAndConversations(ids.ids());
  }

  private void removeIdDependencies(final Identifiers ids) {
    try (var ignored = phase("bulkHardDeleteFeedArtifacts")) {
      feed.removeMany(ids.ids());
    }
    try (var ignored = phase("bulkHardDeleteRelationships")) {
      rows.relationships().get().batchDeleteRelationships(ids.ids(), entityType);
    }
    try (var ignored = phase("bulkHardDeleteExtensions")) {
      rows.extensions().get().deleteAllBatch(ids.strings());
    }
  }

  private void removeFqnDependencies(final List<T> entities) {
    if (policy.cleanupFqnDependents().getAsBoolean()
        && !policy.ancestorCoversDescendants().getAsBoolean()) {
      try (var ignored = phase("bulkHardDeleteFqnDependents")) {
        for (final T entity : entities) {
          rows.fieldRelationships().get().deleteAllByPrefix(entity.getFullyQualifiedName());
          removeTags(entity.getFullyQualifiedName());
        }
      }
    }
  }

  private void removeTags(final String fqn) {
    rows.tags().get().deleteTagLabelsByTargetPrefix(fqn);
    rows.tags().get().deleteTagLabelsByFqn(fqn);
  }

  private void removeUsageAndConversations(final List<UUID> ids) {
    try (var ignored = phase("bulkHardDeleteUsage")) {
      rows.usage().get().deleteByIds(ids);
    }
    try (var ignored = phase("bulkHardDeleteConversations")) {
      conversations.accept(ids);
    }
  }
}
