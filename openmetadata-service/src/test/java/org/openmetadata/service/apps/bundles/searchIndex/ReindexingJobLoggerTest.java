package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

class ReindexingJobLoggerTest {

  @Test
  void logInitializationStoresDetailsAndOnlyRunsOnce() throws Exception {
    ReindexingJobLogger logger = new ReindexingJobLogger(job(Set.of("table", "user")), false);

    logger.addInitDetail("Batch Size", 200);
    logger.addInitDetail("Payload Size", "1 MB");
    logger.logInitialization();
    logger.logInitialization();

    assertTrue((Boolean) getField(logger, "hasLoggedInitialization"));
    Map<String, String> details = getInitDetails(logger);
    assertEquals("200", details.get("Batch Size"));
    assertEquals("1 MB", details.get("Payload Size"));
  }

  @Test
  void smartReindexingStillTracksConsumerLifecycleWithoutVerboseOutput() throws Exception {
    ReindexingJobLogger logger = new ReindexingJobLogger(job(Set.of("table")), true);

    logger.logInitialization();
    logger.logConsumerLifecycle(1, true);
    logger.logConsumerLifecycle(1, false);

    Map<String, AtomicLong> threadStats = getThreadStats(logger);
    assertEquals(1L, threadStats.get("started").get());
    assertEquals(1L, threadStats.get("finished").get());
  }

  @Test
  void progressUpdatesTotalsEntityStateAndCompletionStatus() throws Exception {
    ReindexingJobLogger logger = new ReindexingJobLogger(job(Set.of("table")), false);

    Stats stats = new Stats();
    stats.setJobStats(
        new StepStats().withTotalRecords(10).withSuccessRecords(5).withFailedRecords(1));
    stats.setEntityStats(
        new org.openmetadata.schema.system.EntityStats()
            .withAdditionalProperty(
                "table",
                new StepStats().withTotalRecords(10).withSuccessRecords(5).withFailedRecords(1)));

    logger.markEntityStarted("table");
    logger.logProgress(stats);
    logger.markEntityCompleted("table");
    logger.logCompletion(stats);

    assertEquals(5L, ((AtomicLong) getField(logger, "totalProcessed")).get());
    assertEquals(10L, ((AtomicLong) getField(logger, "totalRecords")).get());
    assertEquals(5L, ((AtomicLong) getField(logger, "lastProcessedCount")).get());
    assertTrue((Long) getField(logger, "lastProgressLog") > 0);

    Map<String, Object> entityProgressMap = getEntityProgressMap(logger);
    Object progress = entityProgressMap.get("table");
    assertEquals("Completed", getProgressField(progress, "status"));
    assertEquals(5L, ((AtomicLong) getProgressField(progress, "processed")).get());
    assertEquals(10L, ((AtomicLong) getProgressField(progress, "total")).get());
    assertEquals(1L, ((AtomicLong) getProgressField(progress, "failed")).get());
  }

  @Test
  void logProgressSkipsNullOrThrottledUpdates() throws Exception {
    ReindexingJobLogger logger = new ReindexingJobLogger(job(Set.of("table")), false);

    logger.logProgress(null);
    assertEquals(0L, ((AtomicLong) getField(logger, "lastProcessedCount")).get());

    setField(logger, "lastProgressLog", System.currentTimeMillis());
    logger.logProgress(
        new Stats().withJobStats(new StepStats().withTotalRecords(9).withSuccessRecords(9)));

    assertEquals(0L, ((AtomicLong) getField(logger, "lastProcessedCount")).get());
  }

  @Test
  void formattingHelpersCoverSecondsMinutesAndHours() throws Exception {
    ReindexingJobLogger logger = new ReindexingJobLogger(job(Set.of("table")), false);

    assertEquals(
        "12,345", invokePrivate(logger, "formatNumber", new Class<?>[] {long.class}, 12_345L));
    assertEquals(
        "37.5%", invokePrivate(logger, "formatPercentage", new Class<?>[] {double.class}, 37.5d));
    assertEquals(
        "45s",
        invokePrivate(
            logger, "formatDuration", new Class<?>[] {Duration.class}, Duration.ofSeconds(45)));
    assertEquals(
        "2m 5s",
        invokePrivate(
            logger, "formatDuration", new Class<?>[] {Duration.class}, Duration.ofSeconds(125)));
    assertEquals(
        "1h 5m",
        invokePrivate(
            logger, "formatDuration", new Class<?>[] {Duration.class}, Duration.ofMinutes(65)));

    logger.logError("testing", new IllegalStateException("boom"));
    logger.logWarning("warning {}", "value");
  }

  private EventPublisherJob job(Set<String> entities) {
    return new EventPublisherJob().withEntities(entities);
  }

  private Map<String, String> getInitDetails(ReindexingJobLogger logger) throws Exception {
    return (Map<String, String>) getField(logger, "initializationDetails");
  }

  private Map<String, AtomicLong> getThreadStats(ReindexingJobLogger logger) throws Exception {
    return (Map<String, AtomicLong>) getField(logger, "threadStats");
  }

  private Map<String, Object> getEntityProgressMap(ReindexingJobLogger logger) throws Exception {
    return (Map<String, Object>) getField(logger, "entityProgressMap");
  }

  private Object getProgressField(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  private Object invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private Object getField(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }
}
