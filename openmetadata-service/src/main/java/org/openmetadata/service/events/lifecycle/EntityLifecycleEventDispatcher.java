/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.lifecycle;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Dispatcher for entity lifecycle events.
 * Manages a collection of EntityLifecycleEventHandler implementations and dispatches
 * events to them based on their configuration and priorities.
 */
@Slf4j
public class EntityLifecycleEventDispatcher {

  private static final String OP_CREATED = "onEntityCreated";
  private static final String OP_UPDATED = "onEntityUpdated";
  private static final String OP_DELETED = "onEntityDeleted";
  private static final String OP_SOFT_DELETE_RESTORE = "onEntitySoftDeletedOrRestored";

  private static volatile EntityLifecycleEventDispatcher instance;
  private final List<EntityLifecycleEventHandler> handlers;
  private final OrderedLaneExecutor orderedLaneExecutor;

  private EntityLifecycleEventDispatcher() {
    this.handlers = new ArrayList<>();
    this.orderedLaneExecutor = new OrderedLaneExecutor(this::enqueueLaneFailureRetry);
  }

  /**
   * Submit an ordered async side-effect onto the per-entity lane for {@code entityKey}. The shared
   * {@code OrderedLaneExecutor} is the single async substrate: the entity-index handler and the
   * {@code EntityRepository} post-commit drains (RDF / lineage-ES / rename-cascade search) all
   * submit onto the same lanes keyed by the flushed entity id, so every async side-effect for one
   * entity serializes on one single-consumer lane in submission order.
   */
  public void submitOrdered(UUID entityKey, OrderedTask task) {
    orderedLaneExecutor.submit(entityKey, task);
  }

  /**
   * Submit a post-commit external drain onto {@code laneKey}'s lane as a locator-CARRYING {@link
   * OrderedLaneTask}, using {@code laneKey} itself as the entity-id locator. On lane-queue-full
   * overflow or hard-stop the executor sheds the task to {@link SearchIndexRetryQueue} keyed by
   * {@code laneKey} instead of running the slow external inline on the request thread or losing it —
   * the request thread therefore never blocks and never runs the drain inline under overflow.
   */
  public void submitOrderedDrain(
      UUID laneKey, String operation, String entityType, Runnable drain) {
    OrderedLaneTask task =
        new OrderedLaneTask(drain, operation, laneKey.toString(), null, entityType);
    orderedLaneExecutor.submit(laneKey, task);
  }

  public static EntityLifecycleEventDispatcher getInstance() {
    if (instance == null) {
      synchronized (EntityLifecycleEventDispatcher.class) {
        if (instance == null) {
          instance = new EntityLifecycleEventDispatcher();
        }
      }
    }
    return instance;
  }

  /**
   * Register a new lifecycle event handler.
   * Handlers are automatically sorted by priority after registration.
   */
  public synchronized void registerHandler(EntityLifecycleEventHandler handler) {
    if (handler == null) {
      LOG.warn("Attempted to register null entity lifecycle handler");
      return;
    }

    // Check if handler with same name already exists
    boolean exists =
        handlers.stream().anyMatch(h -> h.getHandlerName().equals(handler.getHandlerName()));

    if (exists) {
      LOG.warn("Handler with name '{}' already registered, skipping", handler.getHandlerName());
      return;
    }

    handlers.add(handler);
    // Sort handlers by priority (lower priority values first)
    handlers.sort(Comparator.comparingInt(EntityLifecycleEventHandler::getPriority));

    LOG.info(
        "Registered entity lifecycle handler: {} with priority {}",
        handler.getHandlerName(),
        handler.getPriority());
  }

  /**
   * Unregister a lifecycle event handler by name.
   */
  public synchronized boolean unregisterHandler(String handlerName) {
    boolean removed = handlers.removeIf(h -> h.getHandlerName().equals(handlerName));
    if (removed) {
      LOG.info("Unregistered entity lifecycle handler: {}", handlerName);
    }
    return removed;
  }

  /**
   * Get list of all registered handlers.
   *
   * @return Unmodifiable list of handlers
   */
  public List<EntityLifecycleEventHandler> getHandlers() {
    return List.copyOf(handlers);
  }

  /**
   * Dispatch entity created event to all applicable handlers.
   */
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    if (entity == null) return;

