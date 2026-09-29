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
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.sdk.PipelineServiceClientInterface;

/**
 * Tails a run whose logs are served by the pipeline service client (Airflow, Argo, Kubernetes).
 *
 * <p>Those backends paginate a task's log file in fixed-size chunks and answer with
 * {@code {<taskId>: content, total: <chunks>, after: <nextChunk>}}, where {@code after} is only
 * present while earlier chunks remain. The final chunk of a running task keeps growing between
 * calls, so a cursor of "chunk index" alone would re-deliver the whole chunk on every poll.
 *
 * <p>The cursor is therefore {@code <chunkIndex>:<charsAlreadyDelivered>}: a poll re-reads the
 * current chunk but emits only the characters past the offset. That bounds every poll to one
 * backend call for one chunk, and makes repeated polling of a finished run free of duplicates.
 */
@Slf4j
public class PipelineServiceLogTailSource implements LogTailSource {

  private static final Set<String> METADATA_KEYS = Set.of("after", "total");
  private static final String AFTER_KEY = "after";
  private static final String CURSOR_SEPARATOR = ":";

  private final ChunkReader reader;
  private int chunkIndex;
  private int deliveredChars;

  public PipelineServiceLogTailSource(ChunkReader reader, String startCursor) {
    this.reader = reader;
    this.chunkIndex = parsePart(startCursor, 0);
    this.deliveredChars = parsePart(startCursor, 1);
  }

  @Override
  public LogChunk readNext() throws IOException {
    final Map<String, String> page = reader.read(Integer.toString(chunkIndex));
    String error = page == null ? null : page.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
    if (error != null) {
      throw new LogSourceUnavailableException(error);
    }
    final String chunk = extractContent(page);
    final String fresh = freshContent(chunk);
    deliveredChars = chunk.length();
    advanceChunk(page);
    return new LogChunk(fresh, cursor());
  }

  /**
   * The slice of the current chunk that has not been delivered yet. A chunk that shrank means the
   * backend moved to a different task attempt or run; re-sending from zero would duplicate a whole
   * chunk in the client's viewer, so the offset is re-anchored silently and the client picks the
   * new content up from there.
   */
  private String freshContent(String chunk) {
    String fresh = "";
    if (chunk.length() > deliveredChars) {
      fresh = chunk.substring(deliveredChars);
    } else if (chunk.length() < deliveredChars) {
      LOG.debug(
          "Log chunk {} shrank from {} to {} characters; re-anchoring the stream cursor",
          chunkIndex,
          deliveredChars,
          chunk.length());
    }
    return fresh;
  }

  /**
   * Only ever moves to an index the backend itself reported, so the cursor can never run past the
   * chunk count — Airflow rejects an out-of-range chunk with a 400.
   */
  private void advanceChunk(Map<String, String> page) {
    final Integer next = page == null ? null : parseOptional(page.get(AFTER_KEY));
    if (next != null && next != chunkIndex) {
      chunkIndex = next;
      deliveredChars = 0;
    }
  }

  private String cursor() {
    return chunkIndex + CURSOR_SEPARATOR + deliveredChars;
  }

  /**
   * The one task's content in a page. The backend answers with an unordered map, so the task is
   * picked by name rather than by iteration order: a page that carries more than one task must
   * resolve to the same task on every poll, otherwise the cursor would track a different log file
   * from one tick to the next.
   */
  private static String extractContent(Map<String, String> page) {
    String content = "";
    if (page != null) {
      content =
          page.entrySet().stream()
              .filter(entry -> !METADATA_KEYS.contains(entry.getKey()))
              .filter(entry -> entry.getValue() != null)
              .min(Map.Entry.comparingByKey())
              .map(Map.Entry::getValue)
              .orElse("");
    }
    return content;
  }

  private static int parsePart(String cursor, int part) {
    int value = 0;
    if (cursor != null && !cursor.isBlank()) {
      final String[] parts = cursor.split(CURSOR_SEPARATOR, -1);
      final Integer parsed = part < parts.length ? parseOptional(parts[part]) : null;
      value = parsed == null ? 0 : parsed;
    }
    return value;
  }

  private static Integer parseOptional(String value) {
    Integer parsed = null;
    if (value != null && !value.isBlank()) {
      try {
        parsed = Integer.valueOf(value.trim());
      } catch (NumberFormatException e) {
        LOG.warn("Ignoring non-numeric pipeline service log cursor '{}'", value);
      }
    }
    return parsed;
  }

  /** One chunk read against the pipeline service, already bound to a pipeline and run. */
  @FunctionalInterface
  public interface ChunkReader {
    Map<String, String> read(String afterCursor);
  }
}
