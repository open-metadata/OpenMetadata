package org.openmetadata.service.apps.logging;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxy;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AppRunLogAppenderTest {

  @TempDir Path tempDir;

  private AppRunLogAppender appender;
  private LoggerContext loggerContext;

  @BeforeEach
  void setUp() {
    AppRunLogAppender.setLogDirectoryForTest(tempDir.toString());
    loggerContext = new LoggerContext();
    appender = new AppRunLogAppender();
    appender.setContext(loggerContext);
    appender.start();
  }

  @AfterEach
  void tearDown() {
    AppRunLogAppender.getActiveBuffers().clear();
    AppRunLogAppender.resetForTest();
    appender.stop();
  }

  @Test
  void eventsWithoutMdcAreIgnored() {
    LoggingEvent event = createEvent("test message", Map.of());
    appender.append(event);
    assertTrue(AppRunLogAppender.getActiveBuffers().isEmpty());
  }

  @Test
  void eventsWithMdcAreCapturedInBuffer() {
    String runId = "1000";
    AppRunLogAppender.startCapture(runId, "app-id-1", "TestApp", "server1");
    RunLogBuffer buffer = AppRunLogAppender.getBuffer("TestApp", runId);
    assertNotNull(buffer);

    Map<String, String> mdc = new HashMap<>();
    mdc.put(AppRunLogAppender.MDC_APP_RUN_ID, runId);
    mdc.put(AppRunLogAppender.MDC_APP_NAME, "TestApp");
    LoggingEvent event = createEvent("hello world", mdc);
    appender.append(event);

    List<String> pending = buffer.getPendingLines();
    assertEquals(1, pending.size());
    assertTrue(pending.get(0).contains("hello world"));

    AppRunLogAppender.stopCapture("TestApp", runId);
  }

  @Test
  void stopCaptureRemovesBuffer() {
    String runId = "2000";
    AppRunLogAppender.startCapture(runId, "app-id-2", "TestApp", "server1");
    assertNotNull(AppRunLogAppender.getBuffer("TestApp", runId));

    AppRunLogAppender.stopCapture("TestApp", runId);
    assertNull(AppRunLogAppender.getBuffer("TestApp", runId));
  }

  @Test
  void logFileIsCreatedOnFlush() throws IOException {
    String runId = "3000";
    AppRunLogAppender.startCapture(runId, "app-id-3", "TestApp", "server1");
    RunLogBuffer buffer = AppRunLogAppender.getBuffer("TestApp", runId);

    buffer.append("line one");
    buffer.append("line two");
    buffer.flush();

    Path logFile = buffer.getLogFile();
    assertTrue(Files.exists(logFile));
    String content = Files.readString(logFile);
    assertTrue(content.contains("line one"));
    assertTrue(content.contains("line two"));

    AppRunLogAppender.stopCapture("TestApp", runId);
  }

  @Test
  void listServersForRunReturnsCorrectServers() throws IOException {
    Path appDir = tempDir.resolve("MyApp");
    Files.createDirectories(appDir);
    Files.createFile(appDir.resolve("5000-server1.log"));
    Files.createFile(appDir.resolve("5000-server2.log"));
    Files.createFile(appDir.resolve("6000-server1.log"));

    List<Long> timestamps5000 = AppRunLogAppender.listRunTimestamps("MyApp");
    assertTrue(timestamps5000.contains(5000L));
    assertTrue(timestamps5000.contains(6000L));
  }

  @Test
  void listRunTimestampsReturnsSortedDescending() throws IOException {
    Path appDir = tempDir.resolve("SortApp");
    Files.createDirectories(appDir);
    Files.createFile(appDir.resolve("1000-s1.log"));
    Files.createFile(appDir.resolve("3000-s1.log"));
    Files.createFile(appDir.resolve("2000-s1.log"));

    List<Long> timestamps = AppRunLogAppender.listRunTimestamps("SortApp");
    assertEquals(List.of(3000L, 2000L, 1000L), timestamps);
  }

  @Test
  void cleanupOldRunsDeletesExcessFiles() throws IOException {
    Path appDir = tempDir.resolve("CleanApp");
    Files.createDirectories(appDir);
    Files.createFile(appDir.resolve("1000-s1.log"));
    Files.createFile(appDir.resolve("2000-s1.log"));
    Files.createFile(appDir.resolve("3000-s1.log"));

    AppRunLogAppender.setMaxRunsPerAppForTest(2);

    AppRunLogAppender.cleanupOldRuns("CleanApp");

    assertTrue(Files.exists(appDir.resolve("3000-s1.log")), "newest run should be kept");
    assertTrue(Files.exists(appDir.resolve("2000-s1.log")), "2nd newest run should be kept");
    assertFalse(Files.exists(appDir.resolve("1000-s1.log")), "oldest run should be deleted");

    AppRunLogAppender.setMaxRunsPerAppForTest(5);
  }

  @Test
  void cleanupOldRunsKeepsExactlyMaxRuns() throws IOException {
    Path appDir = tempDir.resolve("ExactApp");
    Files.createDirectories(appDir);
    Files.createFile(appDir.resolve("1000-s1.log"));
    Files.createFile(appDir.resolve("2000-s1.log"));

    AppRunLogAppender.setMaxRunsPerAppForTest(2);

    AppRunLogAppender.cleanupOldRuns("ExactApp");

    assertTrue(Files.exists(appDir.resolve("2000-s1.log")), "should not delete when at limit");
    assertTrue(Files.exists(appDir.resolve("1000-s1.log")), "should not delete when at limit");

    AppRunLogAppender.setMaxRunsPerAppForTest(5);
  }

  @Test
  void concurrentWritesFromMultipleThreadsAreSafe() throws InterruptedException {
    String runId = "7000";
    AppRunLogAppender.startCapture(runId, "app-id-7", "ConcurrentApp", "server1");
    RunLogBuffer buffer = AppRunLogAppender.getBuffer("ConcurrentApp", runId);

    int threadCount = 10;
    int linesPerThread = 100;
    Thread[] threads = new Thread[threadCount];
    for (int i = 0; i < threadCount; i++) {
      final int threadIdx = i;
      threads[i] =
          new Thread(
              () -> {
                for (int j = 0; j < linesPerThread; j++) {
                  buffer.append("thread-" + threadIdx + "-line-" + j);
                }
              });
      threads[i].start();
    }
    for (Thread t : threads) {
      t.join();
    }

    assertEquals(threadCount * linesPerThread, buffer.getTotalLineCount());
    AppRunLogAppender.stopCapture("ConcurrentApp", runId);
  }

  @Test
  void formatLineProducesJsonMatchingDropwizardLayout() {
    LoggingEvent event = createEvent("reindex started", Map.of());
    event.setLoggerName("org.openmetadata.service.apps.bundles.searchIndex.SearchIndexExecutor");
    event.setTimeStamp(1774260643332L);
    String line = AppRunLogAppender.formatLine(event);
    assertTrue(line.startsWith("{\"timestamp\":1774260643332,"), "should start with timestamp");
    assertTrue(line.contains("\"level\":\"INFO\""), "should contain level");
    assertTrue(line.contains("\"thread\":\"test-thread\""), "should contain thread");
    assertTrue(
        line.contains(
            "\"logger\":\"org.openmetadata.service.apps.bundles.searchIndex.SearchIndexExecutor\""),
        "should contain full logger name");
    assertTrue(line.contains("\"message\":\"reindex started\""), "should contain message");
    assertTrue(line.endsWith("}"), "should be valid JSON object");
  }

  @Test
  void formatLineEscapesSpecialCharacters() {
    LoggingEvent event = createEvent("line1\nline2\ttab \"quoted\"", Map.of());
    String line = AppRunLogAppender.formatLine(event);
    assertTrue(line.contains("\\n"), "newlines should be escaped");
    assertTrue(line.contains("\\t"), "tabs should be escaped");
    assertTrue(line.contains("\\\"quoted\\\""), "quotes should be escaped");
  }

  @Test
  void threadPrefixMatchingRoutesEventsToCorrectBuffer() {
    String runId = "8000";
    AppRunLogAppender.startCapture(
        runId, "app-id-8", "PrefixApp", "server1", "reindex-", "om-worker-");
    RunLogBuffer buffer = AppRunLogAppender.getBuffer("PrefixApp", runId);
    assertNotNull(buffer);

    LoggingEvent matchingEvent =
        createEventWithThread("worker log line", Map.of(), "reindex-pool-1");
    appender.append(matchingEvent);

    LoggingEvent anotherMatch =
        createEventWithThread("another worker line", Map.of(), "om-worker-3");
    appender.append(anotherMatch);

    LoggingEvent nonMatching = createEventWithThread("ignored line", Map.of(), "some-other-thread");
    appender.append(nonMatching);

    List<String> pending = buffer.getPendingLines();
    assertEquals(2, pending.size());
    assertTrue(pending.get(0).contains("worker log line"));
    assertTrue(pending.get(1).contains("another worker line"));

    AppRunLogAppender.stopCapture("PrefixApp", runId);
  }

  @Test
  void formatLineIncludesExceptionField() {
    LoggingEvent event = createEvent("something failed", Map.of());
    RuntimeException ex = new RuntimeException("boom");
    event.setThrowableProxy(new ThrowableProxy(ex));

    String line = AppRunLogAppender.formatLine(event);
    assertTrue(line.contains("\"exception\":\""), "should contain exception field");
    assertTrue(line.contains("RuntimeException"), "should contain exception class name");
    assertTrue(line.contains("boom"), "should contain exception message");
    assertTrue(line.endsWith("}"), "should be valid JSON");
  }

  @Test
  void formatThrowableWithCauseChainIncludesAllCauses() {
    RuntimeException root = new RuntimeException("root cause");
    RuntimeException mid = new RuntimeException("mid cause", root);
    RuntimeException top = new RuntimeException("top cause", mid);

    LoggingEvent event = createEvent("chained error", Map.of());
    event.setThrowableProxy(new ThrowableProxy(top));

    String line = AppRunLogAppender.formatLine(event);
    assertTrue(line.contains("top cause"), "should contain top-level message");
    assertTrue(line.contains("Caused by:"), "should contain caused-by markers");
    assertTrue(line.contains("mid cause"), "should contain mid cause");
    assertTrue(line.contains("root cause"), "should contain root cause");
  }

  @Test
  void formatThrowableWithDeepCauseChainDoesNotStackOverflow() {
    Exception deepest = new RuntimeException("deepest");
    Exception current = deepest;
    for (int i = 0; i < 50; i++) {
      current = new RuntimeException("level-" + i, current);
    }

    LoggingEvent event = createEvent("deep chain", Map.of());
    event.setThrowableProxy(new ThrowableProxy(current));

    String line = AppRunLogAppender.formatLine(event);
    assertNotNull(line);
    assertTrue(line.contains("deepest"));
    assertTrue(line.contains("level-0"));
  }

  @Test
  void mdcMatchTakesPriorityOverThreadPrefixMatch() {
    String runId1 = "9001";
    String runId2 = "9002";
    AppRunLogAppender.startCapture(runId1, "app-id-9a", "MdcApp", "server1");
    AppRunLogAppender.startCapture(runId2, "app-id-9b", "PrefixApp2", "server1", "shared-pool-");

    RunLogBuffer mdcBuffer = AppRunLogAppender.getBuffer("MdcApp", runId1);
    RunLogBuffer prefixBuffer = AppRunLogAppender.getBuffer("PrefixApp2", runId2);

    Map<String, String> mdc = new HashMap<>();
    mdc.put(AppRunLogAppender.MDC_APP_RUN_ID, runId1);
    mdc.put(AppRunLogAppender.MDC_APP_NAME, "MdcApp");
    LoggingEvent event = createEventWithThread("should go to MDC buffer", mdc, "shared-pool-1");
    appender.append(event);

    assertEquals(1, mdcBuffer.getPendingLines().size());
    assertEquals(0, prefixBuffer.getPendingLines().size());

    AppRunLogAppender.stopCapture("MdcApp", runId1);
    AppRunLogAppender.stopCapture("PrefixApp2", runId2);
  }

  private LoggingEvent createEvent(String message, Map<String, String> mdc) {
    return createEventWithThread(message, mdc, "test-thread");
  }

  private LoggingEvent createEventWithThread(
      String message, Map<String, String> mdc, String threadName) {
    LoggingEvent event = new LoggingEvent();
    event.setLoggerName("test.logger");
    event.setLevel(Level.INFO);
    event.setMessage(message);
    event.setTimeStamp(System.currentTimeMillis());
    event.setThreadName(threadName);
    event.setMDCPropertyMap(mdc);
    return event;
  }
}
