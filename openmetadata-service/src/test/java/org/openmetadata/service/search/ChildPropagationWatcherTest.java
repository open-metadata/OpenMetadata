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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.ChildPropagationWatcher.TaskOutcome;

class ChildPropagationWatcherTest {
  private static final String PARENT = "8f0c2a8e-1c53-4b3e-9f39-5a3c1b1d2e4f";

  private final List<String> repaired = new ArrayList<>();

  @Test
  void aFailedPropagationQueuesItsParentWithTheFailure() {
    watch(taskId -> new TaskOutcome(true, List.of("es_rejected_execution_exception"), 0));

    assertEquals(List.of(PARENT + " updateChildren: es_rejected_execution_exception"), repaired);
  }

  @Test
  void childrenSkippedOnVersionConflictsQueueTheParent() {
    watch(taskId -> new TaskOutcome(true, List.of(), 2));

    assertEquals(
        List.of(PARENT + " updateChildren: 2 child document(s) skipped on version conflicts"),
        repaired);
  }

  @Test
  void aCleanPropagationQueuesNothing() {
    watch(taskId -> new TaskOutcome(true, List.of(), 0));

    assertTrue(repaired.isEmpty());
  }

  @Test
  void aPropagationStillRunningWhenTheWaitEndsQueuesNothing() {
    watch(taskId -> TaskOutcome.unfinished());

    assertTrue(repaired.isEmpty());
  }

  @Test
  void anUnreadableOutcomeQueuesNothing() {
    watch(
        taskId -> {
          throw new IOException("connection reset");
        });

    assertTrue(repaired.isEmpty());
  }

  private void watch(ChildPropagationWatcher.TaskAwaiter awaiter) {
    ChildPropagationWatcher.watch(
        "node:1",
        PARENT,
        awaiter,
        Runnable::run,
        (parentKey, reason) -> repaired.add(parentKey + " " + reason));
  }
}