    String entityType = entity.getEntityReference().getType();
    LOG.debug("Dispatching entity created event for {} {}", entityType, entity.getId());

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      executeHandler(entity, OP_CREATED, e -> handler.onEntityCreated(e, subjectContext), handler);
    }
  }

  /**
   * Dispatch bulk entity created event to all applicable handlers.
   *
   * <p>{@code createEntitiesIndex} writes each member's OWN search document, so each member's index
   * work must serialize on its OWN entity-id lane — never the first entity's lane. Submitting the
   * whole batch onto the first id's lane would let a later single update to a non-first member B
   * (which dispatches on B's lane) race B's create-index (on the first id's lane) across two lanes,
   * clobbering B's doc with stale create-time state. So an async handler is dispatched per entity,
   * each keyed on its own id; a sync handler still receives the whole list once for efficiency.
   */
  public void onEntitiesCreated(List<EntityInterface> entities, SubjectContext subjectContext) {
    if (entities == null || entities.isEmpty()) return;

    String entityType = entities.getFirst().getEntityReference().getType();
    LOG.debug(
        "Dispatching bulk entity created event for {} {} entities", entityType, entities.size());

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      dispatchBulkCreate(handler, entities, subjectContext);
    }
  }

  /**
   * Slice an async bulk create one lane task per entity id (each member's create-index lands on its
   * own single-consumer lane in submission order) so a later single update to a non-first member can
   * never reorder ahead of that member's create-index across lanes. A sync handler runs the whole
   * batch once.
   */
  private void dispatchBulkCreate(
      EntityLifecycleEventHandler handler,
      List<EntityInterface> entities,
      SubjectContext subjectContext) {
    if (handler.isAsync()) {
      for (EntityInterface entity : entities) {
        executeHandler(
            entity, OP_CREATED, e -> handler.onEntityCreated(e, subjectContext), handler);
      }
    } else {
      runInline(() -> handler.onEntitiesCreated(entities, subjectContext), handler);
    }
  }

  /**
   * Dispatch entity updated event to all applicable handlers.
   */
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (entity == null) return;

    String entityType = entity.getEntityReference().getType();
    LOG.debug("Dispatching entity updated event for {} {}", entityType, entity.getId());

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      executeHandler(
          entity,
          OP_UPDATED,
          e -> handler.onEntityUpdated(e, changeDescription, subjectContext),
          handler);
    }
  }

  /**
   * Dispatch a bulk entity updated event to all applicable handlers.
   * Handlers can implement onEntitiesUpdated for optimized bulk handling. Fallback to
   * per-entity onEntityUpdated if the handler does not override onEntitiesUpdated.
   * Assumes all the entity are of the same type for efficient dispatching (i.e. no loop for validation)
   *
   */
  public void onEntitiesUpdated(
      List<? extends EntityInterface> entities,
      ChangeDescription changeDescription,
      SubjectContext subjectContext) {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    String entityType = entities.getFirst().getEntityReference().getType();
    LOG.debug(
        "Dispatching bulk entity updated event for {} ({} entities)", entityType, entities.size());
    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      dispatchBulkUpdate(handler, entities, changeDescription, subjectContext);
    }
  }

  /**
   * Same-document update races matter for the update path, so a bulk update is sliced one lane task
   * per distinct entity id (each entity's doc rebuild lands on its own lane in submission order)
   * rather than submitting the whole batch onto one arbitrary lane. A sync handler still runs the
   * whole batch once for efficiency.
   */
  private void dispatchBulkUpdate(
      EntityLifecycleEventHandler handler,
      List<? extends EntityInterface> entities,
      ChangeDescription changeDescription,
      SubjectContext subjectContext) {
    if (handler.isAsync()) {
      for (EntityInterface entity : entities) {
        ChangeDescription change =
            entity.getChangeDescription() != null
                ? entity.getChangeDescription()
                : changeDescription;
        executeHandler(
            entity, OP_UPDATED, e -> handler.onEntityUpdated(e, change, subjectContext), handler);
      }
    } else {
      runInline(
          () -> handler.onEntitiesUpdated(entities, changeDescription, subjectContext), handler);
    }
  }

  /**
   * Dispatch entity updated event to all applicable handlers.
   */
  public void onEntityUpdated(EntityReference entityReference, SubjectContext subjectContext) {
    if (entityReference == null) return;

    String entityType = entityReference.getType();
    LOG.debug("Dispatching entity updated event for {} {}", entityType, entityReference.getId());

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      executeHandler(
          entityReference,
          OP_UPDATED,
          () -> handler.onEntityUpdated(entityReference, subjectContext),
          handler);
    }
  }

  /**
   * Dispatch entity deleted event to all applicable handlers.
   */
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    if (entity == null) return;

    String entityType = entity.getEntityReference().getType();
    LOG.debug("Dispatching entity deleted event for {} {}", entityType, entity.getId());

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      executeHandler(entity, OP_DELETED, e -> handler.onEntityDeleted(e, subjectContext), handler);
    }
  }

  /**
   * Dispatch entity soft deleted or restored event to all applicable handlers.
   */
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    if (entity == null) return;

    String entityType = entity.getEntityReference().getType();
    LOG.debug(
        "Dispatching entity soft delete/restore event for {} {} (deleted: {})",
        entityType,
        entity.getId(),
        isDeleted);

    for (EntityLifecycleEventHandler handler : getApplicableHandlers(entityType)) {
      executeHandler(
          entity,
          OP_SOFT_DELETE_RESTORE,
          e -> handler.onEntitySoftDeletedOrRestored(e, isDeleted, subjectContext),
          handler);
    }
  }

  private List<EntityLifecycleEventHandler> getApplicableHandlers(String entityType) {
    return handlers.stream()
        .filter(
            handler -> {
              var supportedTypes = handler.getSupportedEntityTypes();
              return supportedTypes.isEmpty() || supportedTypes.contains(entityType);
            })
        .toList();
  }

  private void executeHandler(
      EntityInterface entity,
      String operation,
      Consumer<EntityInterface> handlerCall,
      EntityLifecycleEventHandler handler) {
    if (handler.isAsync()) {
      // The request thread keeps mutating this same entity instance after dispatch (REST PII
      // masking, clearFields stripping for the response, secret masking on connections) while the
      // async lane reads it later, off the request thread, to build the search doc. Snapshot the
      // committed state now so the indexer never persists a masked/stripped/partial document.
      // Per-entity lane ordering does not help: the race is on the in-memory POJO, not lane order.
      EntityInterface snapshot =
          JsonUtils.readValue(JsonUtils.pojoToJson(entity), entity.getClass());
      orderedLaneExecutor.submit(
          entity.getId(), laneTask(entity, operation, () -> handlerCall.accept(snapshot)));
    } else {
      runInline(() -> handlerCall.accept(entity), handler);
    }
  }

  private void executeHandler(
      EntityReference reference,
      String operation,
      Runnable handlerExecution,
      EntityLifecycleEventHandler handler) {
    if (handler.isAsync()) {
      orderedLaneExecutor.submit(
          reference.getId(), laneTask(reference, operation, handlerExecution));
    } else {
      runInline(handlerExecution, handler);
    }
  }

  /**
   * Wrap the async handler run in an {@link OrderedLaneTask} carrying the entity locator so a {@link
   * Throwable} (including an {@link Error}) escaping the handler's own catch lands the side-effect in
   * the durable, entity-keyed search-index retry outbox via {@link #enqueueLaneFailureRetry} instead
   * of only logging — and so a lane-queue-full shed routes the same locator to the outbox.
   */
  private OrderedLaneTask laneTask(
      EntityInterface entity, String operation, Runnable handlerExecution) {
    EntityReference reference = entity.getEntityReference();
    return new OrderedLaneTask(
        handlerExecution,
        operation,
        entity.getId() != null ? entity.getId().toString() : null,
        entity.getFullyQualifiedName(),
        reference != null ? reference.getType() : null);
  }

  private OrderedLaneTask laneTask(
      EntityReference reference, String operation, Runnable handlerExecution) {
    return new OrderedLaneTask(
        handlerExecution,
        operation,
        reference.getId() != null ? reference.getId().toString() : null,
        reference.getFullyQualifiedName(),
        reference.getType());
  }

  private void runInline(Runnable handlerExecution, EntityLifecycleEventHandler handler) {
    try {
      handlerExecution.run();
    } catch (Exception e) {
      LOG.error("Sync entity lifecycle handler '{}' failed", handler.getHandlerName(), e);
    }
  }

  /**
   * Net for the durability gaps: a lane task that throws (any {@link Throwable}, incl. {@link Error})
   * before reaching a self-enqueueing {@code SearchRepository} method, or a task shed because its lane
   * queue was full, lands in the entity-keyed search-index retry outbox instead of being lost. Every
   * async handler dispatch and post-commit drain carries an {@link OrderedLaneTask} locator, so the
   * retry worker reindexes the entity's current committed state.
   */
  private void enqueueLaneFailureRetry(OrderedTask task, Throwable failure) {
    if (task instanceof OrderedLaneTask locatorTask) {
      LOG.warn(
          "Async ordered-lane task '{}' failed or was shed; enqueuing durable retry",
          locatorTask.operation(),
          failure);
      SearchIndexRetryQueue.enqueue(
          locatorTask.entityId(),
          locatorTask.entityFqn(),
          locatorTask.entityType() == null ? "" : locatorTask.entityType(),
          SearchIndexRetryQueue.failureReason(locatorTask.operation(), failure));
    } else {
      LOG.error("Async entity lifecycle lane task failed with no locator; cannot enqueue", failure);
    }
  }

  /**
   * Shutdown the dispatcher and its ordered-lane executor, draining in-flight async work and
   * flushing anything still queued at hard-stop to the search-index retry outbox so the
   * {@code SearchIndexRetryWorker} recovers it. Should be called during application shutdown.
   */
  public void shutdown() {
    LOG.info("Shutting down EntityLifecycleEventDispatcher");
    orderedLaneExecutor.close();
  }

  /**
   * Get count of registered handlers.
   *
   * @return Number of registered handlers
   */
  public int getHandlerCount() {
    return handlers.size();
  }
}
