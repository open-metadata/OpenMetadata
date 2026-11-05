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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PostCommitActionQueueTest {
  @AfterEach
  void clearQueue() {
    PostCommitActionQueue.clear();
  }

  @Test
  void runsImmediatelyWithoutTransactionScope() {
    final List<String> actions = new ArrayList<>();

    PostCommitActionQueue.runOrDefer(() -> actions.add("write"));

    assertEquals(List.of("write"), actions);
  }

  @Test
  void defersInOrderUntilTheOwningScopeDrains() {
    final List<String> actions = new ArrayList<>();

    assertTrue(PostCommitActionQueue.begin());
    PostCommitActionQueue.runOrDefer(() -> actions.add("first"));
    PostCommitActionQueue.runOrDefer(() -> actions.add("second"));
    assertEquals(List.of(), actions);

    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(List.of("first", "second"), actions);
  }

  @Test
  void nestedReplayRetainsOnlyActionsBeforeItsCheckpoint() {
    final List<String> actions = new ArrayList<>();
    assertTrue(PostCommitActionQueue.begin());
    PostCommitActionQueue.runOrDefer(() -> actions.add("outer"));
    final int checkpoint = PostCommitActionQueue.checkpoint();
    assertFalse(PostCommitActionQueue.begin());
    PostCommitActionQueue.runOrDefer(() -> actions.add("discarded"));

    PostCommitActionQueue.rollbackToCheckpoint(checkpoint);
    PostCommitActionQueue.runOrDefer(() -> actions.add("replayed"));
    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(List.of("outer", "replayed"), actions);
  }
}
