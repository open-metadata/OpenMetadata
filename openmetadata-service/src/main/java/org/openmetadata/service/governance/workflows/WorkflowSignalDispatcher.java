package org.openmetadata.service.governance.workflows;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.Execution;
import org.flowable.eventsubscription.api.EventSubscription;
import org.openmetadata.service.jdbi3.DeadlockRetry;

/** Delivers each signal subscription in its own retryable Flowable transaction. */
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

  private final RuntimeService runtime;
  private final RepositoryService repository;

  WorkflowSignalDispatcher(final RuntimeService runtime, final RepositoryService repository) {
    this.runtime = runtime;
    this.repository = repository;
  }

  void dispatch(final String signal, final Map<String, Object> variables) {
    final List<EventSubscription> subscriptions =
        RETRY.executeSupplier(
            () ->
                runtime
                    .createEventSubscriptionQuery()
                    .eventType("signal")
                    .eventName(signal)
                    .list());
    // Earlier subscribers have already committed; retry only the subscriber that failed.
    for (EventSubscription subscription : subscriptions) {
      RETRY.executeRunnable(() -> deliver(subscription, signal, variables));
    }
  }

  static boolean isTransientDatabaseError(final Throwable failure) {
    final String message = ExceptionUtils.getRootCauseMessage(failure).toLowerCase(Locale.ROOT);
    return DeadlockRetry.isDeadlock(failure)
        || TRANSIENT_ERRORS.stream().anyMatch(message::contains);
  }

  private void deliver(
      final EventSubscription subscription,
      final String signal,
      final Map<String, Object> variables) {
    final ProcessDefinition definition =
        repository
            .createProcessDefinitionQuery()
            .processDefinitionId(subscription.getProcessDefinitionId())
            .active()
            .singleResult();
    if (definition == null) {
      return;
    }
    if (subscription.getExecutionId() == null) {
      start(subscription, definition, variables);
    } else {
      resume(subscription, signal, variables);
    }
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
