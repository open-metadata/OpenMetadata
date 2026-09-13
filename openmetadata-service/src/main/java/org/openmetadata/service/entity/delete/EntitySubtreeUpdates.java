package org.openmetadata.service.entity.delete;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import com.fasterxml.jackson.databind.util.TokenBuffer;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityDeferredUpdate;

/** Persists each restore/soft-delete level in one replayable flush before publishing its effects. */
public final class EntitySubtreeUpdates<T extends EntityInterface> {
  public enum Mode {
    RESTORE("bulkRestore"),
    SOFT_DELETE("bulkSoftDelete");

    private final String phasePrefix;

    Mode(final String phasePrefix) {
      this.phasePrefix = phasePrefix;
    }
  }

  public record Preparation<T>(Class<T> entityClass, Consumer<List<T>> hydrate) {}

  @FunctionalInterface
  public interface Factory<T extends EntityInterface> {
    EntityDeferredUpdate<T> create(T original, T updated, Mode mode);
  }

  public record Rows<T>(
      Consumer<List<T>> history,
      Consumer<List<T>> update,
      Function<Supplier<List<T>>, List<T>> flush) {}

  public record Effects<T>(
      Consumer<List<T>> invalidate,
      Consumer<List<T>> updated,
      Runnable invalidateCounts,
      Consumer<Runnable> afterCommit) {}

  private record Snapshot<T>(T original, TokenBuffer tokens) {}

  private final Preparation<T> preparation;
  private final Factory<T> factory;
  private final Rows<T> rows;
  private final Effects<T> effects;
  private final Clock clock;

  public EntitySubtreeUpdates(
      final Preparation<T> preparation,
      final Factory<T> factory,
      final Rows<T> rows,
      final Effects<T> effects,
      final Clock clock) {
    this.preparation = preparation;
    this.factory = factory;
    this.rows = rows;
    this.effects = effects;
    this.clock = clock;
  }

  public void update(final List<T> originals, final String actor, final Mode mode) {
    if (originals.isEmpty()) {
      return;
    }
    preparation.hydrate().accept(originals);
    final long updatedAt = clock.millis();
    final List<Snapshot<T>> snapshots = snapshot(originals, mode);
    final int[] attempts = {0};
    final List<T> changed =
        rows.flush()
            .apply(
                () -> persist(prepare(snapshots, actor, updatedAt, mode, attempts[0]++ > 0), mode));
    if (!changed.isEmpty()) {
      effects.afterCommit().accept(() -> publish(changed, mode));
    }
  }

  private List<Snapshot<T>> snapshot(final List<T> originals, final Mode mode) {
    try (var ignored = phase(mode.phasePrefix + "Snapshot")) {
      return originals.stream()
          .map(entity -> new Snapshot<>(entity, JsonUtils.toTokenBuffer(entity)))
          .toList();
    }
  }

  private List<EntityDeferredUpdate<T>> prepare(
      final List<Snapshot<T>> snapshots,
      final String actor,
      final long updatedAt,
      final Mode mode,
      final boolean retry) {
    final List<EntityDeferredUpdate<T>> changed = new ArrayList<>(snapshots.size());
    try (var ignored = phase(mode.phasePrefix + "Updaters")) {
      for (final Snapshot<T> snapshot : snapshots) {
        final EntityDeferredUpdate<T> command =
            prepareCommand(snapshot, actor, updatedAt, mode, retry);
        if (command.isVersionChanged() || command.isEntityChanged()) {
          changed.add(command);
        }
      }
    }
    return changed;
  }

  private EntityDeferredUpdate<T> prepareCommand(
      final Snapshot<T> snapshot,
      final String actor,
      final long updatedAt,
      final Mode mode,
      final boolean retry) {
    // A replay needs fresh baselines and commands: entity-specific diff code can mutate either.
    final T original = retry ? copy(snapshot) : snapshot.original();
    final T updated = copy(snapshot);
    updated.setUpdatedBy(actor);
    updated.setUpdatedAt(updatedAt);
    if (mode == Mode.SOFT_DELETE) {
      updated.setDeleted(true);
    }
    final EntityDeferredUpdate<T> command = factory.create(original, updated, mode);
    command.updateWithDeferredStore();
    return command;
  }

  private T copy(final Snapshot<T> snapshot) {
    return JsonUtils.readFromTokenBuffer(snapshot.tokens(), preparation.entityClass());
  }

  private List<T> persist(final List<EntityDeferredUpdate<T>> changed, final Mode mode) {
    if (changed.isEmpty()) {
      return List.of();
    }
    try (var ignored = phase(mode.phasePrefix + "VersionHistory")) {
      rows.history()
          .accept(
              changed.stream()
                  .filter(EntityDeferredUpdate::isVersionChanged)
                  .map(EntityDeferredUpdate::getOriginal)
                  .toList());
    }
    final List<T> entities = changed.stream().map(EntityDeferredUpdate::getUpdated).toList();
    try (var ignored = phase(mode.phasePrefix + "UpdateMany")) {
      rows.update().accept(entities);
    }
    return entities;
  }

  private void publish(final List<T> entities, final Mode mode) {
    try (var ignored = phase(mode.phasePrefix + "Invalidate")) {
      effects.invalidate().accept(entities);
    }
    try (var ignored = phase(mode.phasePrefix + "LifecycleDispatch")) {
      effects.updated().accept(entities);
    }
    effects.invalidateCounts().run();
  }
}
