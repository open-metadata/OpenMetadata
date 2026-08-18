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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;

import java.util.concurrent.atomic.AtomicInteger;
import org.flowable.common.engine.impl.cfg.TransactionContext;
import org.flowable.common.engine.impl.cfg.TransactionListener;
import org.flowable.common.engine.impl.cfg.TransactionState;
import org.flowable.common.engine.impl.context.Context;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

/**
 * Behavioural test for the write-ordering fix that stops the spurious 409 on the next transition of a
 * workflow with an async {@code automatedTask} between two user tasks (e.g. DAR's PolicyAgent).
 *
 * <p>{@code CreateTask} runs as a Flowable TaskListener inside the command that creates the next
 * runtime user task. Persisting the entity's stage/availableTransitions inline commits on JDBI ahead
 * of the Flowable commit, so a client can see (and resolve) a transition before its runtime task
 * exists. The fix defers that persist to a {@code TransactionState.COMMITTED} transaction listener.
 *
 * <p>This exercises the ordering seam directly — the Flowable {@link TransactionContext} is the only
 * (framework-boundary) mock — and asserts the observable behaviour: the persist does not run inline,
 * it is registered as a COMMITTED listener, it runs when that listener fires, and it runs inline only
 * when there is no active transaction context. The full workflow behaviour is covered by the Collate
 * DAR integration tests (DarStatusGroupIT / DataAccessRequestValidationIT / DataAccessRequestIT).
 */
class CreateTaskPostCommitPersistTest {

  @Test
  void persistIsDeferredToCommittedTransactionListener() {
    try (MockedStatic<Context> context = mockStatic(Context.class)) {
      TransactionContext transactionContext = mock(TransactionContext.class);
      context.when(Context::getTransactionContext).thenReturn(transactionContext);
      AtomicInteger persisted = new AtomicInteger(0);

      new CreateTask().registerPostCommitPersist(persisted::incrementAndGet);

      assertFalse(persisted.get() > 0, "persist must not run inline while the command is open");

      ArgumentCaptor<TransactionListener> listener =
          ArgumentCaptor.forClass(TransactionListener.class);
      verify(transactionContext)
          .addTransactionListener(eq(TransactionState.COMMITTED), listener.capture());

      listener.getValue().execute(null);
      assertTrue(
          persisted.get() == 1, "persist must run exactly once when the commit listener fires");
    }
  }

  @Test
  void persistRunsInlineWhenNoTransactionContext() {
    try (MockedStatic<Context> context = mockStatic(Context.class)) {
      context.when(Context::getTransactionContext).thenReturn(null);
      AtomicInteger persisted = new AtomicInteger(0);

      new CreateTask().registerPostCommitPersist(persisted::incrementAndGet);

      assertTrue(persisted.get() == 1, "with no transaction context the persist must run inline");
    }
  }

  @Test
  void persistFailureInListenerIsContainedNotPropagated() {
    try (MockedStatic<Context> context = mockStatic(Context.class)) {
      TransactionContext transactionContext = mock(TransactionContext.class);
      context.when(Context::getTransactionContext).thenReturn(transactionContext);

      new CreateTask()
          .registerPostCommitPersist(
              () -> {
                throw new RuntimeException("db down");
              });

      ArgumentCaptor<TransactionListener> listener =
          ArgumentCaptor.forClass(TransactionListener.class);
      verify(transactionContext)
          .addTransactionListener(eq(TransactionState.COMMITTED), listener.capture());

      // Flowable has already committed; a persist failure must not escape the listener (it would
      // have nothing to roll back). The entity self-heals on the next stage advance.
      assertDoesNotThrow(() -> listener.getValue().execute(null));
    }
  }
}
