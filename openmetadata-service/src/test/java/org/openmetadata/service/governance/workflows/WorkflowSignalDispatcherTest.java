package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceBuilder;
import org.flowable.eventsubscription.api.EventSubscription;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WorkflowSignalDispatcherTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "Deadlock found when trying to get lock",
        "Lock wait timeout exceeded",
        "try restarting transaction",
        "was updated by another transaction concurrently",
        "OptimisticLockingFailureException"
      })
  void retriesTransientFlowableFailures(final String message) {
    assertTrue(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalStateException(new SQLException(message))));
  }

  @ParameterizedTest
  @ValueSource(strings = {"40001", "40P01"})
  void recognizesDatabaseRollbackWithoutRelyingOnTheErrorMessage(final String state) {
    assertTrue(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalStateException(new SQLException("Localized database failure", state))));
  }

  @Test
  void doesNotRetryPermanentOrMissingFailures() {
    assertFalse(WorkflowSignalDispatcher.isTransientDatabaseError(null));
    assertFalse(WorkflowSignalDispatcher.isTransientDatabaseError(new IllegalStateException()));
    assertFalse(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalArgumentException("Invalid workflow configuration")));
  }

  private static final String SIGNAL = "domain-entityCreated";
  private static final Map<String, Object> VARIABLES =
      Map.of("global_relatedEntity", "<#E::domain::marked>");

  private RuntimeService runtime;
  private RepositoryService repository;
  private ProcessInstanceBuilder builder;

  @BeforeEach
  void flowable() {
    runtime = mock(RuntimeService.class, RETURNS_DEEP_STUBS);
    repository = mock(RepositoryService.class, RETURNS_DEEP_STUBS);
    builder = mock(ProcessInstanceBuilder.class, RETURNS_SELF);
    when(builder.start()).thenReturn(mock(ProcessInstance.class));
    when(runtime.createProcessInstanceBuilder()).thenReturn(builder);
  }

  @Test
  void signalOwedToADeletedVersionStartsTheVersionThatReplacedIt() {
    EventSubscription deleted = startSubscription("sub-v1", "trigger:1");
    EventSubscription replacement = startSubscription("sub-v2", "trigger:2");
    subscriptionsRead(List.of(deleted), List.of(replacement));
    definition("trigger:1", null);
    definition("trigger:2", active("trigger:2"));

    dispatcher().dispatch(SIGNAL, VARIABLES);

    verify(builder).processDefinitionId("trigger:2");
    verify(builder).start();
  }

  @Test
  void suspendedWorkflowTakesNoSignalAndIsNotReadAgain() {
    subscriptionsRead(List.of(startSubscription("sub-v1", "trigger:1")));
    ProcessDefinition suspended = active("trigger:1");
    when(suspended.isSuspended()).thenReturn(true);
    definition("trigger:1", suspended);

    dispatcher().dispatch(SIGNAL, VARIABLES);

    verify(builder, never()).start();
    verify(runtime.createEventSubscriptionQuery().eventType("signal").eventName(SIGNAL)).list();
  }

  @Test
  void deletedWorkflowWithoutReplacementStartsNothingAndDoesNotFail() {
    subscriptionsRead(List.of(startSubscription("sub-v1", "trigger:1")), List.of());
    definition("trigger:1", null);

    dispatcher().dispatch(SIGNAL, VARIABLES);

    verify(builder, never()).start();
  }

  @Test
  void eachSubscriptionIsDeliveredOnceAcrossReads() {
    EventSubscription other = startSubscription("sub-other", "other:1");
    EventSubscription deleted = startSubscription("sub-v1", "trigger:1");
    EventSubscription replacement = startSubscription("sub-v2", "trigger:2");
    subscriptionsRead(List.of(other, deleted), List.of(other, replacement));
    definition("other:1", active("other:1"));
    definition("trigger:1", null);
    definition("trigger:2", active("trigger:2"));

    dispatcher().dispatch(SIGNAL, VARIABLES);

    verify(builder).processDefinitionId("other:1");
    verify(builder).processDefinitionId("trigger:2");
    verify(builder, times(2)).start();
  }

  private WorkflowSignalDispatcher dispatcher() {
    return new WorkflowSignalDispatcher(runtime, repository);
  }

  @SafeVarargs
  private void subscriptionsRead(List<EventSubscription> first, List<EventSubscription>... later) {
    when(runtime.createEventSubscriptionQuery().eventType("signal").eventName(SIGNAL).list())
        .thenReturn(first, later);
  }

  private void definition(String id, ProcessDefinition definition) {
    when(repository.createProcessDefinitionQuery().processDefinitionId(id).singleResult())
        .thenReturn(definition);
  }

  private static ProcessDefinition active(String id) {
    ProcessDefinition definition = mock(ProcessDefinition.class);
    when(definition.getId()).thenReturn(id);
    return definition;
  }

  private static EventSubscription startSubscription(String id, String processDefinitionId) {
    EventSubscription subscription = mock(EventSubscription.class);
    when(subscription.getId()).thenReturn(id);
    when(subscription.getProcessDefinitionId()).thenReturn(processDefinitionId);
    when(subscription.getActivityId()).thenReturn("start");
    return subscription;
  }
}
