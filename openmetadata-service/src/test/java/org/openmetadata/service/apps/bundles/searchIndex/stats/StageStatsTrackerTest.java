package org.openmetadata.service.apps.bundles.searchIndex.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
      for (int i = 0; i < 100; i++) {
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
              anyInt(),
              anyInt(),
              anyLong());
    }

    @Test
    @DisplayName("Should not flush before threshold")
    void testNoFlushBeforeThreshold() {
      for (int i = 0; i < 99; i++) {
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
              anyInt(),
              anyInt(),
              anyLong());

      tracker.recordReader(StatsResult.SUCCESS);
      tracker.flush();
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
      int recordsPerThread = 100;
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
}
