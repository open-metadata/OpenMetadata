/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;
import org.openmetadata.service.events.lifecycle.OrderedLaneTask;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * Search writes made on behalf of an API request. They run after the request returns, in order per
 * entity, so search is eventually consistent and an API call never waits for the search cluster.
 *
 * <p>Each write snapshots the entity it was given (the request may mask or strip it once it
 * returns) and records when that state was read; the write is version-guarded by that time, not by
 * when its lane ran it. A write that reads the database itself is stamped when it starts. A write
 * to other entities' documents (a fan-out) runs once every write queued before it is applied. A
 * write made inside a database transaction is queued only after the commit. A write that fails, or
 * that a full lane sheds, goes to the durable retry queue, which rebuilds the document from the
 * database.
 */
@Slf4j
public final class LiveSearchWrites implements AutoCloseable {
  private static final String CREATE = "createEntityIndex";
  private static final String UPDATE = "updateEntityIndex";
  private static final String UPDATE_REFERENCE = "updateEntity";
  private static final String DELETE = "deleteEntityIndex";
  private static final String SOFT_DELETE = "softDeleteEntityIndex";
  private static final String RESTORE = "restoreEntityIndex";
  private static final String CREATE_RECORD = "createTimeSeriesEntity";
  private static final String UPDATE_RECORD = "updateTimeSeriesEntity";
  private static final String DELETE_RECORD = "deleteTimeSeriesEntityById";

  private static final Duration EARLIER_WRITES_WAIT = Duration.ofMinutes(2);

  private final SearchRepository repository;
  private final LongSupplier clock;
  private final OrderedLaneExecutor lanes;
  private final OrderedLaneExecutor fanOuts;

  LiveSearchWrites(final SearchRepository repository) {
    this(repository, System::currentTimeMillis);
  }

  LiveSearchWrites(final SearchRepository repository, final LongSupplier clock) {
    this.repository = repository;
    this.clock = clock;
    this.lanes = new OrderedLaneExecutor(LiveSearchWrites::retryLater);
    this.fanOuts = new OrderedLaneExecutor(LiveSearchWrites::retryLater);
  }

  public void createEntityIndex(final EntityInterface<?> entity) {
    queueSnapshot(entity, CREATE, repository::createEntityIndex);
  }

  /** Queues each entity on its own lane, so a later write to one of them cannot overtake it. */
  public void createEntitiesIndex(final List<? extends EntityInterface<?>> entities) {
    entities.forEach(this::createEntityIndex);
  }

  public void updateEntityIndex(final EntityInterface<?> entity) {
    queueSnapshot(entity, UPDATE, repository::updateEntityIndex);
  }

  public void updateEntityIndex(final EntityInterface<?> entity, final Long relationshipRevision) {
    queueSnapshot(
        entity, UPDATE, snapshot -> repository.updateEntityIndex(snapshot, relationshipRevision));
  }

  public void updateEntitiesIndex(
      final List<? extends EntityInterface<?>> entities,
      final Map<UUID, Long> relationshipRevisions) {
    entities.forEach(
        entity -> updateEntityIndex(entity, relationshipRevisions.get(entity.getId())));
  }

  /** Rebuilds the document from the row when the write runs, so nothing is snapshotted. */
  public void updateEntity(final EntityReference reference) {
    queue(
        new OrderedLaneTask(
            readWhenRun(() -> repository.updateEntity(reference)),
            UPDATE_REFERENCE,
            idOf(reference.getId()),
            reference.getFullyQualifiedName(),
            reference.getType()),
        reference.getId());
  }

  public void deleteEntityIndex(final EntityInterface<?> entity) {
    queueSnapshot(entity, DELETE, repository::deleteEntityIndex);
  }

  public void softDeleteOrRestoreEntityIndex(
      final EntityInterface<?> entity, final boolean delete) {
    queueSnapshot(
        entity,
        delete ? SOFT_DELETE : RESTORE,
        snapshot -> repository.softDeleteOrRestoreEntityIndex(snapshot, delete));
  }

  public void createTimeSeriesEntity(final EntityTimeSeriesInterface record) {
    queueRecord(record, CREATE_RECORD, repository::createTimeSeriesEntity);
  }

  public void updateTimeSeriesEntity(final EntityTimeSeriesInterface record) {
    queueRecord(record, UPDATE_RECORD, repository::updateTimeSeriesEntity);
  }

  public void deleteTimeSeriesEntityById(final EntityTimeSeriesInterface record) {
    queueRecord(record, DELETE_RECORD, repository::deleteTimeSeriesEntityById);
  }

  /** Runs a write captured inside a committed transaction on its entity's lane. */
  public void queueCommitted(final OrderedLaneTask write) {
    lanes.submit(laneKey(write.entityId(), write.entityFqn()), isolated(write));
  }

  /**
   * Queues a write of the caller's own on the lane of the entity it names; inside a transaction,
   * once it commits.
   */
  public void queue(final OrderedLaneTask write) {
    queue(write, laneKey(write.entityId(), write.entityFqn()));
  }

  /**
   * Queues a write to other entities' documents — children, assets, or documents matched by a
   * prefix or a query — to run once every write queued before it is applied; inside a transaction,
   * once it commits.
   */
  public void fanOut(final OrderedLaneTask write) {
    final UUID key = laneKey(write.entityId(), write.entityFqn());
    SearchRepository.runAfterCommit(
        () -> applyAfterEarlierWrites(key, write), write.operation(), write.entityFqn());
  }

  /** Whether the caller is applying a queued write. */
  public boolean isApplyingQueuedWrite() {
    return lanes.currentLane() != OrderedLaneExecutor.NO_LANE;
  }

