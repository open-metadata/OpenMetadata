package org.openmetadata.service.apps.logging;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RunLogBufferTest {

  @TempDir Path tempDir;

  @Test
  void appendAndFlushWritesToFile() throws IOException {
    Path logFile = tempDir.resolve("TestApp").resolve("1000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-1", "TestApp", "server1", 1000L, 100_000, logFile);
    buffer.startFlusher();

    buffer.append("first line");
    buffer.append("second line");
    buffer.flush();

    assertTrue(Files.exists(logFile));
    String content = Files.readString(logFile);
    assertTrue(content.contains("first line"));
    assertTrue(content.contains("second line"));

    buffer.close();
  }

  @Test
  void lineCountTrackingIsAccurate() {
    Path logFile = tempDir.resolve("CountApp").resolve("2000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-2", "CountApp", "server1", 2000L, 100_000, logFile);

    buffer.append("line 1");
    buffer.append("line 2");
    buffer.append("line 3");

    assertEquals(3, buffer.getTotalLineCount());
  }

  @Test
  void maxLinesCapDropsNewLines() {
    Path logFile = tempDir.resolve("MaxApp").resolve("3000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-3", "MaxApp", "server1", 3000L, 5, logFile);

    for (int i = 0; i < 10; i++) {
      buffer.append("line " + i);
    }

    assertEquals(5, buffer.getTotalLineCount());
    List<String> pending = buffer.getPendingLines();
    assertEquals(5, pending.size());
    assertEquals("line 0", pending.get(0));
    assertEquals("line 4", pending.get(4));
  }

  @Test
  void closeFlushesRemainingLines() throws IOException {
    Path logFile = tempDir.resolve("CloseApp").resolve("4000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-4", "CloseApp", "server1", 4000L, 100_000, logFile);
    buffer.startFlusher();

    buffer.append("before close");
    buffer.close();

    String content = Files.readString(logFile);
    assertTrue(content.contains("before close"));
    assertTrue(buffer.getPendingLines().isEmpty());
  }

  @Test
  void getPendingLinesReturnsUnflushedLines() {
    Path logFile = tempDir.resolve("PendApp").resolve("5000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-5", "PendApp", "server1", 5000L, 100_000, logFile);

    buffer.append("pending 1");
    buffer.append("pending 2");

    List<String> pending = buffer.getPendingLines();
    assertEquals(2, pending.size());
    assertEquals("pending 1", pending.get(0));
    assertEquals("pending 2", pending.get(1));
  }

  @Test
  void multipleFlushesAppendToSameFile() throws IOException {
    Path logFile = tempDir.resolve("MultiApp").resolve("6000-server1.log");
    RunLogBuffer buffer = new RunLogBuffer("app-6", "MultiApp", "server1", 6000L, 100_000, logFile);
    buffer.startFlusher();

    buffer.append("batch 1 line");
    buffer.flush();

    buffer.append("batch 2 line");
    buffer.flush();

    String content = Files.readString(logFile);
    assertTrue(content.contains("batch 1 line"));
    assertTrue(content.contains("batch 2 line"));

    buffer.close();
  }

  @Test
  void startFlusherWithUnwritablePathDoesNotCreateFlusher() {
    Path unwritable = Path.of("/proc/nonexistent/deep/path/log.log");
    RunLogBuffer buffer =
        new RunLogBuffer("app-7", "UnwriteApp", "server1", 7000L, 100_000, unwritable);

    buffer.startFlusher();

    buffer.append("line that won't be written");
    buffer.flush();

    assertFalse(Files.exists(unwritable));
  }

  @Test
  void closeWithoutStartFlusherDoesNotThrow() {
    Path logFile = tempDir.resolve("NoFlushApp").resolve("8000-server1.log");
    RunLogBuffer buffer =
        new RunLogBuffer("app-8", "NoFlushApp", "server1", 8000L, 100_000, logFile);

    buffer.append("some line");
    buffer.close();

    assertTrue(buffer.getPendingLines().isEmpty());
  }

  @Test
  void flushAfterCloseWriterDoesNotThrow() throws IOException {
    Path logFile = tempDir.resolve("DoubleClose").resolve("9000-server1.log");
    RunLogBuffer buffer =
        new RunLogBuffer("app-9", "DoubleClose", "server1", 9000L, 100_000, logFile);
    buffer.startFlusher();

    buffer.append("before first close");
    buffer.close();

    buffer.append("after close");
    buffer.flush();
  }

  @Test
  void writeToFileWithNullWriterIsNoOp() {
    Path logFile = tempDir.resolve("NullWriter").resolve("10000-server1.log");
    RunLogBuffer buffer =
        new RunLogBuffer("app-10", "NullWriter", "server1", 10000L, 100_000, logFile);

    buffer.append("no writer");
    buffer.flush();

    assertFalse(Files.exists(logFile));
  }
}
