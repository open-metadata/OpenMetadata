package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.nextVersion;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;

/** Persists prepared imports in their existing flush, reusing canonical row JSON for Redis. */
public final class EntityImportService<T extends EntityInterface> {
  public record Rows<T>(Consumer<List<T>> insert, Consumer<List<T>> update) {}

  public record Metadata<T>(
      Consumer<List<T>> removeExtensions,
      Consumer<List<T>> storeExtensions,
      Consumer<List<T>> clearRelationships,
      Consumer<List<T>> storeRelationships,
      Consumer<T> invalidate) {}

  public record Effects<T>(
      Consumer<List<T>> inherit,
      Consumer<List<T>> created,
      BiConsumer<List<T>, List<StoredEntity>> publish) {}

  public record Boundary<T>(
      Consumer<List<T>> checkModificationAllowed,
      Function<Runnable, List<StoredEntity>> flushAndCapture) {}

  private final Rows<T> rows;
  private final Metadata<T> metadata;
  private final Effects<T> effects;
  private final Boundary<T> boundary;
  private final Clock clock;

  public EntityImportService(
      final Rows<T> rows,
      final Metadata<T> metadata,
      final Effects<T> effects,
      final Boundary<T> boundary,
      final Clock clock) {
    this.rows = rows;
    this.metadata = metadata;
    this.effects = effects;
    this.boundary = boundary;
    this.clock = clock;
  }

  public List<T> create(final List<T> entities, final String impersonatedBy) {
    if (nullOrEmpty(entities)) {
      return entities;
    }
    boundary.checkModificationAllowed().accept(entities);
    entities.forEach(entity -> entity.setImpersonatedBy(impersonatedBy));
    final List<StoredEntity> stored =
        boundary.flushAndCapture().apply(() -> persistCreated(entities));
    effects.inherit().accept(entities);
    effects.created().accept(entities);
    effects.publish().accept(entities, stored);
    return entities;
  }

  private void persistCreated(final List<T> entities) {
    rows.insert().accept(entities);
    metadata.storeExtensions().accept(entities);
    metadata.storeRelationships().accept(entities);
  }

  public List<T> update(
      final List<T> originals, final List<T> updates, final EntityCommandActor actor) {
    if (nullOrEmpty(updates)) {
      return updates;
    }
    boundary.checkModificationAllowed().accept(updates);
    final List<T> entities = prepareUpdates(originals, updates, actor);
    final List<StoredEntity> stored =
        boundary.flushAndCapture().apply(() -> persistUpdated(originals, entities));
    effects.publish().accept(entities, stored);
    return entities;
  }

  private List<T> prepareUpdates(
      final List<T> originals, final List<T> updates, final EntityCommandActor actor) {
    final List<T> prepared = new ArrayList<>(originals.size());
    for (int index = 0; index < originals.size(); index++) {
      final T original = originals.get(index);
      final T updated = updates.get(index);
      updated.setId(original.getId());
      updated.setVersion(nextVersion(original.getVersion()));
      updated.setUpdatedBy(actor.user());
      updated.setUpdatedAt(clock.millis());
      updated.setImpersonatedBy(actor.impersonatedBy());
      prepared.add(updated);
    }
    return prepared;
  }

  private void persistUpdated(final List<T> originals, final List<T> entities) {
    rows.update().accept(entities);
    metadata.removeExtensions().accept(originals);
    metadata.storeExtensions().accept(entities);
    metadata.clearRelationships().accept(entities);
    metadata.storeRelationships().accept(entities);
    entities.forEach(metadata.invalidate());
  }
}
