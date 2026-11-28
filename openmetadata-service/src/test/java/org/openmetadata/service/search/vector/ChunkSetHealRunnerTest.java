package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.VectorIndexService.ChunkSetsBounded;
import org.slf4j.LoggerFactory;

/** What the runner logs, and what it counts as a failed pass. */
class ChunkSetHealRunnerTest {
  private static final String FAILED_PASS = "Could not remove the chunks no header counts";
  private static final String FAILED_RELEASE = "Could not release the chunk heal lease";

  private final VectorIndexService service = mock(VectorIndexService.class);
  private final List<Duration> pauses = new ArrayList<>();
  private final Logger logger = (Logger) LoggerFactory.getLogger(ChunkSetHealRunner.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
  private Level previousLevel;

  @BeforeEach
  void captureTheLog() {
    previousLevel = logger.getLevel();
    logger.setLevel(Level.DEBUG);
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void restoreTheLog() {
    logger.detachAppender(appender);
    logger.setLevel(previousLevel);
  }

  @Test
  void aServerThatFirstFindsTheLeaseHeldWarnsOnItsFirstFailedPass() throws IOException {
    when(service.removeChunksNoHeaderCounts())
        .thenThrow(new IOException("shard failed"))
        .thenThrow(new IOException("shard failed"))
        .thenReturn(Optional.empty());

    new ChunkSetHealRunner(service, leaseTaken(false, true, true, true), pauses::add).run();

    assertEquals(
        List.of(Level.WARN, Level.DEBUG), levelsOf(FAILED_PASS), "warned on the first failure");
  }

  @Test
  void aPassStillFailingWhenTheWaitReachesItsCapWarnsOnceMore() throws IOException {
    when(service.removeChunksNoHeaderCounts()).thenThrow(failures(8)).thenReturn(Optional.empty());

    new ChunkSetHealRunner(service, leaseTaken(true), pauses::add).run();

    assertEquals(ChunkSetHealRunner.LONGEST_RETRY, pauses.get(5), "the sixth wait is the cap");
    assertEquals(
        List.of(
            Level.WARN,
            Level.DEBUG,
            Level.DEBUG,
            Level.DEBUG,
            Level.DEBUG,
            Level.WARN,
            Level.DEBUG,
            Level.DEBUG),
        levelsOf(FAILED_PASS));
  }

  @Test
  void aLeaseThatCannotBeReleasedAfterAPassIsNotAFailedHeal() throws IOException {
    when(service.removeChunksNoHeaderCounts())
        .thenReturn(Optional.of(new ChunkSetsBounded("chunks", 2, 1)));
    int[] releases = new int[1];
    ChunkSetHealRunner.Lease lease =
        new ChunkSetHealRunner.Lease() {
          @Override
          public boolean tryAcquire() {
            return true;
          }

          @Override
          public void release() {
            if (releases[0]++ == 0) {
              throw new IllegalStateException("database unavailable");
            }
          }
        };

    new ChunkSetHealRunner(service, lease, pauses::add).run();

    assertEquals(List.of(), pauses, "the heal is done, nothing is tried again");
    assertEquals(List.of(), levelsOf(FAILED_PASS));
    assertEquals(List.of(Level.INFO), levelsOf(FAILED_RELEASE));
  }

  @Test
  void anExceptionThePassDoesNotDeclareIsNotTakenForAFailedPass() throws IOException {
    Exception undeclared = new Exception("not an I/O failure");
    when(service.removeChunksNoHeaderCounts())
        .thenAnswer(
            invocation -> {
              throw undeclared;
            })
        .thenReturn(Optional.empty());
    boolean[] released = new boolean[1];
    ChunkSetHealRunner.Lease lease =
        new ChunkSetHealRunner.Lease() {
          @Override
          public boolean tryAcquire() {
            return true;
          }

          @Override
          public void release() {
            released[0] = true;
          }
        };
    ChunkSetHealRunner runner = new ChunkSetHealRunner(service, lease, pauses::add);

    assertSame(undeclared, assertThrows(Exception.class, runner::run));
    assertEquals(List.of(), pauses, "it is not retried as a failed pass");
    assertTrue(released[0], "the lease is still released");
  }

  private static IOException[] failures(int count) {
    IOException[] failures = new IOException[count];
    for (int i = 0; i < count; i++) {
      failures[i] = new IOException("search.default_search_timeout");
    }
    return failures;
  }

  private static ChunkSetHealRunner.Lease leaseTaken(Boolean... taken) {
    Iterator<Boolean> attempts = List.of(taken).iterator();
    return new ChunkSetHealRunner.Lease() {
      @Override
      public boolean tryAcquire() {
        return attempts.hasNext() ? attempts.next() : true;
      }

      @Override
      public void release() {}
    };
  }

  private List<Level> levelsOf(String message) {
    return appender.list.stream()
        .filter(event -> event.getMessage().startsWith(message))
        .map(ILoggingEvent::getLevel)
        .toList();
  }
}
