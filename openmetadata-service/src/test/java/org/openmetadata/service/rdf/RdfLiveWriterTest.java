/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

class RdfLiveWriterTest {
  private final Queue<String> persisted = new ArrayDeque<>();
  private final List<RdfLiveWrite> applied = new ArrayList<>();
  private final AtomicReference<Runnable> pendingTask = new AtomicReference<>();
  private final AtomicInteger dispatched = new AtomicInteger();
  private final AtomicBoolean reject = new AtomicBoolean();
  private final RdfLiveWriter writer =
      new RdfLiveWriter(
          store(),
          applied::add,
          task -> {
            if (reject.get()) {
              throw new RejectedExecutionException("executor full");
            }
            dispatched.incrementAndGet();
            assertTrue(pendingTask.compareAndSet(null, task));
          });

  @Test
  void dispatchMemoryIsBoundedAndEachDrainHasABudget() {
    for (int index = 0; index < 105; index++) {
      writer.enqueue(new RdfLiveWrite.EntityDelete("table", UUID.randomUUID()));
    }
    assertEquals(1, dispatched.get());
    assertEquals(105, persisted.size());
    runPending();
    assertEquals(100, applied.size());
    assertEquals(5, persisted.size());
    writer.wake();
    runPending();
    assertEquals(105, applied.size());
    assertTrue(persisted.isEmpty());
  }

  @Test
  void executorRejectionDoesNotLoseThePersistedCommand() {
    reject.set(true);
    final RdfLiveWrite command = new RdfLiveWrite.EntityDelete("table", UUID.randomUUID());
    writer.enqueue(command);
    assertEquals(1, persisted.size());
    assertTrue(applied.isEmpty());
    reject.set(false);
    writer.wake();
    runPending();
    assertEquals(List.of(command), applied);
    assertTrue(persisted.isEmpty());
  }

  @Test
  void closingTheWriterLeavesUndeliveredWorkForAnotherServer() {
    writer.enqueue(new RdfLiveWrite.EntityDelete("table", UUID.randomUUID()));
    writer.close();
    runPending();
    writer.wake();
    assertTrue(applied.isEmpty());
    assertFalse(persisted.isEmpty());
    assertEquals(1, dispatched.get());
  }

  @Test
  void retriesHaveABoundedExponentialBackoff() {
    assertEquals(1000, RdfLiveWriteStore.retryDelayMillis(1));
    assertEquals(2000, RdfLiveWriteStore.retryDelayMillis(2));
    assertEquals(32_000, RdfLiveWriteStore.retryDelayMillis(6));
    assertEquals(60_000, RdfLiveWriteStore.retryDelayMillis(Integer.MAX_VALUE));
    assertEquals(
        8192,
        RdfLiveWriteStore.failureReason(new IllegalStateException("x".repeat(9000))).length());
  }

  private void runPending() {
    pendingTask.getAndSet(null).run();
  }

  private RdfLiveWriteStore store() {
    final RdfLiveWriteStore store = mock(RdfLiveWriteStore.class);
    doAnswer(call -> persisted.add(call.getArgument(0))).when(store).enqueue(anyString());
    when(store.pendingWrites()).thenAnswer(call -> (long) persisted.size());
    when(store.processNext(any()))
        .thenAnswer(
            call -> {
              if (persisted.isEmpty()) {
                return false;
              }
              final Consumer<String> apply = call.getArgument(0);
              apply.accept(persisted.remove());
              return true;
            });
    return store;
  }
}
