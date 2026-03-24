package org.openmetadata.service.apps.bundles.searchIndex.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Field;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class EntityStatsTrackerTest {

  @Test
  void flushPersistsAccumulatedStageCounters() {
    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    EntityStatsTracker tracker = new EntityStatsTracker("job", "server", "table", statsDAO);

    tracker.recordReader(StatsResult.SUCCESS);
    tracker.recordReader(StatsResult.FAILED);
    tracker.recordReader(StatsResult.WARNING);
    tracker.recordReaderBatch(2, 3, 4);
    tracker.recordProcess(StatsResult.SUCCESS);
    tracker.recordProcess(StatsResult.FAILED);
    tracker.recordProcess(StatsResult.WARNING);
    tracker.recordSink(StatsResult.SUCCESS);
    tracker.recordSink(StatsResult.FAILED);
    tracker.recordSinkBatch(5, 6);
    tracker.recordVector(StatsResult.SUCCESS);
    tracker.recordVector(StatsResult.FAILED);
    tracker.recordVector(StatsResult.WARNING);
    tracker.recordPartitionCompleted();
    tracker.recordPartitionFailed();

    tracker.flush();

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
            anyInt(),
            anyInt(),
            anyLong());
    verify(statsDAO)
        .incrementStats(
            anyString(),
            org.mockito.ArgumentMatchers.eq("job"),
            org.mockito.ArgumentMatchers.eq("server"),
            org.mockito.ArgumentMatchers.eq("table"),
            org.mockito.ArgumentMatchers.eq(3L),
            org.mockito.ArgumentMatchers.eq(4L),
            org.mockito.ArgumentMatchers.eq(5L),
            org.mockito.ArgumentMatchers.eq(6L),
            org.mockito.ArgumentMatchers.eq(7L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(1),
            org.mockito.ArgumentMatchers.eq(1),
            anyLong());
    assertEquals(0L, tracker.getUnflushedReaderSuccess());
    assertEquals(0L, tracker.getUnflushedSinkSuccess());
    assertEquals(0L, tracker.getUnflushedSinkFailed());
  }

  @Test
  void thresholdAndTimeBasedFlushesTriggerWithoutManualFlush() throws Exception {
    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    EntityStatsTracker tracker = new EntityStatsTracker("job", "server", "table", statsDAO);

    getOperationCount(tracker).set(499);
    tracker.recordReader(StatsResult.SUCCESS);

    verify(statsDAO)
        .incrementStats(
            anyString(),
            org.mockito.ArgumentMatchers.eq("job"),
            org.mockito.ArgumentMatchers.eq("server"),
            org.mockito.ArgumentMatchers.eq("table"),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.eq(0),
            anyLong());

    EntityStatsTracker timedTracker = new EntityStatsTracker("job", "server", "topic", statsDAO);
    setLastFlushTime(timedTracker, System.currentTimeMillis() - 20_000);
    tracker.flush();
    timedTracker.recordSinkBatch(2, 1);

    verify(statsDAO)
        .incrementStats(
            anyString(),
            org.mockito.ArgumentMatchers.eq("job"),
            org.mockito.ArgumentMatchers.eq("server"),
            org.mockito.ArgumentMatchers.eq("topic"),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(2L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.eq(0),
            anyLong());
  }

  @Test
  void flushFailureRestoresCountersForRetry() {
    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    doThrow(new IllegalStateException("db down"))
        .doNothing()
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

    EntityStatsTracker tracker = new EntityStatsTracker("job", "server", "table", statsDAO);
    tracker.recordReaderBatch(2, 1, 1);
    tracker.recordSinkBatch(4, 3);
    tracker.recordPartitionCompleted();

    tracker.flush();

    assertEquals(2L, tracker.getUnflushedReaderSuccess());
    assertEquals(4L, tracker.getUnflushedSinkSuccess());
    assertEquals(3L, tracker.getUnflushedSinkFailed());

    tracker.flush();

    assertEquals(0L, tracker.getUnflushedReaderSuccess());
    assertEquals(0L, tracker.getUnflushedSinkSuccess());
    assertEquals(0L, tracker.getUnflushedSinkFailed());
  }

  @Test
  void flushWithoutDaoKeepsCountersAndEmptyFlushResetsBookkeeping() throws Exception {
    EntityStatsTracker tracker = new EntityStatsTracker("job", "server", "table", null);
    tracker.recordReader(StatsResult.SUCCESS);
    tracker.recordSinkBatch(2, 1);

    tracker.flush();

    assertEquals(1L, tracker.getUnflushedReaderSuccess());
    assertEquals(2L, tracker.getUnflushedSinkSuccess());
    assertEquals(1L, tracker.getUnflushedSinkFailed());

    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    EntityStatsTracker emptyTracker = new EntityStatsTracker("job", "server", "user", statsDAO);
    getOperationCount(emptyTracker).set(7);
    long before = getLastFlushTime(emptyTracker);

    emptyTracker.flush();

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
    assertEquals(0L, getOperationCount(emptyTracker).get());
    assertTrue(getLastFlushTime(emptyTracker) >= before);
  }

  private AtomicLong getOperationCount(EntityStatsTracker tracker) throws Exception {
    return (AtomicLong) getField(tracker, "operationCount");
  }

  private long getLastFlushTime(EntityStatsTracker tracker) throws Exception {
    return (long) getField(tracker, "lastFlushTime");
  }

  private void setLastFlushTime(EntityStatsTracker tracker, long value) throws Exception {
    Field field = tracker.getClass().getDeclaredField("lastFlushTime");
    field.setAccessible(true);
    field.setLong(tracker, value);
  }

  private Object getField(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }
}
