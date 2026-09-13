package org.openmetadata.service.entity.bulk;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import com.fasterxml.jackson.databind.util.TokenBuffer;
import jakarta.ws.rs.core.Response.Status;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.LongConsumer;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;

/** Hydrates once, flushes replayable metadata/row/history mutations, and publishes committed results. */
@Slf4j
public final class EntityBulkUpdateService<T extends EntityInterface> {
  public record Request<T>(
      List<T> entities, Map<String, T> existing, String actor, boolean overrideMetadata) {}

  public record Results(Consumer<BulkResponse> success, Consumer<BulkResponse> failure) {}

  public record Preparation<T>(
      Class<T> entityClass,
      Consumer<List<T>> hydrate,
      Consumer<List<T>> inherit,
      BiConsumer<String, UUID> restore) {}

  public record Persistence<T extends EntityInterface>(
      BiFunction<T, T, EntityBulkMutation<T>> mutation,
      Consumer<List<T>> history,
      Consumer<List<T>> rows) {}

  public record Boundary<T extends EntityInterface>(
      Function<Supplier<List<EntityBulkMutation<T>>>, List<EntityBulkMutation<T>>> flush,
      BooleanSupplier enclosing,
      Consumer<Runnable> afterCommit) {}

  public record Effects<T extends EntityInterface>(
      Consumer<List<T>> invalidate,
      BiConsumer<T, T> postUpdate,
      BiConsumer<List<EntityBulkMutation<T>>, String> events,
      LongConsumer successMetric) {}

  private record Original<T>(T entity, TokenBuffer tokens, boolean duplicated) {}

  private record Snapshot<T>(Original<T> original, T requested, TokenBuffer requestTokens) {}

  private final Preparation<T> preparation;
  private final Persistence<T> persistence;
  private final Boundary<T> boundary;
  private final Effects<T> effects;
  private final Clock clock;

  public EntityBulkUpdateService(
      final Preparation<T> preparation,
      final Persistence<T> persistence,
      final Boundary<T> boundary,
      final Effects<T> effects,
      final Clock clock) {
    this.preparation = preparation;
    this.persistence = persistence;
    this.boundary = boundary;
    this.effects = effects;
    this.clock = clock;
  }

  public void update(final Request<T> request, final Results results) {
    final long started = System.nanoTime();
    final Map<String, Integer> frequencies = frequencies(request.entities());
    final List<T> candidates = candidates(request, frequencies, results);
    if (candidates.isEmpty()) {
      return;
    }
    final Map<String, T> originals = originals(candidates, request.existing());
    if (hydrate(originals, candidates, results)) {
      final List<Snapshot<T>> snapshots =
          snapshots(candidates, originals, frequencies, request.actor(), results);
      final List<EntityBulkMutation<T>> committed = flush(snapshots, request, results);
      boundary.afterCommit().accept(() -> publish(committed, request.actor()));
      reportSuccess(committed, results, System.nanoTime() - started);
    }
  }

  private Map<String, Integer> frequencies(final List<T> entities) {
    final Map<String, Integer> frequencies = new HashMap<>();
    for (final T entity : entities) {
      if (!nullOrEmpty(entity.getFullyQualifiedName())) {
        frequencies.merge(entity.getFullyQualifiedName(), 1, Integer::sum);
      }
    }
    return frequencies;
  }

  private List<T> candidates(
      final Request<T> request, final Map<String, Integer> frequencies, final Results results) {
    final List<T> candidates = new ArrayList<>();
    for (final T entity : request.entities()) {
      if (!request.overrideMetadata() && unchanged(entity, request.existing(), frequencies)) {
        success(entity, results, 0);
      } else {
        candidates.add(entity);
      }
    }
    return candidates;
  }

  private boolean unchanged(
      final T entity, final Map<String, T> existing, final Map<String, Integer> frequencies) {
    final String fqn = entity.getFullyQualifiedName();
    if (nullOrEmpty(fqn)
        || frequencies.getOrDefault(fqn, 0) != 1
        || nullOrEmpty(entity.getSourceHash())) {
      return false;
    }
    final T original = existing.get(fqn);
    return original != null
        && !Boolean.TRUE.equals(original.getDeleted())
        && entity.getSourceHash().equals(original.getSourceHash());
  }

