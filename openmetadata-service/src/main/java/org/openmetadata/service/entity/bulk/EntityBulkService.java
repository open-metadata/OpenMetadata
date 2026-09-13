package org.openmetadata.service.entity.bulk;

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;

import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Coordinates mixed bulk creates and updates, preserving per-entry results and duplicate FQNs. */
@Slf4j
public final class EntityBulkService<T extends EntityInterface> implements EntityBulkOperations<T> {
  private static final int MYSQL_DUPLICATE_KEY = 1062;
  private static final String POSTGRES_DUPLICATE_KEY = "23505";

  public record Request<T>(
      UriInfo uriInfo,
      List<T> entities,
      String actor,
      Map<String, T> existing,
      boolean overrideMetadata) {}

  @FunctionalInterface
  public interface SingleCreate<T> {
    PutResponse<T> create(UriInfo uriInfo, T entity, String actor);
  }

  public record Creators<T>(Consumer<List<T>> batch, SingleCreate<T> single) {}

  @FunctionalInterface
  public interface EventFactory<T> {
    Optional<String> create(T entity, EventType eventType, String actor);
  }

  public record Events<T>(
      EventFactory<T> create, Consumer<String> single, Consumer<List<String>> batch) {}

  public record Services<T extends EntityInterface>(
      EntityBulkUpdateService<T> updates,
      Events<T> events,
      EntityBulkMetrics metrics,
      EntityBulkJobs jobs,
      EntityStaleDeletion staleDeletion) {}

  private record Partition<T>(List<T> creates, List<T> updates) {}

  private final Creators<T> creators;
  private final Function<List<String>, List<T>> loadExisting;
  private final EntityBulkUpdateService<T> updates;
  private final Events<T> events;
  private final EntityBulkMetrics metrics;
  private final EntityBulkJobs jobs;
  private final EntityStaleDeletion staleDeletion;

  public EntityBulkService(
      final Creators<T> creators,
      final Function<List<String>, List<T>> loadExisting,
      final Services<T> services) {
    this.creators = creators;
    this.loadExisting = loadExisting;
    this.updates = services.updates();
    this.events = services.events();
    this.metrics = services.metrics();
    this.jobs = services.jobs();
    this.staleDeletion = services.staleDeletion();
  }

  @Override
  public BulkOperationResult upsert(final Request<T> request) {
    final long started = System.nanoTime();
    final Outcome outcome = new Outcome();
    final Partition<T> partition = partition(request);
    create(partition.creates(), request, outcome);
    reloadCreated(partition.updates(), request.existing());
    final List<T> eligible = existingUpdates(partition.updates(), request.existing(), outcome);
    updates.update(
        new EntityBulkUpdateService.Request<>(
            eligible, request.existing(), request.actor(), request.overrideMetadata()),
        new EntityBulkUpdateService.Results(outcome.success::add, outcome.failure::add));
    final long elapsed = System.nanoTime() - started;
    metrics.recordBatch(request.entities().size(), outcome.success.size(), elapsed);
    LOG.info(
        "Bulk operation completed: {} succeeded, {} failed out of {} total, took {}ms",
        outcome.success.size(),
        outcome.failure.size(),
        request.entities().size(),
        elapsed / 1_000_000);
    return outcome.result(request.entities().size());
  }

  @Override
  public EntityBulkJobs.Job submit(
      final Request<T> request, final EntityBulkJobs.Authorization authorization) {
    return jobs.submit(request.entities(), () -> upsert(request), authorization);
  }

  @Override
  public Optional<BulkOperationResult> status(final String id) {
    return jobs.status(id);
  }

  @Override
  public BulkOperationResult deleteStale(final BulkDeleteStaleRequest request, final String actor) {
    return staleDeletion.reconcile(request, actor);
  }

  private Partition<T> partition(final Request<T> request) {
    final List<T> creates = new ArrayList<>();
    final List<T> updates = new ArrayList<>();
    final Set<String> seenNew = new HashSet<>();
    for (final T entity : request.entities()) {
      final String fqn = entity.getFullyQualifiedName();
      if (request.existing().containsKey(fqn) || !seenNew.add(fqn)) {
        updates.add(entity);
      } else {
        creates.add(entity);
      }
    }
    return new Partition<>(creates, updates);
  }

