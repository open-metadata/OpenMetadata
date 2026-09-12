package org.openmetadata.service.entity.write;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.history.SessionConsolidationPolicy;
import org.openmetadata.service.entity.metadata.ColumnValueUpdater;
import org.openmetadata.service.entity.metadata.EntityColumnUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipWriter;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityTagWriter;

/** Shared update collaborators, constructed once against the owning module's retained DAO graph. */
public record EntityUpdateContext<T extends EntityInterface>(
    String type, Execution<T> execution, Metadata<T> metadata, Hooks<T> hooks, Columns columns) {
  public record Execution<T extends EntityInterface>(
      EntityMutationLifecycle<T> lifecycle,
      EntityUpdateWorkflow<T> workflow,
      EntityUpdateStore<T> store,
      SessionConsolidationPolicy consolidation) {}

  public record Metadata<T extends EntityInterface>(
      EntityMutationPlan<T> plan,
      EntityRelationshipUpdates relationships,
      EntityOwnershipWriter<T> ownership,
      EntityTagWriter tags) {}

  @FunctionalInterface
  public interface Owners<T> {
    void update(T entity, List<EntityReference> original, List<EntityReference> updated);
  }

  public record Hooks<T extends EntityInterface>(
      Function<String, User> users,
      Function<User, EntityMutationPermissions> permissions,
      Owners<T> owners,
      BiConsumer<T, String> publish) {}

  public record Columns(EntityColumnUpdates updates, ColumnValueUpdater values) {}
}
