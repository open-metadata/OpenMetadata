package org.openmetadata.service.entity.history;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.write.EntityUpdateStore;
import org.openmetadata.service.entity.write.EntityUpdateWorkflow;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

/** Composes version persistence, reads and change policies once for an entity type. */
public final class EntityHistoryServices<T extends EntityInterface> {
  public record Storage<T>(
      Supplier<EntityExtensionDAO> extensions,
      Function<T, String> serialize,
      EntityUpdateStore.Rows<T> rows) {}

  public record Hydration<T>(
      Function<UUID, T> current,
      EntityVersionHistory.Hydration<T> single,
      Consumer<List<T>> batch) {}

  public record Changes(Set<String> fields, LongSupplier sessionTimeout) {
    public Changes {
      fields = Set.copyOf(fields);
    }
  }

  private final EntityVersionStore<T> versionStore;
  private final EntityUpdateStore<T> updateStore;
  private final EntityUpdateWorkflow<T> updateWorkflow;
  private final EntityVersionHistory<T> versions;
  private final EntityHistoryQuery<T> query;
  private final EntityChangeSummary<T> changes;
  private final SessionConsolidationPolicy consolidation;

  public EntityHistoryServices(
      final EntityHistoryType<T> type,
      final Storage<T> storage,
      final Hydration<T> hydration,
      final Changes policy) {
    versionStore = new EntityVersionStore<>(type, storage.extensions(), storage.serialize());
    updateStore = new EntityUpdateStore<>(versionStore, storage.rows());
    updateWorkflow = new EntityUpdateWorkflow<>(versionStore, updateStore);
    versions =
        new EntityVersionHistory<>(
            type, storage.extensions(), hydration.current(), hydration.single());
    query = new EntityHistoryQuery<>(type, storage.extensions(), hydration.batch());
    changes =
        new EntityChangeSummary<>(new ChangeSummarizer<>(type.entityClass(), policy.fields()));
    consolidation = new SessionConsolidationPolicy(type.name(), policy.sessionTimeout());
  }

  public EntityVersionStore<T> versionStore() {
    return versionStore;
  }

  public EntityUpdateStore<T> updateStore() {
    return updateStore;
  }

  public EntityUpdateWorkflow<T> updateWorkflow() {
    return updateWorkflow;
  }

  public EntityVersionHistory<T> versions() {
    return versions;
  }

  public EntityHistoryQuery<T> query() {
    return query;
  }

  public EntityChangeSummary<T> changes() {
    return changes;
  }

  public SessionConsolidationPolicy consolidation() {
    return consolidation;
  }
}
