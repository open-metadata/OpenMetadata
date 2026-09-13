package org.openmetadata.service.entity.delete;

import static org.openmetadata.schema.type.EventType.ENTITY_RESTORED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;

import jakarta.ws.rs.core.Response.Status;
import java.time.Clock;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Restores an existing entity after its contained descendants and before HAS-related children. */
@Slf4j
public final class EntityRestoreService<T extends EntityInterface> implements EntityRestores<T> {
  public record Preparation<T>(
      BiFunction<UUID, Include, T> find, Consumer<T> hydrate, Consumer<T> inherit) {}

  public record Children(BiConsumer<UUID, String> contained, BiConsumer<UUID, String> additional) {}

  public record Mutation<T>(
      Class<T> entityClass, BiConsumer<T, T> update, Runnable invalidateCounts) {}

  private final String entityType;
  private final Preparation<T> preparation;
  private final Children children;
  private final Mutation<T> mutation;
  private final Clock clock;

  public EntityRestoreService(
      final String entityType,
      final Preparation<T> preparation,
      final Children children,
      final Mutation<T> mutation,
      final Clock clock) {
    this.entityType = entityType;
    this.preparation = preparation;
    this.children = children;
    this.mutation = mutation;
    this.clock = clock;
  }

  @Override
  @Transaction
  public PutResponse<T> restore(final String actor, final UUID id) {
    // A hard-deleted parent must fail before hooks can mutate any surviving descendants.
    preparation.find().apply(id, ALL);
    children.contained().accept(id, actor);
    LOG.info("Restoring the {} {}", entityType, id);
    PutResponse<T> response = null;
    try {
      response = restoreDeleted(actor, id);
    } catch (EntityNotFoundException exception) {
      LOG.info("Entity already restored or not in deleted state {} {}", entityType, id);
    }
    // Re-entered cascades must still reconcile children when this parent is already live.
    children.additional().accept(id, actor);
    return response;
  }

  private PutResponse<T> restoreDeleted(final String actor, final UUID id) {
    final T original = preparation.find().apply(id, DELETED);
    preparation.hydrate().accept(original);
    preparation.inherit().accept(original);
    final T updated =
        JsonUtils.readFromTokenBuffer(JsonUtils.toTokenBuffer(original), mutation.entityClass());
    updated.setUpdatedBy(actor);
    updated.setUpdatedAt(clock.millis());
    mutation.update().accept(original, updated);
    mutation.invalidateCounts().run();
    return new PutResponse<>(Status.OK, updated, ENTITY_RESTORED);
  }
}
