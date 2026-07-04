package org.openmetadata.service.apps.bundles.searchIndex.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexServerStatsDAO;

@ExtendWith(MockitoExtension.class)
@DisplayName("StageStatsTracker Tests")
class StageStatsTrackerTest {

  @Mock private SearchIndexServerStatsDAO statsDAO;

  private static final String JOB_ID = "job-123";
  private static final String SERVER_ID = "server-1";
  private static final String ENTITY_TYPE = "table";

  private StageStatsTracker tracker;

  @BeforeEach
  void setUp() {
    tracker = new StageStatsTracker(JOB_ID, SERVER_ID, ENTITY_TYPE, statsDAO);
  }

  @Nested
  @DisplayName("Initialization Tests")
  class InitializationTests {

    @Test
    @DisplayName("Should initialize with correct job ID")
    void testJobId() {
      assertEquals(JOB_ID, tracker.getJobId());
    }

    @Test
    @DisplayName("Should initialize with correct server ID")
    void testServerId() {
      assertEquals(SERVER_ID, tracker.getServerId());
    }

    @Test
    @DisplayName("Should initialize with correct entity type")
    void testEntityType() {
      assertEquals(ENTITY_TYPE, tracker.getEntityType());
    }

    @Test
    @DisplayName("Should generate a unique record ID")
    void testRecordIdGenerated() {
      assertNotNull(tracker.getRecordId());
    }

    @Test
    @DisplayName("Should initialize all stage counters")
    void testStageCountersInitialized() {
      assertNotNull(tracker.getReader());
      assertNotNull(tracker.getProcess());
      assertNotNull(tracker.getSink());
      assertNotNull(tracker.getVector());
    }

    @Test
    @DisplayName("Stage counters should start at zero")
    void testStageCountersStartAtZero() {
      assertEquals(0, tracker.getReader().getTotal());
      assertEquals(0, tracker.getProcess().getTotal());
      assertEquals(0, tracker.getSink().getTotal());
      assertEquals(0, tracker.getVector().getTotal());
    }
  }

  @Nested
  @DisplayName("Record Method Tests")
  class RecordMethodTests {

    @Test
    @DisplayName("Should record reader success")
    void testRecordReaderSuccess() {
      tracker.recordReader(StatsResult.SUCCESS);

      assertEquals(1, tracker.getReader().getSuccess().get());
    }

    @Test
    @DisplayName("Should record reader failure")
    void testRecordReaderFailure() {
      tracker.recordReader(StatsResult.FAILED);

      assertEquals(1, tracker.getReader().getFailed().get());
    }

    @Test
    @DisplayName("Should record reader warning")
    void testRecordReaderWarning() {
      tracker.recordReader(StatsResult.WARNING);

      assertEquals(1, tracker.getReader().getWarnings().get());
    }

    @Test
    @DisplayName("Should record process success")
    void testRecordProcessSuccess() {
      tracker.recordProcess(StatsResult.SUCCESS);

      assertEquals(1, tracker.getProcess().getSuccess().get());
    }

    @Test
    @DisplayName("Should record process failure")
    void testRecordProcessFailure() {
      tracker.recordProcess(StatsResult.FAILED);

      assertEquals(1, tracker.getProcess().getFailed().get());
    }

    @Test
    @DisplayName("Should record sink success")
    void testRecordSinkSuccess() {
      tracker.recordSink(StatsResult.SUCCESS);

      assertEquals(1, tracker.getSink().getSuccess().get());
    }

    @Test
    @DisplayName("Should record sink failure")
    void testRecordSinkFailure() {
      tracker.recordSink(StatsResult.FAILED);

      assertEquals(1, tracker.getSink().getFailed().get());
    }

    @Test
    @DisplayName("Should record vector success")
    void testRecordVectorSuccess() {
      tracker.recordVector(StatsResult.SUCCESS);

      assertEquals(1, tracker.getVector().getSuccess().get());
    }

    @Test
    @DisplayName("Should record vector failure")
    void testRecordVectorFailure() {
      tracker.recordVector(StatsResult.FAILED);

      assertEquals(1, tracker.getVector().getFailed().get());
    }

    @Test
    @DisplayName("Should track multiple records across stages")
    void testMultipleRecordsAcrossStages() {
      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.FAILED);
      tracker.recordSink(StatsResult.SUCCESS);
      tracker.recordVector(StatsResult.WARNING);

