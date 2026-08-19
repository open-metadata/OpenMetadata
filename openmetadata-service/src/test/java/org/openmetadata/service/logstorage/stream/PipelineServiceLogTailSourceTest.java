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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.logstorage.stream.LogTailSource.LogChunk;

/**
 * The pipeline service (Airflow, Argo) paginates a task log in fixed-size chunks and keeps
 * appending to the last one while the task runs. These tests pin the two properties that make
 * tailing it safe: a growing chunk is never re-delivered, and the cursor never moves to a chunk the
 * backend did not offer — Airflow answers an out-of-range chunk with a 400.
 */
class PipelineServiceLogTailSourceTest {

  private static final String TASK_ID = "ingestion_task";

  @Test
  void deliversOnlyTheGrowthOfAChunkBetweenPolls() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend();
    backend.append("line one\n");
    PipelineServiceLogTailSource source = new PipelineServiceLogTailSource(backend, null);

    assertEquals("line one\n", source.readNext().content());

    backend.append("line two\n");
    assertEquals("line two\n", source.readNext().content());
  }

  @Test
  void repeatedPollsOfAnUnchangedChunkDeliverNothing() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend();
    backend.append("only line\n");
    PipelineServiceLogTailSource source = new PipelineServiceLogTailSource(backend, null);

    assertEquals("only line\n", source.readNext().content());
    assertTrue(source.readNext().isEmpty());
    assertTrue(source.readNext().isEmpty());
    assertEquals(3, backend.reads());
  }

  @Test
  void walksForwardThroughChunksTheBackendOffers() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend(4);
    backend.append("aaaabbbbcc");
    PipelineServiceLogTailSource source = new PipelineServiceLogTailSource(backend, null);

    StringBuilder streamed = new StringBuilder();
    for (int read = 0; read < 3; read++) {
      streamed.append(source.readNext().content());
    }

    assertEquals("aaaabbbbcc", streamed.toString());
    assertTrue(source.readNext().isEmpty(), "the tail chunk has nothing new to add");
  }

  @Test
  void neverAsksForAChunkTheBackendDidNotOffer() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend(4);
    backend.append("aaaabb");
    PipelineServiceLogTailSource source = new PipelineServiceLogTailSource(backend, null);

    for (int read = 0; read < 6; read++) {
      source.readNext();
    }

    assertTrue(
        backend.requestedChunks().stream().allMatch(chunk -> chunk <= 1),
        "requested chunks must stay within the two the backend reported, got "
            + backend.requestedChunks());
  }

  @Test
  void resumesFromACursorWithoutRedeliveringEarlierContent() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend();
    backend.append("already seen\n");
    PipelineServiceLogTailSource first = new PipelineServiceLogTailSource(backend, null);
    LogChunk delivered = first.readNext();

    backend.append("brand new\n");
    PipelineServiceLogTailSource resumed =
        new PipelineServiceLogTailSource(backend, delivered.cursor());

    assertEquals("brand new\n", resumed.readNext().content());
  }

  @Test
  void aShrinkingChunkIsReAnchoredInsteadOfRedelivered() throws IOException {
    FakeChunkedBackend backend = new FakeChunkedBackend();
    backend.append("run one output\n");
    PipelineServiceLogTailSource source = new PipelineServiceLogTailSource(backend, null);
    source.readNext();

    backend.reset("short\n");
    assertTrue(source.readNext().isEmpty(), "a shrunk chunk must not be replayed as new content");

    backend.append("after reset\n");
    assertEquals("after reset\n", source.readNext().content());
  }

  @Test
  void followsTheSameTaskWhenTheBackendReportsSeveral() throws IOException {
    Map<String, String> firstPage = new HashMap<>();
    firstPage.put("zzz_last_task", "output of the last task\n");
    firstPage.put("aaa_first_task", "output of the first task\n");
    Map<String, String> secondPage = new HashMap<>(firstPage);
    secondPage.put("aaa_first_task", "output of the first task\nand more of it\n");
    List<Map<String, String>> pages = new ArrayList<>(List.of(firstPage, secondPage));
    PipelineServiceLogTailSource source =
        new PipelineServiceLogTailSource(after -> pages.remove(0), null);

    assertEquals("output of the first task\n", source.readNext().content());
    assertEquals(
        "and more of it\n",
        source.readNext().content(),
        "a page with several tasks must resolve to the same task on every read");
  }

  @Test
  void doesNotRenderBackendErrorsAsLogContent() throws IOException {
    PipelineServiceLogTailSource source =
        new PipelineServiceLogTailSource(
            after ->
                Map.of(
                    PipelineServiceClientInterface.LOGS_ERROR_KEY,
                    "Kubernetes pod status could not be parsed"),
            null);

    assertThrows(LogSourceUnavailableException.class, source::readNext);
  }

  /**
   * Mimics {@code last_dag_logs}: content is split into fixed-size chunks, {@code after} is present
   * only while later chunks exist, and the final chunk keeps growing.
   */
  private static final class FakeChunkedBackend
      implements PipelineServiceLogTailSource.ChunkReader {

    private final int chunkSize;
    private final List<Integer> requestedChunks = new ArrayList<>();
    private String content = "";

    FakeChunkedBackend() {
      this(1_000_000);
    }

    FakeChunkedBackend(int chunkSize) {
      this.chunkSize = chunkSize;
    }

    void append(String more) {
      content += more;
    }

    void reset(String replacement) {
      content = replacement;
    }

    int reads() {
      return requestedChunks.size();
    }

    List<Integer> requestedChunks() {
      return List.copyOf(requestedChunks);
    }

    @Override
    public Map<String, String> read(String afterCursor) {
      int index = afterCursor == null ? 0 : Integer.parseInt(afterCursor);
      requestedChunks.add(index);
      int totalChunks = Math.max(1, (content.length() + chunkSize - 1) / chunkSize);
      int start = Math.min(index * chunkSize, content.length());
      int end = Math.min(start + chunkSize, content.length());

      Map<String, String> page = new HashMap<>();
      page.put(TASK_ID, content.substring(start, end));
      page.put("total", String.valueOf(totalChunks));
      if (index < totalChunks - 1) {
        page.put("after", String.valueOf(index + 1));
      }
      return page;
    }
  }
}