  /** Whether the caller is applying a queued fan-out. */
  public boolean isApplyingFanOut() {
    return fanOuts.currentLane() != OrderedLaneExecutor.NO_LANE;
  }

  /**
   * Runs a fan-out to other documents (children, related assets) once every write queued before it
   * has been applied. Otherwise a child's own write, queued earlier but applied later, would put
   * back what the fan-out changed. Fan-outs of one entity keep their order, and the wait happens off
   * the write lanes, which never wait for anything.
   */
  public void applyAfterEarlierWrites(final UUID entityId, final OrderedLaneTask fanOut) {
    final int writerLane = lanes.currentLane();
    final Runnable write = readWhenRun(fanOut::run);
    fanOuts.submit(
        entityId,
        isolated(
            new OrderedLaneTask(
                () -> {
                  awaitEarlierWrites(writerLane);
                  write.run();
                },
                fanOut.operation(),
                fanOut.entityId(),
                fanOut.entityFqn(),
                fanOut.entityType())));
  }

  private void awaitEarlierWrites(final int writerLane) {
    try {
      if (!lanes.awaitQueuedTasks(EARLIER_WRITES_WAIT, writerLane)) {
        LOG.warn("Search writes queued earlier are still pending; fanning out anyway");
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
    }
  }

  /**
   * Waits until every write queued before this call has been applied, fan-outs included. For
   * draining and tests; a request thread never waits for search.
   *
   * @return {@code false} if {@code timeout} passed first
   */
  public boolean awaitQueuedWrites(final Duration timeout) throws InterruptedException {
    return lanes.awaitQueuedTasks(timeout) && fanOuts.awaitQueuedTasks(timeout);
  }

  /** Applies what is queued, then hands anything left after the drain to the retry queue. */
  @Override
  public void close() {
    lanes.close();
    fanOuts.close();
  }

  /**
   * Queues a search write of the caller's own on {@code entity}'s lane. {@code write} receives a
   * snapshot of the entity taken now.
   */
  public void queueWrite(
      final EntityInterface<?> entity,
      final String operation,
      final Consumer<EntityInterface<?>> write) {
    queueSnapshot(entity, operation, write);
  }

  private void queueSnapshot(
      final EntityInterface<?> entity,
      final String operation,
      final Consumer<EntityInterface<?>> write) {
    final EntityInterface<?> snapshot = JsonUtils.deepCopy(entity, entity.getClass());
    final EntityReference reference = entity.getEntityReference();
    queue(
        new OrderedLaneTask(
            SearchVersionGuard.readAt(clock.getAsLong(), () -> write.accept(snapshot)),
            operation,
            idOf(entity.getId()),
            entity.getFullyQualifiedName(),
            reference == null ? null : reference.getType()),
        entity.getId());
  }

  private void queueRecord(
      final EntityTimeSeriesInterface record,
      final String operation,
      final Consumer<EntityTimeSeriesInterface> write) {
    final EntityTimeSeriesInterface snapshot = JsonUtils.deepCopy(record, record.getClass());
    final EntityReference owner = record.getEntityReference();
    queue(
        new OrderedLaneTask(
            SearchVersionGuard.readAt(clock.getAsLong(), () -> write.accept(snapshot)),
            operation,
            idOf(record.getId()),
            owner == null ? null : owner.getFullyQualifiedName(),
            owner == null ? null : owner.getType()),
        record.getId());
  }

  /**
   * Stamps the guarded writes of {@code write} with the time it starts, before it reads the
   * database, so a write queued meanwhile with a newer read is not mistaken for an older one.
   */
  private Runnable readWhenRun(final Runnable write) {
    return () -> SearchVersionGuard.readAt(clock.getAsLong(), write).run();
  }

  /**
   * A queued write runs on a pooled thread that serves no HTTP request, so nothing else clears the
   * per-request caches it reads through; without this a rebuild could read an entity as an earlier
   * write on the same thread cached it.
   */
  private static OrderedLaneTask isolated(final OrderedLaneTask write) {
    return new OrderedLaneTask(
        () -> {
          PerRequestContextCleaner.clear();
          try {
            write.run();
          } finally {
            PerRequestContextCleaner.clear();
          }
        },
        write.operation(),
        write.entityId(),
        write.entityFqn(),
        write.entityType());
  }

  /**
   * A write made inside a transaction is queued once it commits, never before, by the committing
   * thread itself: queued through another lane first, it could land behind a write a later request
   * queued directly.
   */
  private void queue(final OrderedLaneTask task, final UUID laneKey) {
    final OrderedLaneTask write = isolated(task);
    SearchRepository.runAfterCommit(
        () -> lanes.submit(laneKey, write), task.operation(), task.entityFqn());
  }

  static void retryLater(final OrderedTask task, final Throwable failure) {
    if (task instanceof OrderedLaneTask write) {
      LOG.warn("Queued search write '{}' failed or was shed; retrying later", write.operation());
      SearchIndexRetryQueue.enqueue(
          write.entityId(),
          write.entityFqn(),
          write.entityType() == null ? "" : write.entityType(),
          SearchIndexRetryQueue.failureReason(write.operation(), failure));
    }
  }

  private static String idOf(final UUID id) {
    return id == null ? null : id.toString();
  }

  /**
   * The lane for a write known by id, else by name. One without either cannot be ordered against
   * anything, so any lane will do.
   */
  private static UUID laneKey(final String id, final String fqn) {
    final UUID key;
    if (SearchIndexRetryQueue.isUuid(id)) {
      key = UUID.fromString(id);
    } else if (fqn != null && !fqn.isEmpty()) {
      key = UUID.nameUUIDFromBytes(fqn.getBytes(StandardCharsets.UTF_8));
    } else {
      key = UUID.randomUUID();
    }
    return key;
  }
}
