package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.Execution;
import org.flowable.eventsubscription.api.EventSubscription;
import org.openmetadata.service.jdbi3.DeadlockRetry;

/** Delivers each signal subscription in its own retryable Flowable transaction. */
@Slf4j
final class WorkflowSignalDispatcher {
  private static final List<String> TRANSIENT_ERRORS =
      List.of(
          "deadlock",
          "lock wait timeout",
          "try restarting transaction",
          "updated by another transaction concurrently",
          "optimisticlockingfailureexception");
  private static final Retry RETRY =
      Retry.of(
          "workflow-signal-subscriber",
          RetryConfig.custom()
              .maxAttempts(3)
              .waitDuration(Duration.ofMillis(100))
              .retryOnException(WorkflowSignalDispatcher::isTransientDatabaseError)
              .build());

  // Each re-read follows one redeploy that happened during delivery.
  private static final int MAX_REREADS = 3;
  private static final String RELATED_ENTITY =
      getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);

  private final RuntimeService runtime;
  private final RepositoryService repository;

  WorkflowSignalDispatcher(final RuntimeService runtime, final RepositoryService repository) {
    this.runtime = runtime;
    this.repository = repository;
  }

  void dispatch(final String signal, final Map<String, Object> variables) {
    final Set<String> attempted = new HashSet<>();
    RuntimeException failure = null;
    List<EventSubscription> pending = read(signal, attempted, null);
    // A workflow redeployed while the signal is delivered deletes the version a listed subscription
    // belongs to, after replacing that subscription with one on the new version. Read again for the
    // replacements only: a start event keeps its activity id across versions, and any other
    // subscription has already had the signal.
    for (int reread = 0; !pending.isEmpty(); reread++) {
      final Delivery delivery = deliverToEach(pending, signal, variables);
      failure = withSuppressed(failure, delivery.failure());
      if (delivery.replacedStarts().isEmpty()) {
        break;
      }
      pending =
          reread < MAX_REREADS ? read(signal, attempted, delivery.replacedStarts()) : List.of();
      if (pending.isEmpty()) {
        LOG.warn(
            "Signal {} reached deleted workflow version(s) {} and no replacement; workflows"
                + " for {} did not start",
            signal,
            delivery.replacedStarts(),
            variables.get(RELATED_ENTITY));
      }
    }
    if (failure != null) {
      throw failure;
    }
  }

  /** Subscriptions not yet attempted, limited to the given start events when there are any. */
  private List<EventSubscription> read(
      final String signal, final Set<String> attempted, final Set<String> startActivityIds) {
    return RETRY
        .executeSupplier(
            () ->
                runtime.createEventSubscriptionQuery().eventType("signal").eventName(signal).list())
        .stream()
        .filter(
            subscription ->
                startActivityIds == null
                    || (subscription.getExecutionId() == null
                        && startActivityIds.contains(subscription.getActivityId())))
        .filter(subscription -> attempted.add(subscription.getId()))
        .toList();
  }

  /** The first delivery failure, with any later ones suppressed onto it. */
  private static RuntimeException withSuppressed(
      final RuntimeException failure, final RuntimeException next) {
    if (failure == null) {
      return next;
    }
    if (next != null) {
      failure.addSuppressed(next);
    }
    return failure;
  }

  private Delivery deliverToEach(
      final List<EventSubscription> subscriptions,
      final String signal,
      final Map<String, Object> variables) {
    RuntimeException failure = null;
    final Set<String> replacedStarts = new HashSet<>();
    for (EventSubscription subscription : subscriptions) {
      try {
        // Earlier subscribers have already committed; retry only the subscriber that failed.
        if (!RETRY.executeSupplier(() -> deliver(subscription, signal, variables))
            && subscription.getExecutionId() == null) {
          replacedStarts.add(subscription.getActivityId());
        }
      } catch (RuntimeException deliveryFailure) {
        // Each subscriber is an independent workflow, so one failing must not withhold the
        // signal from the others.
        failure = withSuppressed(failure, deliveryFailure);
      }
    }
    return new Delivery(failure, replacedStarts);
  }

  private record Delivery(RuntimeException failure, Set<String> replacedStarts) {}

  static boolean isTransientDatabaseError(final Throwable failure) {
    final String message = ExceptionUtils.getRootCauseMessage(failure).toLowerCase(Locale.ROOT);
    return DeadlockRetry.isDeadlock(failure)
        || TRANSIENT_ERRORS.stream().anyMatch(message::contains);
  }

  /**
   * Returns false when the subscription's workflow version has been deleted, so the signal is
   * owed to the version that replaced it. A suspended workflow takes no signal by design.
   */
  private boolean deliver(
      final EventSubscription subscription,
      final String signal,
      final Map<String, Object> variables) {
    final ProcessDefinition definition = definitionOf(subscription);
    if (definition == null) {
      return false;
    }
    if (definition.isSuspended()) {
      return true;
    }
    if (subscription.getExecutionId() == null) {
      try {
        start(subscription, definition, variables);
      } catch (RuntimeException startFailure) {
        // A redeploy's drain can delete this version between the lookup and the start.
        if (definitionOf(subscription) == null) {
          return false;
        }
        throw startFailure;
      }
    } else {
      resume(subscription, signal, variables);
    }
    return true;
  }

  private ProcessDefinition definitionOf(final EventSubscription subscription) {
    return repository
        .createProcessDefinitionQuery()
        .processDefinitionId(subscription.getProcessDefinitionId())
        .singleResult();
  }

  private void start(
      final EventSubscription subscription,
      final ProcessDefinition definition,
      final Map<String, Object> variables) {
    runtime
        .createProcessInstanceBuilder()
        .processDefinitionId(definition.getId())
        .startEventId(subscription.getActivityId())
        .variables(new LinkedHashMap<>(variables))
        .start();
  }

  private void resume(
      final EventSubscription subscription,
      final String signal,
      final Map<String, Object> variables) {
    final Execution execution =
        runtime.createExecutionQuery().executionId(subscription.getExecutionId()).singleResult();
    if (execution != null && !execution.isSuspended()) {
      runtime.signalEventReceived(signal, execution.getId(), new LinkedHashMap<>(variables));
    }
  }
}
