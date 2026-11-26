package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.openmetadata.service.search.vector.VectorIndexService.ChunkSetsBounded;
import org.openmetadata.service.search.vector.VectorIndexService.DeletedEntityChunksRemoved;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;
import org.slf4j.LoggerFactory;

/** What the runner logs, and what it counts as a failed pass. */
class ChunkSetHealRunnerTest {
  private static final String FAILED_PASS = "Could not finish the chunk index cleanup";
  private static final String FAILED_RELEASE = "Could not release the chunk heal lease";
  private static final String INDEX = "data_asset_embeddings_chunks";
  private static final LiveEntities LIVE = (type, ids) -> Set.copyOf(ids);

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

    new ChunkSetHealRunner(service, leaseTaken(false, true, true, true), LIVE, pauses::add).run();

    assertEquals(
        List.of(Level.WARN, Level.DEBUG), levelsOf(FAILED_PASS), "warned on the first failure");
  }

  @Test
  void aPassStillFailingWhenTheWaitReachesItsCapWarnsOnceMore() throws IOException {
    when(service.removeChunksNoHeaderCounts()).thenThrow(failures(8)).thenReturn(Optional.empty());

    new ChunkSetHealRunner(service, leaseTaken(true), LIVE, pauses::add).run();

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

    new ChunkSetHealRunner(service, lease, LIVE, pauses::add).run();

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
    ChunkSetHealRunner runner = new ChunkSetHealRunner(service, lease, LIVE, pauses::add);

    assertSame(undeclared, assertThrows(Exception.class, runner::run));
    assertEquals(List.of(), pauses, "it is not retried as a failed pass");
    assertTrue(released[0], "the lease is still released");
  }

  /**
   * The sweep deletes by the header's bound, so it follows the heal. A sweep that fails is tried
   * again, under the lease, until the index records it; the heal is then already recorded.
   */
  @Test
  void theSweepFollowsTheHealAndIsTriedAgainUntilItIsRecorded() throws Exception {
    ChunkSetHealRunner.Lease lease = mock(ChunkSetHealRunner.Lease.class);
    when(lease.tryAcquire()).thenReturn(true);
    when(service.removeChunksNoHeaderCounts())
        .thenReturn(Optional.of(new ChunkSetsBounded(INDEX, 1, 2)))
        .thenReturn(Optional.empty());
    when(service.removeChunksOfDeletedEntities(LIVE))
        .thenThrow(new IllegalStateException("429 after retries"))
        .thenReturn(Optional.of(new DeletedEntityChunksRemoved(INDEX, 3)));

    new ChunkSetHealRunner(service, lease, LIVE, pauses::add).run();

    InOrder order = inOrder(service, lease);
    order.verify(service).removeChunksNoHeaderCounts();
    order.verify(service).removeChunksOfDeletedEntities(LIVE);
    order.verify(lease).release();
    order.verify(service).removeChunksNoHeaderCounts();
    order.verify(service).removeChunksOfDeletedEntities(LIVE);
    order.verify(lease).release();
    assertEquals(List.of(ChunkSetHealRunner.FIRST_RETRY), pauses);
  }

  @Test
  void aHealThatFailsRunsNoSweep() throws Exception {
    ChunkSetHealRunner.Lease lease = mock(ChunkSetHealRunner.Lease.class);
    when(lease.tryAcquire()).thenReturn(true);
    when(service.removeChunksNoHeaderCounts())
        .thenThrow(new IllegalStateException("503 after retries"))
        .thenReturn(Optional.empty());
    when(service.removeChunksOfDeletedEntities(any())).thenReturn(Optional.empty());

    new ChunkSetHealRunner(service, lease, LIVE, wait -> {}).run();

    verify(service, times(2)).removeChunksNoHeaderCounts();
    verify(service, times(1)).removeChunksOfDeletedEntities(LIVE);
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