  private void create(final List<T> entities, final Request<T> request, final Outcome outcome) {
    if (entities.isEmpty()) {
      return;
    }
    final long started = System.nanoTime();
    try {
      creators.batch().accept(entities);
      reportCreated(
          entities, request.actor(), outcome, (System.nanoTime() - started) / entities.size());
    } catch (RuntimeException exception) {
      LOG.warn("Batch create failed, falling back to per-entity creates", exception);
      entities.forEach(entity -> createOne(entity, request, outcome));
    }
  }

  private void reportCreated(
      final List<T> entities, final String actor, final Outcome outcome, final long elapsed) {
    final List<String> createdEvents = new ArrayList<>(entities.size());
    for (final T entity : entities) {
      success(entity, outcome, elapsed);
      events.create().create(entity, ENTITY_CREATED, actor).ifPresent(createdEvents::add);
    }
    events.batch().accept(createdEvents);
  }

  private void createOne(final T entity, final Request<T> request, final Outcome outcome) {
    final long started = System.nanoTime();
    try {
      final PutResponse<T> response =
          creators.single().create(request.uriInfo(), entity, request.actor());
      success(entity, outcome, System.nanoTime() - started);
      events
          .create()
          .create(response.getEntity(), response.getChangeType(), request.actor())
          .ifPresent(events.single());
    } catch (RuntimeException exception) {
      failedCreate(entity, outcome, exception, System.nanoTime() - started);
    }
  }

  private void failedCreate(
      final T entity, final Outcome outcome, final RuntimeException exception, final long elapsed) {
    if (duplicateKey(exception)) {
      LOG.debug(
          "Entity already exists (duplicate key), treating as success: {}",
          entity.getFullyQualifiedName());
      success(entity, outcome, elapsed);
    } else {
      metrics.recordEntity(elapsed, 0, false);
      outcome.fail(entity.getFullyQualifiedName(), exception.getMessage());
    }
  }

  private boolean duplicateKey(final RuntimeException exception) {
    return exception.getCause() instanceof SQLException sql
        && (sql.getErrorCode() == MYSQL_DUPLICATE_KEY
            || POSTGRES_DUPLICATE_KEY.equals(sql.getSQLState()));
  }

  private void reloadCreated(final List<T> updates, final Map<String, T> existing) {
    if (updates.isEmpty()) {
      return;
    }
    final List<String> missing =
        updates.stream()
            .map(EntityInterface::getFullyQualifiedName)
            .filter(fqn -> !existing.containsKey(fqn))
            .distinct()
            .toList();
    if (!missing.isEmpty()) {
      loadExisting
          .apply(missing)
          .forEach(entity -> existing.put(entity.getFullyQualifiedName(), entity));
    }
  }

  private List<T> existingUpdates(
      final List<T> updates, final Map<String, T> existing, final Outcome outcome) {
    final var iterator = updates.iterator();
    while (iterator.hasNext()) {
      final T entity = iterator.next();
      if (!existing.containsKey(entity.getFullyQualifiedName())) {
        iterator.remove();
        outcome.fail(
            entity.getFullyQualifiedName(), "Entity does not exist and could not be created");
      }
    }
    return updates;
  }

  private void success(final T entity, final Outcome outcome, final long elapsed) {
    metrics.recordEntity(elapsed, 0, true);
    outcome.success.add(
        new BulkResponse()
            .withRequest(entity.getFullyQualifiedName())
            .withStatus(Status.OK.getStatusCode()));
  }

  private static final class Outcome {
    private final List<BulkResponse> success = new ArrayList<>();
    private final List<BulkResponse> failure = new ArrayList<>();

    private void fail(final String fqn, final String message) {
      failure.add(
          new BulkResponse()
              .withRequest(fqn)
              .withStatus(Status.BAD_REQUEST.getStatusCode())
              .withMessage(message));
    }

    private BulkOperationResult result(final int total) {
      final ApiStatus status =
          failure.isEmpty()
              ? ApiStatus.SUCCESS
              : success.isEmpty() ? ApiStatus.FAILURE : ApiStatus.PARTIAL_SUCCESS;
      return new BulkOperationResult()
          .withStatus(status)
          .withNumberOfRowsProcessed(total)
          .withNumberOfRowsPassed(success.size())
          .withNumberOfRowsFailed(failure.size())
          .withSuccessRequest(success)
          .withFailedRequest(failure);
    }
  }
}
