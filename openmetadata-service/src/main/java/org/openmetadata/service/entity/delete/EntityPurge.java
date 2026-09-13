package org.openmetadata.service.entity.delete;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;

/** Purges rows and dependent metadata through the owning transaction before publishing deletion. */
public final class EntityPurge<T extends EntityInterface> {
  public record Rows<T>(
      Consumer<T> cleanup,
      Consumer<UUID> delete,
      Consumer<List<T>> cleanupBatch,
      Consumer<List<UUID>> deleteBatch) {}

  public record Lifecycle<T>(
      BiConsumer<String, T> entitySpecific,
      Consumer<T> invalidate,
      Consumer<T> missing,
      Consumer<Collection<UUID>> cancelWorkflows) {}

  private final Rows<T> rows;
  private final Lifecycle<T> lifecycle;
  private final Consumer<Runnable> transaction;
  private final BooleanSupplier batchTransactionsAvailable;

  public EntityPurge(
      final Rows<T> rows,
      final Lifecycle<T> lifecycle,
      final Consumer<Runnable> transaction,
      final BooleanSupplier batchTransactionsAvailable) {
    this.rows = rows;
    this.lifecycle = lifecycle;
    this.transaction = transaction;
    this.batchTransactionsAvailable = batchTransactionsAvailable;
  }

  public void delete(final String actor, final T entity) {
    transaction.accept(() -> purge(actor, entity));
    lifecycle.cancelWorkflows().accept(List.of(entity.getId()));
    lifecycle.invalidate().accept(entity);
    lifecycle.missing().accept(entity);
  }

  private void purge(final String actor, final T entity) {
    lifecycle.entitySpecific().accept(actor, entity);
    final UUID id = entity.getId();
    rows.cleanup().accept(entity);
    // Invalidate locally before deletion, then again after commit to close concurrent read races.
    lifecycle.invalidate().accept(entity);
    rows.delete().accept(id);
  }

  public void deleteMany(final List<T> entities) {
    final List<UUID> ids = entities.stream().map(EntityInterface::getId).toList();
    final Runnable purge = () -> purgeMany(entities, ids);
    if (batchTransactionsAvailable.getAsBoolean()) {
      transaction.accept(purge);
    } else {
      purge.run();
    }
    lifecycle.cancelWorkflows().accept(ids);
  }

  private void purgeMany(final List<T> entities, final List<UUID> ids) {
    rows.cleanupBatch().accept(entities);
    try (var ignored = phase("bulkHardDeleteRows")) {
      rows.deleteBatch().accept(ids);
    }
  }
}
