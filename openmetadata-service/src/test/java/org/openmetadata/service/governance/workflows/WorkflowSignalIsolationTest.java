/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.governance.workflows;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.eventsubscription.api.EventSubscription;
import org.junit.jupiter.api.Test;

class WorkflowSignalIsolationTest {
  @Test
  void signalsReachActiveStartAndWaitingSubscriptionsWhilePausedSubscribersAreSkipped()
      throws Exception {
    ProcessEngine engine = mock(ProcessEngine.class, RETURNS_DEEP_STUBS);
    WorkflowHandler handler = mock(WorkflowHandler.class, CALLS_REAL_METHODS);
    Field field = WorkflowHandler.class.getDeclaredField("processEngine");
    field.setAccessible(true);
    field.set(handler, engine);
    EventSubscription paused = subscription("paused", null);
    EventSubscription active = subscription("active", null);
    EventSubscription waiting = subscription("active", "running");
    EventSubscription pausedInstance = subscription("active", "paused-instance");
    var runtime = engine.getRuntimeService();
    when(runtime
            .createEventSubscriptionQuery()
            .eventType("signal")
            .eventName("metadata-created")
            .list())
        .thenReturn(List.of(paused, active, waiting, pausedInstance));
    var repository = engine.getRepositoryService();
    when(repository
            .createProcessDefinitionQuery()
            .processDefinitionId("paused")
            .active()
            .singleResult())
        .thenReturn(null);
    ProcessDefinition definition = mock(ProcessDefinition.class);
    when(definition.getId()).thenReturn("active");
    when(repository
            .createProcessDefinitionQuery()
            .processDefinitionId("active")
            .active()
            .singleResult())
        .thenReturn(definition);
    var running = runtime.createExecutionQuery().executionId("running").singleResult();
    when(running.getId()).thenReturn("running");
    when(runtime.createExecutionQuery().executionId("paused-instance").singleResult().isSuspended())
        .thenReturn(true);
    Map<String, Object> variables = Map.of("relatedEntity", "a-test-entity");

    handler.triggerWithSignal("metadata-created", variables);

    verify(runtime, never()).signalEventReceived("metadata-created", variables);
    verify(runtime.createProcessInstanceBuilder(), never()).processDefinitionId("paused");
    verify(
            runtime
                .createProcessInstanceBuilder()
                .processDefinitionId("active")
                .startEventId("start")
                .variables(variables))
        .start();
    verify(runtime).signalEventReceived("metadata-created", "running", variables);
    verify(runtime, never()).signalEventReceived("metadata-created", "paused-instance", variables);
  }

  private static EventSubscription subscription(String definition, String execution) {
    EventSubscription subscription = mock(EventSubscription.class);
    when(subscription.getProcessDefinitionId()).thenReturn(definition);
    when(subscription.getExecutionId()).thenReturn(execution);
    when(subscription.getActivityId()).thenReturn("start");
    return subscription;
  }
}