  private Map<String, T> originals(final List<T> candidates, final Map<String, T> existing) {
    final Map<String, T> originals = new LinkedHashMap<>();
    for (final T entity : candidates) {
      final String fqn = entity.getFullyQualifiedName();
      if (!nullOrEmpty(fqn)) {
        final T original = existing.get(fqn);
        if (original != null) {
          originals.putIfAbsent(fqn, original);
        }
      }
    }
    return originals;
  }

  private boolean hydrate(
      final Map<String, T> originals, final List<T> candidates, final Results results) {
    try {
      preparation.hydrate().accept(new ArrayList<>(originals.values()));
      return true;
    } catch (RuntimeException exception) {
      LOG.error("setFieldsInBulk failed, marking all updates as failed", exception);
      candidates.forEach(
          entity ->
              failure(entity, results, "Batch field loading failed: " + exception.getMessage()));
      return false;
    }
  }

  private List<Snapshot<T>> snapshots(
      final List<T> candidates,
      final Map<String, T> originals,
      final Map<String, Integer> frequencies,
      final String actor,
      final Results results) {
    final Map<String, Original<T>> baselines = new HashMap<>();
    originals.forEach(
        (fqn, entity) ->
            baselines.put(
                fqn,
                new Original<>(
                    entity,
                    JsonUtils.toTokenBuffer(entity),
                    frequencies.getOrDefault(fqn, 0) > 1)));
    final List<Snapshot<T>> snapshots = new ArrayList<>();
    for (final T entity : candidates) {
      final Original<T> original = baselines.get(entity.getFullyQualifiedName());
      if (original == null) {
        failure(entity, results, "Entity does not exist");
      } else {
        entity.setUpdatedBy(actor);
        entity.setUpdatedAt(clock.millis());
        snapshots.add(new Snapshot<>(original, entity, JsonUtils.toTokenBuffer(entity)));
      }
    }
    return snapshots;
  }

  private List<EntityBulkMutation<T>> flush(
      final List<Snapshot<T>> snapshots, final Request<T> request, final Results results) {
    if (snapshots.isEmpty()) {
      return List.of();
    }
    final boolean enclosing = boundary.enclosing().getAsBoolean();
    try {
      return flush(snapshots, request.overrideMetadata(), true);
    } catch (RuntimeException exception) {
      // A joined transaction cannot discard this batch independently of its enclosing writes.
      if (enclosing) {
        throw exception;
      }
      LOG.warn("Batch update failed, falling back to per-entity transactions", exception);
      return fallback(snapshots, request.overrideMetadata(), results);
    }
  }

  private List<EntityBulkMutation<T>> flush(
      final List<Snapshot<T>> snapshots, final boolean overrideMetadata, final boolean batch) {
    final int[] attempts = {0};
    return boundary
        .flush()
        .apply(
            () -> {
              final List<EntityBulkMutation<T>> mutations =
                  prepare(snapshots, overrideMetadata, !batch || attempts[0]++ > 0);
              persist(mutations, batch);
              return mutations;
            });
  }

  private List<EntityBulkMutation<T>> prepare(
      final List<Snapshot<T>> snapshots, final boolean overrideMetadata, final boolean replay) {
    final List<EntityBulkMutation<T>> mutations = new ArrayList<>(snapshots.size());
    try (var ignored = phase("entityUpdaters")) {
      for (final Snapshot<T> snapshot : snapshots) {
        final EntityBulkMutation<T> mutation = prepare(snapshot, overrideMetadata, replay);
        mutation.updateWithDeferredStore();
        mutations.add(mutation);
      }
    }
    return mutations;
  }

  private EntityBulkMutation<T> prepare(
      final Snapshot<T> snapshot, final boolean overrideMetadata, final boolean replay) {
    final Original<T> baseline = snapshot.original();
    final T original =
        replay || baseline.duplicated() ? copy(baseline.tokens()) : baseline.entity();
    final T updated = replay ? copy(snapshot.requestTokens()) : snapshot.requested();
    if (Boolean.TRUE.equals(original.getDeleted())) {
      preparation.restore().accept(updated.getUpdatedBy(), original.getId());
    }
    final EntityBulkMutation<T> mutation = persistence.mutation().apply(original, updated);
    mutation.setOverrideMetadata(overrideMetadata);
    return mutation;
  }

  private T copy(final TokenBuffer tokens) {
    return JsonUtils.readFromTokenBuffer(tokens, preparation.entityClass());
  }

