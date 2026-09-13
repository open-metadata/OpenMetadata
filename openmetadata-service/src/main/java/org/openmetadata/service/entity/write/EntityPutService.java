package org.openmetadata.service.entity.write;

import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Coordinates PUT hydration, audit, restore and response projection around an entity command. */
public final class EntityPutService<T extends EntityInterface> implements EntityPuts<T> {
  public enum Mode {
    NORMAL,
    IMPORT,
    OPTIMISTIC
  }

  public record Preparation<T>(Consumer<T> hydrate, BiConsumer<String, UUID> restore) {}

  public record Projection<T>(Consumer<T> inherit, BiFunction<UriInfo, T, T> withHref) {}

  private final Preparation<T> preparation;
  private final Projection<T> projection;
  private final EntityUpdateFactory<T> updates;
  private final Clock clock;

  public EntityPutService(
      final Preparation<T> preparation,
      final Projection<T> projection,
      final EntityUpdateFactory<T> updates,
      final Clock clock) {
    this.preparation = preparation;
    this.projection = projection;
    this.updates = updates;
    this.clock = clock;
  }

  @Override
  @Transaction
  public PutResponse<T> update(
      final UriInfo uri,
      final T original,
      final T updated,
      final EntityCommandActor actor,
      final Mode mode) {
    prepare(original, updated, actor, mode);
    final EntityUpdateCommand command =
        updates.create(original, updated, null, mode == Mode.OPTIMISTIC);
    execute(command, mode);
    final EventType change = command.getChangeType();
    try (var ignored =
        phase(mode == Mode.IMPORT ? "putSetInheritedFieldsImport" : "putSetInheritedFields")) {
      projection.inherit().accept(updated);
    }
    if (change == ENTITY_UPDATED) {
      updated.setChangeDescription(command.getIncrementalChangeDescription());
    }
    return new PutResponse<>(Status.OK, projection.withHref().apply(uri, updated), change);
  }

  private void prepare(
      final T original, final T updated, final EntityCommandActor actor, final Mode mode) {
    try (var ignored =
        phase(mode == Mode.IMPORT ? "putHydrateOriginalImport" : "putHydrateOriginal")) {
      preparation.hydrate().accept(original);
    }
    updated.setUpdatedBy(actor.user());
    updated.setUpdatedAt(clock.millis());
    updated.setImpersonatedBy(actor.impersonatedBy());
    if (Boolean.TRUE.equals(original.getDeleted())) {
      try (var ignored =
          phase(mode == Mode.IMPORT ? "putRestoreEntityImport" : "putRestoreEntity")) {
        preparation.restore().accept(updated.getUpdatedBy(), original.getId());
      }
    }
  }

  private void execute(final EntityUpdateCommand command, final Mode mode) {
    try (var ignored = phase(mode == Mode.IMPORT ? "putEntityUpdateImport" : "putEntityUpdate")) {
      switch (mode) {
        case NORMAL -> command.update();
        case IMPORT -> command.updateForImport();
        case OPTIMISTIC -> command.updateWithOptimisticLocking();
      }
    }
  }
}
