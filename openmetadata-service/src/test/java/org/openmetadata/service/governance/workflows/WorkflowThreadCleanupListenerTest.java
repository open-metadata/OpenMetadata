/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.flowable.common.engine.api.delegate.event.FlowableEngineEventType;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.ImpersonationContext;

/**
 * Flowable's async-executor threads are pooled and never pass through the JAX-RS response filter, so
 * without a job-boundary hook the per-request ThreadLocals survive from one job to the next and serve
 * stale reads for the life of the process.
 */
class WorkflowThreadCleanupListenerTest {

  private final WorkflowThreadCleanupListener listener = new WorkflowThreadCleanupListener();

  @AfterEach
  void tearDown() {
    ImpersonationContext.clear();
  }

  @Test
  void jobCompletion_clearsPerRequestContext() {
    for (FlowableEngineEventType type :
        new FlowableEngineEventType[] {
          FlowableEngineEventType.JOB_EXECUTION_SUCCESS,
          FlowableEngineEventType.JOB_EXECUTION_FAILURE
        }) {
      ImpersonationContext.setImpersonatedBy("someone");
      assertNotNull(ImpersonationContext.getImpersonatedBy(), "precondition for " + type);

      listener.onEvent(eventOfType(type));

      assertNull(
          ImpersonationContext.getImpersonatedBy(),
          type + " must clear per-request context so the next job on this thread starts clean");
    }
  }

  @Test
  void unrelatedEvent_leavesContextAlone() {
    ImpersonationContext.setImpersonatedBy("someone");

    listener.onEvent(eventOfType(FlowableEngineEventType.ENTITY_CREATED));

    assertNotNull(
        ImpersonationContext.getImpersonatedBy(),
        "Only job boundaries are cleanup points; the listener sees every engine event");
  }

  /** Cleanup is best-effort: it must never be able to fail the job that triggered it. */
  @Test
  void listenerNeverFailsTheJob() {
    assertFalse(listener.isFailOnException());
    assertFalse(listener.isFireOnTransactionLifecycleEvent());
    assertNull(listener.getOnTransaction());
  }

  private FlowableEvent eventOfType(FlowableEngineEventType type) {
    FlowableEvent event = mock(FlowableEvent.class);
    when(event.getType()).thenReturn(type);
    return event;
  }
}