  private void persist(final List<EntityBulkMutation<T>> mutations, final boolean batch) {
    final List<EntityBulkMutation<T>> changed = mutations.stream().filter(this::changed).toList();
    try (var ignored = phase("batchDbWrites")) {
      if (batch) {
        persistence
            .history()
            .accept(
                changed.stream()
                    .filter(EntityBulkMutation::isVersionChanged)
                    .map(EntityBulkMutation::getOriginal)
                    .toList());
        final List<T> entities = changed.stream().map(EntityBulkMutation::getUpdated).toList();
        if (!entities.isEmpty()) {
          persistence.rows().accept(entities);
        }
      } else {
        changed.forEach(EntityBulkMutation::storeUpdate);
      }
    }
  }

  private List<EntityBulkMutation<T>> fallback(
      final List<Snapshot<T>> snapshots, final boolean overrideMetadata, final Results results) {
    final List<EntityBulkMutation<T>> committed = new ArrayList<>();
    for (final Snapshot<T> snapshot : snapshots) {
      try {
        committed.addAll(flush(List.of(snapshot), overrideMetadata, false));
      } catch (RuntimeException exception) {
        failure(snapshot.requested(), results, exception.getMessage());
      }
    }
    return committed;
  }

  private void publish(final List<EntityBulkMutation<T>> mutations, final String actor) {
    final List<EntityBulkMutation<T>> changed = mutations.stream().filter(this::changed).toList();
    if (!changed.isEmpty()) {
      final List<T> entities = changed.stream().map(EntityBulkMutation::getUpdated).toList();
      inheritCommitted(entities);
      invalidateCommitted(entities);
      publishEvents(changed, actor);
    }
  }

  private void publishEvents(final List<EntityBulkMutation<T>> mutations, final String actor) {
    try (var ignored = phase("postUpdateEvents")) {
      for (final EntityBulkMutation<T> mutation : mutations) {
        notifyCommitted(mutation);
        reactToCommitted(mutation);
      }
      effects.events().accept(mutations, actor);
    }
  }

  private void inheritCommitted(final List<T> entities) {
    try (var ignored = phase("setInheritedFields")) {
      preparation.inherit().accept(entities);
    } catch (RuntimeException exception) {
      LOG.warn("Inheritance hydration failed after bulk commit", exception);
    }
  }

  private void invalidateCommitted(final List<T> entities) {
    try (var ignored = phase("invalidateCacheBulk")) {
      effects.invalidate().accept(entities);
    } catch (RuntimeException exception) {
      LOG.warn("Cache invalidation failed after bulk commit", exception);
    }
  }

  private void notifyCommitted(final EntityBulkMutation<T> mutation) {
    try {
      effects.postUpdate().accept(mutation.getOriginal(), mutation.getUpdated());
    } catch (RuntimeException exception) {
      LOG.warn(
          "Post-update hook failed after bulk commit for {}",
          mutation.getUpdated().getId(),
          exception);
    }
  }

  private void reactToCommitted(final EntityBulkMutation<T> mutation) {
    try {
      mutation.runDeferredReactOperations();
    } catch (RuntimeException exception) {
      LOG.warn(
          "Deferred effects failed after bulk commit for {}",
          mutation.getUpdated().getId(),
          exception);
    }
  }

  private boolean changed(final EntityBulkMutation<T> mutation) {
    return mutation.isVersionChanged() || mutation.isEntityChanged();
  }

  private void reportSuccess(
      final List<EntityBulkMutation<T>> committed, final Results results, final long elapsed) {
    if (!committed.isEmpty()) {
      final long perEntityDuration = elapsed / committed.size();
      committed.forEach(mutation -> success(mutation.getUpdated(), results, perEntityDuration));
    }
  }

  private void success(final T entity, final Results results, final long elapsed) {
    effects.successMetric().accept(elapsed);
    results
        .success()
        .accept(
            new BulkResponse()
                .withRequest(entity.getFullyQualifiedName())
                .withStatus(Status.OK.getStatusCode()));
  }

  private void failure(final T entity, final Results results, final String message) {
    results
        .failure()
        .accept(
            new BulkResponse()
                .withRequest(entity.getFullyQualifiedName())
                .withStatus(Status.BAD_REQUEST.getStatusCode())
                .withMessage(message));
  }
}
