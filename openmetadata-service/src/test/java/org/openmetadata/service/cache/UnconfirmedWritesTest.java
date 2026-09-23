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
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class UnconfirmedWritesTest {

  @Test
  void deletedKeysAreForgotten() {
    UnconfirmedWrites writes = new UnconfirmedWrites(10);
    writes.record(List.of("a", "b", "a"));

    Map<String, Long> batch = writes.snapshot(10);
    writes.forget(batch);

    assertEquals(Set.of("a", "b"), batch.keySet());
    assertTrue(writes.isEmpty());
  }

  @Test
  void keyWrittenAgainWhileItsDeleteRanStaysPending() {
    UnconfirmedWrites writes = new UnconfirmedWrites(10);
    writes.record(List.of("a", "b"));
    Map<String, Long> batch = writes.snapshot(10);

    writes.record(List.of("a"));
    writes.forget(batch);

    assertEquals(Set.of("a"), writes.snapshot(10).keySet());
  }

  @Test
  void keysPastTheLimitAreCountedInsteadOfTracked() {
    UnconfirmedWrites writes = new UnconfirmedWrites(2);
    writes.record(List.of("a", "b", "c", "d", "a"));

    assertEquals(Set.of("a", "b"), writes.snapshot(10).keySet());
    assertEquals(2, writes.takeUntrackedCount());
    assertEquals(0, writes.takeUntrackedCount());
  }

  @Test
  void snapshotIsCappedAtTheRequestedSize() {
    UnconfirmedWrites writes = new UnconfirmedWrites(10);
    writes.record(List.of("a", "b", "c"));

    assertEquals(2, writes.snapshot(2).size());
  }

  @Test
  void nullKeysAreIgnored() {
    UnconfirmedWrites writes = new UnconfirmedWrites(10);
    writes.record(Arrays.asList(null, "a"));

    assertEquals(Set.of("a"), writes.snapshot(10).keySet());
  }
}
