package org.openmetadata.service.entity.write;

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.exception.EntityLockedException;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Routes prepared upserts and explicit creates through the shared mutation services. */
@Slf4j
public final class EntityCreationService<T extends EntityInterface> implements EntityCreates<T> {
  public record Steps<T>(
      Consumer<T> prepare,
      Function<String, T> find,
      Function<T, T> create,
      BiFunction<UriInfo, T, T> withHref) {}

  private final Steps<T> steps;
  private final Consumer<T> checkModificationAllowed;
  private final EntityPuts<T> updates;

  public EntityCreationService(
      final Steps<T> steps,
      final Consumer<T> checkModificationAllowed,
      final EntityPuts<T> updates) {
    this.steps = steps;
    this.checkModificationAllowed = checkModificationAllowed;
    this.updates = updates;
  }

  @Override
  public T create(final T entity, final EntityCommandActor actor) {
    checkLock(entity, "creation");
    try (var ignored = phase("createPrepareInternal")) {
      steps.prepare().accept(entity);
    }
    if (actor.user() != null) {
      entity.setUpdatedBy(actor.user());
    }
    entity.setImpersonatedBy(actor.impersonatedBy());
    return steps.create().apply(entity);
  }

  @Override
  public T create(final UriInfo uri, final T entity, final EntityCommandActor actor) {
    return steps.withHref().apply(uri, create(entity, actor));
  }

  @Override
  public PutResponse<T> upsert(
      final UriInfo uri,
      final T updated,
      final EntityCommandActor actor,
      final boolean importMode) {
    if (!importMode) {
      checkLock(updated, "update");
    }
    final T original = findOriginal(updated, importMode);
    return original == null
        ? createPrepared(uri, updated, actor.impersonatedBy(), importMode)
        : update(uri, original, updated, actor, importMode);
  }

  private T findOriginal(final T entity, final boolean importMode) {
    try (var ignored = phase(importMode ? "upsertFindOriginalImport" : "upsertFindOriginal")) {
      return steps.find().apply(entity.getFullyQualifiedName());
    }
  }

  private PutResponse<T> createPrepared(
      final UriInfo uri, final T entity, final String impersonatedBy, final boolean importMode) {
    entity.setImpersonatedBy(impersonatedBy);
    final T created;
    try (var ignored = phase(importMode ? "upsertCreateImport" : "upsertCreate")) {
      created = steps.withHref().apply(uri, steps.create().apply(entity));
    }
    return new PutResponse<>(Status.CREATED, created, ENTITY_CREATED);
  }

  private PutResponse<T> update(
      final UriInfo uri,
      final T original,
      final T updated,
      final EntityCommandActor actor,
      final boolean importMode) {
    try (var ignored = phase(importMode ? "upsertUpdateImport" : "upsertUpdate")) {
      return updates.update(
          uri,
          original,
          updated,
          actor,
          importMode ? EntityPutService.Mode.IMPORT : EntityPutService.Mode.NORMAL);
    }
  }

  private void checkLock(final T entity, final String operation) {
    try {
      checkModificationAllowed.accept(entity);
    } catch (EntityLockedException exception) {
      LOG.warn("Entity {} blocked due to parent deletion: {}", operation, exception.getMessage());
      throw exception;
    }
  }
}