      assertEquals(2, tracker.getReader().getSuccess().get());
      assertEquals(1, tracker.getProcess().getSuccess().get());
      assertEquals(1, tracker.getProcess().getFailed().get());
      assertEquals(1, tracker.getSink().getSuccess().get());
      assertEquals(1, tracker.getVector().getWarnings().get());
    }
  }

  @Nested
  @DisplayName("Auto-Flush Tests")
  class AutoFlushTests {

    @Test
    @DisplayName("Should auto-flush after threshold operations")
    void testAutoFlushAfterThreshold() {
      for (int i = 0; i < 500; i++) {
        tracker.recordReader(StatsResult.SUCCESS);
      }

      verify(statsDAO, atLeastOnce())
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
    }

    @Test
    @DisplayName("Should not flush before threshold")
    void testNoFlushBeforeThreshold() {
      for (int i = 0; i < 499; i++) {
        tracker.recordReader(StatsResult.SUCCESS);
      }

      verify(statsDAO, never())
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
    }
  }

  @Nested
  @DisplayName("Explicit Flush Tests")
  class ExplicitFlushTests {

    @Test
    @DisplayName("Should flush stats to database")
    void testExplicitFlush() {
      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.FAILED);

      tracker.flush();

      verify(statsDAO, times(1))
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
    }

    @Test
    @DisplayName("Should include sink warnings in persisted warning total")
    void testFlushIncludesSinkWarnings() {
      tracker.recordReader(StatsResult.WARNING);
      tracker.recordProcess(StatsResult.WARNING);
      tracker.incrementPendingSink();
      tracker.recordSink(StatsResult.WARNING);

      tracker.flush();

      verify(statsDAO, times(1))
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              eq(3L),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
    }

    @Test
    @DisplayName("Should handle null DAO gracefully")
    void testFlushWithNullDAO() {
      StageStatsTracker trackerWithNullDAO =
          new StageStatsTracker(JOB_ID, SERVER_ID, ENTITY_TYPE, null);

      trackerWithNullDAO.recordReader(StatsResult.SUCCESS);
      trackerWithNullDAO.flush();
    }

    @Test
    @DisplayName("Should handle flush errors gracefully")
    void testFlushErrorHandling() {
      org.mockito.Mockito.doThrow(new RuntimeException("DB error"))
          .when(statsDAO)
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());

      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.WARNING);
      tracker.flush();

      assertEquals(1, tracker.getReader().getSuccess().get());
      assertEquals(1, tracker.getProcess().getWarnings().get());
    }
  }

  @Nested
  @DisplayName("Reset Tests")
  class ResetTests {

    @Test
    @DisplayName("Should reset all stage counters")
    void testResetAllCounters() {
      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.FAILED);
      tracker.recordSink(StatsResult.SUCCESS);
      tracker.recordVector(StatsResult.WARNING);

      tracker.reset();

      assertEquals(0, tracker.getReader().getTotal());
      assertEquals(0, tracker.getProcess().getTotal());
      assertEquals(0, tracker.getSink().getTotal());
      assertEquals(0, tracker.getVector().getTotal());
    }

    @Test
    @DisplayName("Should allow recording after reset")
    void testRecordingAfterReset() {
      tracker.recordReader(StatsResult.SUCCESS);
      tracker.reset();
      tracker.recordReader(StatsResult.FAILED);

      assertEquals(0, tracker.getReader().getSuccess().get());
      assertEquals(1, tracker.getReader().getFailed().get());
    }
  }

  @Nested
  @DisplayName("Thread Safety Tests")
  class ThreadSafetyTests {

    @Test
    @DisplayName("Should handle concurrent records safely")
    void testConcurrentRecords() throws InterruptedException {
      int threadCount = 10;
      int recordsPerThread = 10;
      ExecutorService executor = Executors.newFixedThreadPool(threadCount);
      CountDownLatch latch = new CountDownLatch(threadCount);

      for (int i = 0; i < threadCount; i++) {
        final int threadNum = i;
        executor.submit(
            () -> {
              try {
                for (int j = 0; j < recordsPerThread; j++) {
                  switch (threadNum % 4) {
                    case 0 -> tracker.recordReader(StatsResult.SUCCESS);
                    case 1 -> tracker.recordProcess(StatsResult.SUCCESS);
                    case 2 -> tracker.recordSink(StatsResult.SUCCESS);
                    case 3 -> tracker.recordVector(StatsResult.SUCCESS);
                  }
                }
              } finally {
                latch.countDown();
              }
            });
      }

      latch.await(10, TimeUnit.SECONDS);
      executor.shutdown();

      long total =
          tracker.getReader().getSuccess().get()
              + tracker.getProcess().getSuccess().get()
              + tracker.getSink().getSuccess().get()
              + tracker.getVector().getSuccess().get();
      assertEquals(threadCount * recordsPerThread, total);
    }
  }

  @Nested
  @DisplayName("Timing Tests")
  class TimingTests {

    @Test
    @DisplayName("Reader batch with duration accumulates time correctly")
    void testReaderBatchAccumulatesTime() {
      tracker.recordReaderBatch(10, 0, 0, 5_000_000L);
      tracker.recordReaderBatch(20, 0, 0, 7_000_000L);

      assertEquals(30, tracker.getReader().getSuccess().get());
      assertEquals(12_000_000L, tracker.getReader().getTotalTimeNanos().get());
    }

    @Test
    @DisplayName("addStageTime adds time only, leaves counters untouched")
    void testAddStageTimeOnly() {
      // Per-record success counts coming from per-callback recordSink (single result),
      // batch-level wall-clock time added separately via addStageTime — must not double count.
      tracker.recordSink(StatsResult.SUCCESS);
      tracker.recordSink(StatsResult.SUCCESS);
      tracker.addStageTime(StageStatsTracker.Stage.SINK, 50_000_000L);

      assertEquals(2, tracker.getSink().getSuccess().get());
      assertEquals(50_000_000L, tracker.getSink().getTotalTimeNanos().get());
    }

    @Test
    @DisplayName("addStageTime ignores non-positive durations")
    void testAddStageTimeIgnoresZeroAndNegative() {
      tracker.addStageTime(StageStatsTracker.Stage.SINK, 0L);
      tracker.addStageTime(StageStatsTracker.Stage.SINK, -1L);

      assertEquals(0L, tracker.getSink().getTotalTimeNanos().get());
    }

    @Test
    @DisplayName("Flush converts accumulated nanos to ms and resets counter")
    void testFlushConvertsTimingToMs() {
      tracker.recordReaderBatch(5, 0, 0, 250_000_000L); // 250 ms in nanos
      tracker.recordSinkBatch(5, 0, 800_000_000L); // 800 ms in nanos

      tracker.flush();

      // After flush, internal nanos counter is reset to zero
      assertEquals(0L, tracker.getReader().getTotalTimeNanos().get());
      assertEquals(0L, tracker.getSink().getTotalTimeNanos().get());

      // DAO was called with the converted ms values (positions 14 reader, 16 sink)
      org.mockito.ArgumentCaptor<Long> readerTimeMs =
          org.mockito.ArgumentCaptor.forClass(Long.class);
      org.mockito.ArgumentCaptor<Long> sinkTimeMs = org.mockito.ArgumentCaptor.forClass(Long.class);
      verify(statsDAO)
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              readerTimeMs.capture(),
              anyLong(),
              sinkTimeMs.capture(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
      assertEquals(250L, readerTimeMs.getValue().longValue());
      assertEquals(800L, sinkTimeMs.getValue().longValue());
    }

    @Test
    @DisplayName("Flush with only timing data still flushes")
    void testFlushOnlyTiming() {
      // addStageTime only — no counts. Should still trigger a flush so timing isn't lost.
      tracker.addStageTime(StageStatsTracker.Stage.SINK, 100_000_000L); // 100 ms

      tracker.flush();

      // Either the flush was a no-op (counters all zero) OR the DAO got called with 100 ms.
      // The current behavior: the flush guard checks counts AND timing — if any are nonzero,
      // it flushes. This test pins that behavior so a future refactor doesn't silently drop
      // timing-only flushes (which would happen on quiet windows where stages had latency
      // recorded but no records yet).
      verify(statsDAO, times(1))
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());
    }

    @Test
    @DisplayName("Flush failure restores both counts and timing")
    void testFlushFailureRestoresTiming() {
      org.mockito.Mockito.doThrow(new RuntimeException("DB down"))
          .when(statsDAO)
          .incrementStats(
              anyString(),
              anyString(),
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyInt(),
              anyInt(),
              anyLong());

      tracker.recordReaderBatch(7, 0, 0, 42_000_000L);
      tracker.flush();

      // After flush failure, both count and timing must be restored so the next flush
      // doesn't silently drop them.
      assertEquals(7L, tracker.getReader().getSuccess().get());
      assertEquals(42_000_000L, tracker.getReader().getTotalTimeNanos().get());
    }
  }
}
