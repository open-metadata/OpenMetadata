package org.openmetadata.service.entity.delete;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

/** Groups CONTAINS/PARENT_OF children once per level and dispatches to typed subtree services. */
public final class EntityHierarchy<T extends EntityInterface> {
  public enum Action {
    RESTORE("bulkRestoreFindChildren"),
    SOFT_DELETE("bulkSoftDeleteFindChildren"),
    HARD_DELETE("bulkHardDeleteFindChildren");

    private final String phaseName;

    Action(final String phaseName) {
      this.phaseName = phaseName;
    }

    private void apply(final EntitySubtree subtree, final List<UUID> ids, final String actor) {
      switch (this) {
        case RESTORE -> subtree.bulkRestoreSubtree(ids, actor);
        case SOFT_DELETE -> subtree.bulkSoftDeleteSubtree(ids, actor);
        case HARD_DELETE -> subtree.bulkHardDeleteSubtree(ids, actor);
      }
    }
  }

  public record Registry(Function<String, EntitySubtree> subtree, Predicate<String> isTimeSeries) {}

  @FunctionalInterface
  public interface HardDeletePolicy<T> {
    List<EntityRelationshipObject> prepare(
        List<T> parents, List<EntityRelationshipObject> children, String actor);
  }

  private static final List<Integer> SUBTREE_RELATIONS =
      List.of(Relationship.CONTAINS.ordinal(), Relationship.PARENT_OF.ordinal());

  private final String entityType;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final Registry registry;
  private final HardDeletePolicy<T> hardDeletePolicy;

  public EntityHierarchy(
      final String entityType,
      final Supplier<EntityRelationshipDAO> relationships,
      final Registry registry,
      final HardDeletePolicy<T> hardDeletePolicy) {
    this.entityType = entityType;
    this.relationships = relationships;
    this.registry = registry;
    this.hardDeletePolicy = hardDeletePolicy;
  }

  public void restoreChildren(final UUID parentId, final String actor) {
    final var children = relationships.get().findTo(parentId, entityType, SUBTREE_RELATIONS);
    groupRecordsByType(children)
        .forEach((type, ids) -> registry.subtree().apply(type).bulkRestoreSubtree(ids, actor));
  }

  public void deleteChildren(
      final List<EntityRelationshipRecord> children, final boolean hardDelete, final String actor) {
    final Action action = hardDelete ? Action.HARD_DELETE : Action.SOFT_DELETE;
    groupRecordsByType(children).forEach((type, ids) -> dispatch(type, ids, action, actor));
  }

  private Map<String, List<UUID>> groupRecordsByType(
      final List<EntityRelationshipRecord> children) {
    final Map<String, List<UUID>> idsByType = new HashMap<>();
    for (final var child : children) {
      idsByType.computeIfAbsent(child.getType(), ignored -> new ArrayList<>()).add(child.getId());
    }
    return idsByType;
  }

  public void walk(final List<T> parents, final Action action, final String actor) {
    final List<String> parentIds =
        parents.stream().map(parent -> parent.getId().toString()).toList();
    List<EntityRelationshipObject> children;
    try (var ignored = phase(action.phaseName)) {
      children = relationships.get().findToBatchAllTypes(parentIds, SUBTREE_RELATIONS, ALL);
    }
    if (action == Action.HARD_DELETE) {
      children = hardDeletePolicy.prepare(parents, children, actor);
    }
    groupByType(children).forEach((type, ids) -> dispatch(type, ids, action, actor));
  }

  private Map<String, List<UUID>> groupByType(final List<EntityRelationshipObject> children) {
    final Map<String, List<UUID>> idsByType = new HashMap<>();
    for (final var child : children) {
      if (entityType.equals(child.getFromEntity())) {
        idsByType
            .computeIfAbsent(child.getToEntity(), ignored -> new ArrayList<>())
            .add(UUID.fromString(child.getToId()));
      }
    }
    return idsByType;
  }

  private void dispatch(
      final String type, final List<UUID> ids, final Action action, final String actor) {
    // Time-series rows have no deleted state and may number in the millions per parent;
    // their existing retention jobs own cleanup rather than this synchronous hierarchy walk.
    if (!registry.isTimeSeries().test(type)) {
      action.apply(registry.subtree().apply(type), ids, actor);
    }
  }
}
