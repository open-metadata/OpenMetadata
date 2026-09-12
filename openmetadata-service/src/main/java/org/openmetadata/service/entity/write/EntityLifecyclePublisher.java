package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;

/** Publishes lifecycle projections at the caller's existing mutation boundary. */
public final class EntityLifecyclePublisher<T extends EntityInterface> {
  public record Writes<T>(
      Consumer<T> created,
      Consumer<List<EntityInterface>> createdMany,
      Consumer<T> updated,
      Consumer<List<T>> updatedMany) {}

  public record Deletes<T>(Consumer<T> hard, BiConsumer<T, Boolean> soft) {}

  public record Projections<T>(
      Consumer<T> rdf,
      Consumer<T> rdfDelete,
      Runnable count,
      Consumer<T> invalidateCreated,
      Consumer<List<T>> cacheUpdates) {}

  private final Writes<T> writes;
  private final Deletes<T> deletes;
  private final Projections<T> projections;

  public EntityLifecyclePublisher(
      final Writes<T> writes, final Deletes<T> deletes, final Projections<T> projections) {
    this.writes = writes;
    this.deletes = deletes;
    this.projections = projections;
  }

  public void created(final T entity) {
    try (var ignored = phase("lifecycleDispatch")) {
      writes.created().accept(entity);
    }
    projections.rdf().accept(entity);
    projections.count().run();
    projections.invalidateCreated().accept(entity);
  }

  public void createdMany(final List<T> entities) {
    final List<T> unique = uniqueIdentities(entities);
    if (!unique.isEmpty()) {
      try (var ignored = phase("lifecycleDispatch")) {
        writes.createdMany().accept(new ArrayList<>(unique));
      }
      unique.forEach(projections.rdf());
      projections.count().run();
    }
  }

  private List<T> uniqueIdentities(final List<T> entities) {
    if (nullOrEmpty(entities)) {
      return List.of();
    }
    final List<T> unique = new ArrayList<>(entities.size());
    final Set<UUID> seen = new HashSet<>();
    for (final T entity : entities) {
      if (entity != null && entity.getId() != null && seen.add(entity.getId())) {
        unique.add(entity);
      }
    }
    return unique;
  }

  public void updated(final T entity) {
    try (var ignored = phase("lifecycleDispatch")) {
      writes.updated().accept(entity);
    }
    projections.rdf().accept(entity);
  }

  public void updatedMany(final List<T> entities) {
    if (!nullOrEmpty(entities)) {
      projections.cacheUpdates().accept(entities);
      writes.updatedMany().accept(entities);
      entities.forEach(projections.rdf());
    }
  }

  public void deleted(final T entity, final boolean hardDelete) {
    if (hardDelete) {
      projections.rdfDelete().accept(entity);
    }
    projections.count().run();
  }

  public void publishDeletion(final T entity, final boolean hardDelete) {
    try (var ignored = phase("lifecycleDispatch")) {
      if (hardDelete) {
        deletes.hard().accept(entity);
      } else {
        deletes.soft().accept(entity, true);
      }
    }
  }

  public void publishRestoration(final T entity) {
    try (var ignored = phase("lifecycleDispatch")) {
      deletes.soft().accept(entity, false);
    }
  }
}
