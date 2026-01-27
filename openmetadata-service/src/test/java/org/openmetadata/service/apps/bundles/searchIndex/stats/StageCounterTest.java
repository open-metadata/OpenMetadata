package org.openmetadata.service.apps.bundles.searchIndex.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@DisplayName("StageCounter Tests")
class StageCounterTest {

  private StageCounter counter;

  @BeforeEach
  void setUp() {
    counter = new StageCounter();
  }

  @Nested
  @DisplayName("Initial State Tests")
  class InitialStateTests {

    @Test
    @DisplayName("Should start with zero success count")
    void testInitialSuccessIsZero() {
      assertEquals(0, counter.getSuccess().get());
    }

    @Test
    @DisplayName("Should start with zero failed count")
    void testInitialFailedIsZero() {
      assertEquals(0, counter.getFailed().get());
    }

    @Test
    @DisplayName("Should start with zero warnings count")
    void testInitialWarningsIsZero() {
      assertEquals(0, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should start with zero total")
    void testInitialTotalIsZero() {
      assertEquals(0, counter.getTotal());
    }
  }

  @Nested
  @DisplayName("Record Method Tests")
  class RecordMethodTests {

    @Test
    @DisplayName("Should increment success count for SUCCESS result")
    void testRecordSuccess() {
      counter.record(StatsResult.SUCCESS);

      assertEquals(1, counter.getSuccess().get());
      assertEquals(0, counter.getFailed().get());
      assertEquals(0, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should increment failed count for FAILED result")
    void testRecordFailed() {
      counter.record(StatsResult.FAILED);

      assertEquals(0, counter.getSuccess().get());
      assertEquals(1, counter.getFailed().get());
      assertEquals(0, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should increment warnings count for WARNING result")
    void testRecordWarning() {
      counter.record(StatsResult.WARNING);

      assertEquals(0, counter.getSuccess().get());
      assertEquals(0, counter.getFailed().get());
      assertEquals(1, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should handle multiple records of same type")
    void testMultipleRecordsOfSameType() {
      counter.record(StatsResult.SUCCESS);
      counter.record(StatsResult.SUCCESS);
      counter.record(StatsResult.SUCCESS);

      assertEquals(3, counter.getSuccess().get());
    }

    @Test
    @DisplayName("Should handle mixed record types")
    void testMixedRecordTypes() {
      counter.record(StatsResult.SUCCESS);
      counter.record(StatsResult.SUCCESS);
      counter.record(StatsResult.FAILED);
      counter.record(StatsResult.WARNING);
      counter.record(StatsResult.WARNING);

      assertEquals(2, counter.getSuccess().get());
      assertEquals(1, counter.getFailed().get());
      assertEquals(2, counter.getWarnings().get());
    }
  }

  @Nested
  @DisplayName("Add Method Tests")
  class AddMethodTests {

    @Test
    @DisplayName("Should add counts to all counters")
    void testAddCounts() {
      counter.add(10, 5, 3);

      assertEquals(10, counter.getSuccess().get());
      assertEquals(5, counter.getFailed().get());
      assertEquals(3, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should accumulate with existing counts")
    void testAddAccumulatesWithExisting() {
      counter.add(10, 5, 3);
      counter.add(5, 2, 1);

      assertEquals(15, counter.getSuccess().get());
      assertEquals(7, counter.getFailed().get());
      assertEquals(4, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should handle zero values")
    void testAddZeroValues() {
      counter.add(10, 5, 3);
      counter.add(0, 0, 0);

      assertEquals(10, counter.getSuccess().get());
      assertEquals(5, counter.getFailed().get());
      assertEquals(3, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should work with record method")
    void testAddWithRecord() {
      counter.record(StatsResult.SUCCESS);
      counter.add(10, 5, 3);

      assertEquals(11, counter.getSuccess().get());
      assertEquals(5, counter.getFailed().get());
      assertEquals(3, counter.getWarnings().get());
    }
  }

  @Nested
  @DisplayName("Reset Method Tests")
  class ResetMethodTests {

    @Test
    @DisplayName("Should reset all counters to zero")
    void testResetAllCounters() {
      counter.add(10, 5, 3);

      counter.reset();

      assertEquals(0, counter.getSuccess().get());
      assertEquals(0, counter.getFailed().get());
      assertEquals(0, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should allow new counts after reset")
    void testCountsAfterReset() {
      counter.add(10, 5, 3);
      counter.reset();
      counter.record(StatsResult.SUCCESS);

      assertEquals(1, counter.getSuccess().get());
      assertEquals(0, counter.getFailed().get());
      assertEquals(0, counter.getWarnings().get());
    }

    @Test
    @DisplayName("Should handle multiple resets")
    void testMultipleResets() {
      counter.add(10, 5, 3);
      counter.reset();
      counter.add(5, 2, 1);
      counter.reset();

      assertEquals(0, counter.getSuccess().get());
      assertEquals(0, counter.getFailed().get());
      assertEquals(0, counter.getWarnings().get());
    }
  }

  @Nested
  @DisplayName("GetTotal Method Tests")
  class GetTotalMethodTests {

    @Test
    @DisplayName("Should return sum of success and failed only")
    void testTotalExcludesWarnings() {
      counter.add(10, 5, 3);

      assertEquals(15, counter.getTotal());
    }

    @Test
    @DisplayName("Should return zero when all counters are zero")
    void testTotalWithZeroCounts() {
      assertEquals(0, counter.getTotal());
    }

    @Test
    @DisplayName("Should return success count when no failures")
    void testTotalWithOnlySuccess() {
      counter.add(10, 0, 5);

      assertEquals(10, counter.getTotal());
    }

    @Test
    @DisplayName("Should return failed count when no success")
    void testTotalWithOnlyFailed() {
      counter.add(0, 10, 5);

      assertEquals(10, counter.getTotal());
    }
  }

  @Nested
  @DisplayName("Thread Safety Tests")
  class ThreadSafetyTests {

    @Test
    @DisplayName("Should handle concurrent record calls safely")
    void testConcurrentRecords() throws InterruptedException {
      int threadCount = 10;
      int recordsPerThread = 1000;
      ExecutorService executor = Executors.newFixedThreadPool(threadCount);
      CountDownLatch latch = new CountDownLatch(threadCount);

      for (int i = 0; i < threadCount; i++) {
        executor.submit(
            () -> {
              try {
                for (int j = 0; j < recordsPerThread; j++) {
                  counter.record(StatsResult.SUCCESS);
                }
              } finally {
                latch.countDown();
              }
            });
      }

      latch.await(10, TimeUnit.SECONDS);
      executor.shutdown();

      assertEquals(threadCount * recordsPerThread, counter.getSuccess().get());
    }

    @Test
    @DisplayName("Should handle concurrent mixed operations safely")
    void testConcurrentMixedOperations() throws InterruptedException {
      int threadCount = 10;
      int operationsPerThread = 100;
      ExecutorService executor = Executors.newFixedThreadPool(threadCount);
      CountDownLatch latch = new CountDownLatch(threadCount);

      for (int i = 0; i < threadCount; i++) {
        final int threadNum = i;
        executor.submit(
            () -> {
              try {
                for (int j = 0; j < operationsPerThread; j++) {
                  if (threadNum % 3 == 0) {
                    counter.record(StatsResult.SUCCESS);
                  } else if (threadNum % 3 == 1) {
                    counter.record(StatsResult.FAILED);
                  } else {
                    counter.record(StatsResult.WARNING);
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
          counter.getSuccess().get() + counter.getFailed().get() + counter.getWarnings().get();
      assertEquals(threadCount * operationsPerThread, total);
    }

    @Test
    @DisplayName("Should handle concurrent add calls safely")
    void testConcurrentAdds() throws InterruptedException {
      int threadCount = 10;
      int addsPerThread = 100;
      ExecutorService executor = Executors.newFixedThreadPool(threadCount);
      CountDownLatch latch = new CountDownLatch(threadCount);

      for (int i = 0; i < threadCount; i++) {
        executor.submit(
            () -> {
              try {
                for (int j = 0; j < addsPerThread; j++) {
                  counter.add(1, 1, 1);
                }
              } finally {
                latch.countDown();
              }
            });
      }

      latch.await(10, TimeUnit.SECONDS);
      executor.shutdown();

      int expected = threadCount * addsPerThread;
      assertEquals(expected, counter.getSuccess().get());
      assertEquals(expected, counter.getFailed().get());
      assertEquals(expected, counter.getWarnings().get());
    }
  }
}
