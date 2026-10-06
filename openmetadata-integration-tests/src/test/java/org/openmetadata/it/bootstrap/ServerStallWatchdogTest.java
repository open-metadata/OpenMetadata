package org.openmetadata.it.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.bootstrap.ServerStallWatchdog.AsyncBacklog;
import org.openmetadata.it.bootstrap.ServerStallWatchdog.DatabaseProbe;

class ServerStallWatchdogTest {
  private static final Duration THRESHOLD = Duration.ofMinutes(3);
  private static final Duration CHECK_INTERVAL = Duration.ofSeconds(30);
  private static final String DATABASE_STATE = "== innodb_trx\ntrx_id=42 | trx_state=RUNNING";

  @TempDir Path reports;

  private final MutableClock clock = new MutableClock();
  private final AtomicLong completed = new AtomicLong();
  private final AtomicLong queued = new AtomicLong();
  private Duration oldestTransaction = Duration.ZERO;

  @Test
  void reportsOnceQueuedAsyncWorkHasNotCompletedForTheThreshold() throws Exception {
    queued.set(26);
    ServerStallWatchdog watchdog = watchdog();

    checkEvery(CHECK_INTERVAL, THRESHOLD.minus(CHECK_INTERVAL), watchdog);
    assertEquals(List.of(), reportFiles(), "a backlog younger than the threshold is not a stall");

    checkEvery(CHECK_INTERVAL, CHECK_INTERVAL, watchdog);
    assertEquals(List.of("server-stall-1-threads.json", "server-stall-1.txt"), reportFiles());
    String summary = Files.readString(reports.resolve("server-stall-1.txt"));
    assertTrue(summary.contains("no queued async database task completed for 180s"), summary);
    assertTrue(summary.contains(DATABASE_STATE), summary);
    assertTrue(
        Files.readString(reports.resolve("server-stall-1-threads.json")).contains("threadDump"),
        "the thread dump must be written");
  }

  @Test
  void staysQuietWhileQueuedWorkKeepsCompleting() throws Exception {
    queued.set(400);
    ServerStallWatchdog watchdog = watchdog();

    for (int check = 0; check < 20; check++) {
      completed.addAndGet(5);
      clock.advance(CHECK_INTERVAL);
      watchdog.check();
    }

    assertEquals(List.of(), reportFiles());
  }

  @Test
  void reportsATransactionOpenForTheThresholdWithNothingQueued() throws Exception {
    oldestTransaction = THRESHOLD;
    ServerStallWatchdog watchdog = watchdog();

    clock.advance(CHECK_INTERVAL);
    watchdog.check();

    String summary = Files.readString(reports.resolve("server-stall-1.txt"));
    assertTrue(summary.contains("a database transaction has been open for 180s"), summary);
  }

  @Test
  void writesAtMostThreeReportsOneThresholdApart() throws Exception {
    queued.set(26);
    ServerStallWatchdog watchdog = watchdog();

    checkEvery(CHECK_INTERVAL, Duration.ofMinutes(30), watchdog);

    assertEquals(2 * ServerStallWatchdog.MAX_REPORTS, reportFiles().size());
    assertTrue(Files.exists(reports.resolve("server-stall-3.txt")));
  }

  private ServerStallWatchdog watchdog() {
    return new ServerStallWatchdog(
        new StubDatabase(),
        () -> new AsyncBacklog(completed.get() + queued.get(), 0, queued.get(), "stub"),
        reports,
        THRESHOLD,
        clock);
  }

  private void checkEvery(Duration interval, Duration total, ServerStallWatchdog watchdog)
      throws SQLException, IOException {
    for (Duration elapsed = Duration.ZERO;
        elapsed.compareTo(total) < 0;
        elapsed = elapsed.plus(interval)) {
      clock.advance(interval);
      watchdog.check();
    }
  }

  private List<String> reportFiles() throws IOException {
    try (Stream<Path> files = Files.list(reports)) {
      return files.map(file -> file.getFileName().toString()).sorted().toList();
    }
  }

  private final class StubDatabase implements DatabaseProbe {
    @Override
    public Duration oldestOpenTransaction() {
      return oldestTransaction;
    }

    @Override
    public String describe() {
      return DATABASE_STATE;
    }
  }

  private static final class MutableClock extends Clock {
    private Instant now = Instant.parse("2026-10-05T06:43:28Z");

    void advance(Duration duration) {
      now = now.plus(duration);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }
}
