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
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.ChildPropagationWatcher.TaskOutcome;

class ChildPropagationWatcherTest {
  private static final String PARENT = "8f0c2a8e-1c53-4b3e-9f39-5a3c1b1d2e4f";
  private static final TaskOutcome CLEAN = new TaskOutcome(true, List.of(), 0);

  private final Queue<Runnable> pendingPolls = new ArrayDeque<>();
  private final List<String> repaired = new ArrayList<>();
  private final ChildPropagationWatcher watcher =
      new ChildPropagationWatcher(
          (poll, delay) -> pendingPolls.add(poll),
          (parentKey, reason) -> repaired.add("%s %s".formatted(parentKey, reason)));

  @Test
  void aFailedPropagationQueuesItsParentWithTheFailure() {
    watch(taskId -> new TaskOutcome(true, List.of("es_rejected_execution_exception"), 0));

    runPolls();

    assertEquals(List.of(PARENT + " updateChildren: es_rejected_execution_exception"), repaired);
  }

  @Test
  void childrenSkippedOnVersionConflictsQueueTheParent() {
    watch(taskId -> new TaskOutcome(true, List.of(), 2));

    runPolls();

    assertEquals(
        List.of(PARENT + " updateChildren: 2 child document(s) skipped on version conflicts"),
        repaired);
  }

  @Test
  void aRunningTaskIsPolledAgainUntilItFinishes() {
    List<TaskOutcome> outcomes =
        new ArrayList<>(
            List.of(
                TaskOutcome.unfinished(),
                TaskOutcome.unfinished(),
                new TaskOutcome(true, List.of("partial shards failure"), 0)));
    watch(taskId -> outcomes.removeFirst());

    int polls = runPolls();

    assertEquals(3, polls);
    assertEquals(List.of(PARENT + " updateChildren: partial shards failure"), repaired);
  }

  @Test
  void aTaskStillRunningAtTheDeadlineIsLeftAlone() {
    watch(taskId -> TaskOutcome.unfinished());

    int polls = runPolls();

    assertEquals(ChildPropagationWatcher.MAX_POLLS, polls);
    assertTrue(repaired.isEmpty());
  }

  @Test
  void aCleanPropagationQueuesNothing() {
    watch(taskId -> CLEAN);

    runPolls();

    assertTrue(repaired.isEmpty());
  }

  @Test
  void anUnreadableStatusIsReadAgainOnTheNextPoll() {
    List<Boolean> readFails = new ArrayList<>(List.of(true, false));
    watch(
        taskId -> {
          if (readFails.removeFirst()) {
            throw new IOException("429 Too Many Requests");
          }
          return new TaskOutcome(true, List.of("partial shards failure"), 0);
        });

    assertEquals(2, runPolls());
    assertEquals(List.of(PARENT + " updateChildren: partial shards failure"), repaired);
  }

  @Test
  void tasksPastTheWatchLimitAreNotWatched() {
    for (int i = 0; i <= ChildPropagationWatcher.MAX_WATCHED_TASKS; i++) {
      watch(taskId -> CLEAN);
    }

    assertEquals(ChildPropagationWatcher.MAX_WATCHED_TASKS, pendingPolls.size());
  }

  private void watch(ChildPropagationWatcher.TaskPoller poller) {
    watcher.watchTask("node:1", PARENT, poller);
  }

  private int runPolls() {
    int polls = 0;
    while (!pendingPolls.isEmpty()) {
      pendingPolls.poll().run();
      polls++;
    }
    return polls;
  }
}
