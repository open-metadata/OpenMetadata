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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.search.EntityManagementClient.ChildUpdateStatus;

class InheritedFieldPropagationCheckTest {
  private static final Database PARENT = new Database().withId(UUID.randomUUID());
  private static final ChangeDescription CHANGE = new ChangeDescription().withPreviousVersion(0.1);
  private static final ChildUpdateStatus SCROLLS_REFUSED =
      new ChildUpdateStatus(true, "search_phase_execution_exception: Partial shards failure");

  private final Queue<Runnable> pendingChecks = new ArrayDeque<>();
  private final List<String> replays = new ArrayList<>();

  @Test
  void aPropagationTheEngineFailedIsQueuedForReplayWithItsChange() {
    watch(taskId -> SCROLLS_REFUSED);

    runChecks();

    assertEquals(
        List.of(
            "%s %s propagateInheritedFields: %s"
                .formatted(PARENT.getId(), CHANGE.getPreviousVersion(), SCROLLS_REFUSED.failure())),
        replays);
  }

  @Test
  void aSucceededPropagationQueuesNothing() {
    watch(taskId -> ChildUpdateStatus.succeeded());

    runChecks();

    assertTrue(replays.isEmpty());
  }

  @Test
  void aRunningTaskIsCheckedAgainUntilItFinishes() {
    List<ChildUpdateStatus> statuses =
        new ArrayList<>(
            List.of(ChildUpdateStatus.running(), ChildUpdateStatus.running(), SCROLLS_REFUSED));
    watch(taskId -> statuses.removeFirst());

    assertEquals(3, runChecks());
    assertEquals(1, replays.size());
  }

  @Test
  void aStatusReadThatFailsIsTriedAgain() {
    List<Boolean> readFails = new ArrayList<>(List.of(true, false));
    watch(
        taskId -> {
          if (readFails.removeFirst()) {
            throw new IOException("429 Too Many Requests");
          }
          return SCROLLS_REFUSED;
        });

    assertEquals(2, runChecks());
    assertEquals(1, replays.size());
  }

  @Test
  void aTaskStillRunningAtTheDeadlineIsLeftAlone() {
    watch(taskId -> ChildUpdateStatus.running());

    runChecks();

    assertTrue(replays.isEmpty());
  }

  @Test
  void repairsOfOneParentAreCapped() {
    InheritedFieldPropagationCheck check = check();
    for (int i = 0; i < InheritedFieldPropagationCheck.MAX_REPAIRS_PER_PARENT + 2; i++) {
      check.watch("node:" + i, PARENT, CHANGE);
    }

    runChecksOf(taskId -> SCROLLS_REFUSED);

    assertEquals(InheritedFieldPropagationCheck.MAX_REPAIRS_PER_PARENT, replays.size());
  }

  private InheritedFieldPropagationCheck.StatusReader reader;

  private InheritedFieldPropagationCheck check() {
    return new InheritedFieldPropagationCheck(
        (check, delay) -> pendingChecks.add(check),
        taskId -> reader.read(taskId),
        (parent, change, reason) ->
            replays.add("%s %s %s".formatted(parent.getId(), change.getPreviousVersion(), reason)));
  }

  private void watch(InheritedFieldPropagationCheck.StatusReader statusReader) {
    reader = statusReader;
    check().watch("node:1", PARENT, CHANGE);
  }

  private int runChecksOf(InheritedFieldPropagationCheck.StatusReader statusReader) {
    reader = statusReader;
    return runChecks();
  }

  private int runChecks() {
    int checks = 0;
    while (!pendingChecks.isEmpty()) {
      pendingChecks.poll().run();
      checks++;
    }
    return checks;
  }
}
