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

  // Each read follows one redeploy that happened during delivery.
  private static final int MAX_SUBSCRIPTION_READS = 3;
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
    List<EventSubscription> pending = unattempted(signal, attempted);
    // A workflow redeployed while the signal is delivered deletes the version a listed subscription
    // belongs to, after moving the subscription to the new version: read again to reach it.
    for (int read = 1; !pending.isEmpty(); read++) {
      final Delivery delivery = deliverToEach(pending, signal, variables);
      failure = withSuppressed(failure, delivery.failure());
      if (delivery.replacedVersions() == 0) {
        break;
      }
      pending = unattempted(signal, attempted);
      if (pending.isEmpty() || read == MAX_SUBSCRIPTION_READS) {
        LOG.warn(
            "Signal {} reached {} deleted workflow version(s) and {} replacement subscription(s)"
                + " after {} read(s); workflows for {} did not start",
            signal,
            delivery.replacedVersions(),
            pending.size(),
            read,
            variables.get(RELATED_ENTITY));
        break;
      }
    }
    if (failure != null) {
      throw failure;
    }
  }

  private List<EventSubscription> unattempted(final String signal, final Set<String> attempted) {
    return RETRY
        .executeSupplier(
            () ->
                runtime.createEventSubscriptionQuery().eventType("signal").eventName(signal).list())
        .stream()
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
    int replacedVersions = 0;
    for (EventSubscription subscription : subscriptions) {
      try {
        // Earlier subscribers have already committed; retry only the subscriber that failed.
        if (!RETRY.executeSupplier(() -> deliver(subscription, signal, variables))) {
          replacedVersions++;
        }
      } catch (RuntimeException deliveryFailure) {
        // Each subscriber is an independent workflow, so one failing must not withhold the
        // signal from the others.
        failure = withSuppressed(failure, deliveryFailure);
      }
    }
    return new Delivery(failure, replacedVersions);
  }

  private record Delivery(RuntimeException failure, int replacedVersions) {}

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
    final ProcessDefinition definition =
        repository
            .createProcessDefinitionQuery()
            .processDefinitionId(subscription.getProcessDefinitionId())
            .singleResult();
    if (definition == null) {
      return false;
    }
    if (definition.isSuspended()) {
      return true;
    }
    if (subscription.getExecutionId() == null) {
      start(subscription, definition, variables);
    } else {
      resume(subscription, signal, variables);
    }
    return true;
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
