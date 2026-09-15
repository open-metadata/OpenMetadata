package org.openmetadata.service.entity.delete;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;

import java.time.Clock;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

/** Runs entity deletion policies while holding the existing recursive-deletion guard. */
@Slf4j
public final class EntityDeletionService<T extends EntityInterface> {
  public record Request(String actor, boolean recursive, boolean hardDelete) {}

  public record Preparation<T>(
      Consumer<T> validate,
      BiConsumer<T, String> beforeDelete,
      Consumer<T> hydrate,
      Function<UUID, T> load) {}

  public record Children(
      BiConsumer<UUID, Request> contained,
      BiConsumer<UUID, String> softAdditional,
      BiConsumer<UUID, String> hardAdditional) {}

  public record Mutation<T>(
      boolean supportsSoftDelete, BiConsumer<T, T> softDelete, Consumer<T> purge) {}

  @FunctionalInterface
  public interface Guard<T> {
    Scope acquire(T entity, Request request);
  }

  @FunctionalInterface
  public interface Scope extends AutoCloseable {
    @Override
    void close();
  }

  private final Preparation<T> preparation;
  private final Children children;
  private final Mutation<T> mutation;
  private final Guard<? super T> guard;
  private final Clock clock;

  public EntityDeletionService(
      final Preparation<T> preparation,
      final Children children,
      final Mutation<T> mutation,
      final Guard<? super T> guard,
      final Clock clock) {
    this.preparation = preparation;
    this.children = children;
    this.mutation = mutation;
    this.guard = guard;
    this.clock = clock;
  }

  public DeleteResponse<T> delete(final T original, final Request request) {
    preparation.validate().accept(original);
    preparation.beforeDelete().accept(original, request.actor());
    preparation.hydrate().accept(original);
    try (var ignored = guard.acquire(original, request)) {
      children.contained().accept(original.getId(), request);
      final T updated = preparation.load().apply(original.getId());
      final EventType change = delete(original, updated, request);
      LOG.info(
          "{} deleted {}", request.hardDelete() ? "Hard" : "Soft", updated.getFullyQualifiedName());
      return new DeleteResponse<>(updated, change);
    }
  }

  private EventType delete(final T original, final T updated, final Request request) {
    if (mutation.supportsSoftDelete() && !request.hardDelete()) {
      updated.setUpdatedBy(request.actor());
      updated.setUpdatedAt(clock.millis());
      updated.setDeleted(true);
      mutation.softDelete().accept(original, updated);
      children.softAdditional().accept(original.getId(), request.actor());
      return ENTITY_SOFT_DELETED;
    }
    // HAS edges must remain available until the entity's additional children are discovered.
    children.hardAdditional().accept(original.getId(), request.actor());
    mutation.purge().accept(updated);
    return ENTITY_DELETED;
  }
}
