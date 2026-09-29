/*
 *  Copyright 2024 Collate
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

import org.flowable.common.engine.api.delegate.event.FlowableEngineEventType;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEventListener;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * Clears per-request ThreadLocal caches once an async job finishes.
 *
 * <p>Flowable's async-executor threads are pooled and long lived, and never pass through the JAX-RS
 * response filter that clears these ThreadLocals for HTTP requests. Without this, a parent entity
 * read by one job is served to every later job on the same thread for the life of the process.
 *
 * <p>Only the job-completion events are handled: both are dispatched on the async-executor thread
 * itself, after the job's delegates have finished, which mirrors the response filter's "clear once
 * the unit of work completes" semantics. Note the synchronous workflow path (a change event
 * signalling a process inline) does not produce these events — that thread is cleaned by {@code
 * AbstractEventConsumer}.
 */
public class WorkflowThreadCleanupListener implements FlowableEventListener {

  @Override
  public void onEvent(FlowableEvent event) {
    // Registered engine-wide, so every event lands here: keep the check cheap and first. Compare
    // against the enum constants rather than their names so that if Flowable renames an event type,
    // this fails to compile instead of silently never clearing again.
    if (event.getType() == FlowableEngineEventType.JOB_EXECUTION_SUCCESS
        || event.getType() == FlowableEngineEventType.JOB_EXECUTION_FAILURE) {
      PerRequestContextCleaner.clear();
    }
  }

  /** Cleanup must never fail the job that triggered it. */
  @Override
  public boolean isFailOnException() {
    return false;
  }

  @Override
  public boolean isFireOnTransactionLifecycleEvent() {
    return false;
  }

  @Override
  public String getOnTransaction() {
    return null;
  }
}
