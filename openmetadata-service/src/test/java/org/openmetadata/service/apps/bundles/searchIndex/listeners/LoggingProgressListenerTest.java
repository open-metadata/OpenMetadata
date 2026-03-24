package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobLogger;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;

class LoggingProgressListenerTest {

  @Test
  void onJobConfiguredInitializesLoggerAndTracksSettings() throws Exception {
    LoggingProgressListener listener = new LoggingProgressListener();
    ReindexingJobContext context = mock(ReindexingJobContext.class);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(50)
            .consumerThreads(4)
            .producerThreads(3)
            .queueSize(200)
            .maxConcurrentRequests(8)
            .payloadSize(2L * 1024 * 1024)
            .autoTune(true)
            .recreateIndex(true)
            .useDistributedIndexing(true)
            .build();

    listener.onJobConfigured(context, config);

    ReindexingJobLogger logger = (ReindexingJobLogger) getField(listener, "logger");
    assertNotNull(logger);
    assertEquals(true, getField(listener, "isSmartReindexing"));
    Map<String, String> details = (Map<String, String>) getField(logger, "initializationDetails");
    assertEquals("50", details.get("Batch Size"));
    assertEquals("4", details.get("Consumer Threads"));
    assertEquals("3", details.get("Producer Threads"));
    assertEquals("200", details.get("Queue Size"));
    assertEquals("8", details.get("Max Concurrent Requests"));
    assertEquals("2.0 MB", details.get("Payload Size"));
    assertEquals("Enabled", details.get("Auto-tune"));
    assertEquals("Yes", details.get("Recreate Index"));
    assertEquals("Yes", details.get("Distributed Mode"));
  }

  @Test
  void delegatesToLoggerWhenPresent() throws Exception {
    LoggingProgressListener listener = new LoggingProgressListener();
    ReindexingJobLogger logger = mock(ReindexingJobLogger.class);
    Stats stats =
        new Stats().withJobStats(new StepStats().withTotalRecords(5).withSuccessRecords(4));

    setField(listener, "logger", logger);

    listener.onEntityTypeStarted("table", 5);
    listener.onProgressUpdate(stats, mock(ReindexingJobContext.class));
    listener.onEntityTypeCompleted(
        "table", new StepStats().withSuccessRecords(4).withFailedRecords(1));
    listener.onError(
        "table",
        new IndexingError().withMessage("boom").withErrorSource(IndexingError.ErrorSource.SINK),
        stats);
    listener.onJobCompleted(stats, 1000);
    listener.onJobCompletedWithErrors(stats, 1000);
    listener.onJobFailed(stats, new IllegalStateException("failure"));

    verify(logger).markEntityStarted("table");
    verify(logger).logProgress(stats);
    verify(logger).markEntityCompleted("table");
    verify(logger).logWarning(any(), any(), any(), any());
    verify(logger, times(2)).logCompletion(stats);
    verify(logger).logError(any(), any(Throwable.class));
  }

  @Test
  void fallbackBranchesAndPriorityRemainStable() throws Exception {
    LoggingProgressListener listener = new LoggingProgressListener();
    Stats stats =
        new Stats()
            .withJobStats(
                new StepStats().withTotalRecords(5).withSuccessRecords(3).withFailedRecords(2));
    ReindexingJobContext context = mock(ReindexingJobContext.class);

    listener.onJobStarted(context);
    listener.onIndexRecreationStarted(Set.of("table", "user"));
    listener.onEntityTypeStarted("table", 5);
    listener.onProgressUpdate(stats, context);
    listener.onEntityTypeCompleted(
        "table", new StepStats().withSuccessRecords(3).withFailedRecords(2));
    listener.onError(
        "table",
        new IndexingError().withMessage("reader").withErrorSource(IndexingError.ErrorSource.READER),
        stats);
    listener.onJobCompleted(stats, 2000);
    listener.onJobCompletedWithErrors(stats, 2000);
    listener.onJobFailed(stats, new IllegalStateException("failure"));
    listener.onReaderFailure(
        "table", "id-1", "missing", ReindexingProgressListener.FailureType.ENTITY_NOT_FOUND);
    listener.onReaderFailure(
        "table", "id-2", "broken", ReindexingProgressListener.FailureType.DB_ERROR);
    listener.onProcessFailure("table", "id-3", "process");
    listener.onSinkFailure("table", "id-4", "sink");
    listener.onSubIndexingCompleted(
        "table", "columns", new StepStats().withSuccessRecords(2).withFailedRecords(1));
    listener.onJobStopped(stats);

    assertEquals(30, listener.getPriority());
    assertEquals(
        "999 B", invokePrivate(listener, "formatBytes", new Class<?>[] {long.class}, 999L));
    assertEquals(
        "2.0 KB", invokePrivate(listener, "formatBytes", new Class<?>[] {long.class}, 2048L));
    assertEquals(
        "3.0 MB",
        invokePrivate(listener, "formatBytes", new Class<?>[] {long.class}, 3L * 1024 * 1024));
  }

  private Object invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private Object getField(Object target, String name) throws Exception {
    Class<?> type = target.getClass();
    while (type != null) {
      try {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
      } catch (NoSuchFieldException ignored) {
        type = type.getSuperclass();
      }
    }
    throw new NoSuchFieldException(name);
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Class<?> type = target.getClass();
    while (type != null) {
      try {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
        return;
      } catch (NoSuchFieldException ignored) {
        type = type.getSuperclass();
      }
    }
    throw new NoSuchFieldException(name);
  }
}
