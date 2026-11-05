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
package org.openmetadata.service.logstorage.stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Log storage paginates a run's log by line offset. These tests pin that the source walks that
 * offset forward exactly once per line, whether the backend reports the next offset itself or
 * leaves the caller to work it out after catching up.
 */
class StorageLogTailSourceTest {

  private static final int LINES_PER_READ = 3;

  @Test
  void walksThePagesForwardWithoutRepeatingALine() throws IOException {
    FakeLineStore store = new FakeLineStore();
    store.append("one", "two", "three", "four", "five");
    StorageLogTailSource source = new StorageLogTailSource(store, null, LINES_PER_READ);

    assertEquals("one\ntwo\nthree", source.readNext().content());
    assertEquals("four\nfive", source.readNext().content());
    assertTrue(source.readNext().isEmpty());
  }

  @Test
  void picksUpLinesAppendedAfterCatchingUp() throws IOException {
    FakeLineStore store = new FakeLineStore();
    store.append("first");
    StorageLogTailSource source = new StorageLogTailSource(store, null, LINES_PER_READ);
    source.readNext();

    store.append("second");

    assertEquals("second", source.readNext().content());
  }

  @Test
  void resumesFromTheCursorOfAPreviousStream() throws IOException {
    FakeLineStore store = new FakeLineStore();
    store.append("old", "older", "newest");
    StorageLogTailSource first = new StorageLogTailSource(store, null, LINES_PER_READ);
    String cursor = first.readNext().cursor();

    store.append("appended after the disconnect");
    StorageLogTailSource resumed = new StorageLogTailSource(store, cursor, LINES_PER_READ);

    assertEquals("appended after the disconnect", resumed.readNext().content());
  }

  @Test
  void neverRewindsTheCursorOnAnEmptyPage() throws IOException {
    FakeLineStore store = new FakeLineStore();
    StorageLogTailSource source = new StorageLogTailSource(store, null, LINES_PER_READ);

    assertEquals("0", source.readNext().cursor());
    assertEquals("0", source.readNext().cursor());
    assertEquals(List.of("0", "0"), store.requestedCursors());
  }

  @Test
  void anUnreadableCursorRestartsFromTheBeginningRatherThanFailing() throws IOException {
    FakeLineStore store = new FakeLineStore();
    store.append("only line");
    StorageLogTailSource source = new StorageLogTailSource(store, "not-a-number", LINES_PER_READ);

    assertEquals("only line", source.readNext().content());
  }

  /** Mimics {@code S3LogStorage.getLogs}: line-offset pagination over a growing list of lines. */
  private static final class FakeLineStore implements StorageLogTailSource.LogPageReader {

    private final List<String> lines = new ArrayList<>();
    private final List<String> requestedCursors = new ArrayList<>();

    void append(String... newLines) {
      Collections.addAll(lines, newLines);
    }

    List<String> requestedCursors() {
      return List.copyOf(requestedCursors);
    }

    @Override
    public Map<String, Object> read(String afterCursor, int limit) {
      requestedCursors.add(afterCursor);
      int start = afterCursor == null ? 0 : Integer.parseInt(afterCursor);
      int end = Math.min(start + limit, lines.size());
      List<String> page = start < lines.size() ? lines.subList(start, end) : List.of();

      Map<String, Object> result = new HashMap<>();
      result.put("logs", String.join("\n", page));
      result.put("after", end < lines.size() ? String.valueOf(end) : null);
      result.put("total", (long) lines.size());
      return result;
    }
  }
}
