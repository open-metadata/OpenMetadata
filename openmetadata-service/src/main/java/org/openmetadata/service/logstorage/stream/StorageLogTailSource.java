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

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.logstorage.LogStorageInterface;

/**
 * Tails a run whose logs live in a {@link LogStorageInterface} such as S3.
 *
 * <p>The storage cursor is a zero-based line offset into the run's log. Each read asks for at most
 * {@code linesPerRead} lines starting at the current offset, so a multi-gigabyte log never lands in
 * heap: only one page at a time does.
 *
 * <p>Storage reports the next offset in {@code after} whenever more lines are already available;
 * that value is authoritative and is preferred over counting. When storage has been fully consumed
 * it returns {@code after == null}, and the offset advances by the number of lines just read.
 */
@Slf4j
public class StorageLogTailSource implements LogTailSource {

  private static final String LOGS_KEY = "logs";
  private static final String AFTER_KEY = "after";

  private final LogPageReader reader;
  private final int linesPerRead;
  private long lineOffset;

  public StorageLogTailSource(LogPageReader reader, String startCursor, int linesPerRead) {
    this.reader = reader;
    this.linesPerRead = linesPerRead;
    this.lineOffset = parseCursor(startCursor);
  }

  @Override
  public LogChunk readNext() throws IOException {
    final Map<String, Object> page = reader.read(Long.toString(lineOffset), linesPerRead);
    final String content = page == null ? "" : asString(page.get(LOGS_KEY));
    lineOffset = nextOffset(page, content);
    return new LogChunk(content, Long.toString(lineOffset));
  }

  private long nextOffset(Map<String, Object> page, String content) {
    final Long reported = page == null ? null : parseOptional(asString(page.get(AFTER_KEY)));
    return reported != null ? reported : lineOffset + countLines(content);
  }

  /**
   * Storage joins a page's lines with {@code \n}, so a non-empty page holds one more line than it
   * holds separators.
   */
  private static long countLines(String content) {
    long lines = 0;
    if (content != null && !content.isEmpty()) {
      lines = content.chars().filter(character -> character == '\n').count() + 1;
    }
    return lines;
  }

  private static String asString(Object value) {
    return value == null ? "" : value.toString();
  }

  private static long parseCursor(String cursor) {
    final Long parsed = parseOptional(cursor);
    return parsed == null ? 0L : parsed;
  }

  private static Long parseOptional(String value) {
    Long parsed = null;
    if (value != null && !value.isBlank()) {
      try {
        parsed = Long.valueOf(value.trim());
      } catch (NumberFormatException e) {
        LOG.warn("Ignoring non-numeric log storage cursor '{}'", value);
      }
    }
    return parsed;
  }

  /** One page read against log storage, already bound to a pipeline FQN and run. */
  @FunctionalInterface
  public interface LogPageReader {
    Map<String, Object> read(String afterCursor, int limit) throws IOException;
  }
}
