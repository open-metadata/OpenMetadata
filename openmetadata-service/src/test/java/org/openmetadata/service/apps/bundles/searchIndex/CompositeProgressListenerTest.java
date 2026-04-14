package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

class CompositeProgressListenerTest {

  @Test
  void listenersAreOrderedByPriorityAndManagementMethodsWork() {
    CompositeProgressListener composite = new CompositeProgressListener();
    List<String> events = new ArrayList<>();
    RecordingListener lowPriority = new RecordingListener("low", 50, events);
    RecordingListener highPriority = new RecordingListener("high", 10, events);

    composite.addListener(lowPriority);
    composite.addListener(highPriority);
    composite.onJobStarted(context());

    assertEquals(List.of("high:onJobStarted", "low:onJobStarted"), events);
    assertEquals(2, composite.getListenerCount());
    assertEquals(0, composite.getPriority());

    composite.removeListener(lowPriority);
    assertEquals(1, composite.getListenerCount());

    composite.clearListeners();
    assertEquals(0, composite.getListenerCount());
  }

  @Test
  void listenerFailuresDoNotPreventRemainingCallbacksFromRunning() {
    CompositeProgressListener composite = new CompositeProgressListener();
    List<String> events = new ArrayList<>();
    RecordingListener recording = new RecordingListener("recording", 20, events);

    composite.addListener(new ThrowingListener(10));
    composite.addListener(recording);

    Stats stats = new Stats();
    StepStats stepStats = new StepStats().withTotalRecords(5);
    IndexingError indexingError = new IndexingError().withMessage("failure");
    ReindexingJobContext context = context();
    ReindexingConfiguration configuration =
        ReindexingConfiguration.builder().entities(Set.of("table")).build();

    composite.onJobStarted(context);
    composite.onJobConfigured(context, configuration);
    composite.onIndexRecreationStarted(Set.of("table"));
    composite.onEntityTypeStarted("table", 10);
    composite.onProgressUpdate(stats, context);
    composite.onEntityTypeCompleted("table", stepStats);
    composite.onError("table", indexingError, stats);
    composite.onReaderFailure(
        "table", "id", "reader failure", ReindexingProgressListener.FailureType.DB_ERROR);
    composite.onProcessFailure("table", "id", "process failure");
    composite.onSinkFailure("table", "id", "sink failure");
    composite.onSubIndexingCompleted("table", "columns", stepStats);
    composite.onJobCompleted(stats, 100L);
    composite.onJobCompletedWithErrors(stats, 200L);
    composite.onJobFailed(stats, new RuntimeException("boom"));
    composite.onJobStopped(stats);

    assertEquals(15, events.size());
    assertTrue(events.contains("recording:onError"));
    assertTrue(events.contains("recording:onJobCompletedWithErrors"));
    assertTrue(events.contains("recording:onJobStopped"));
  }

  private ReindexingJobContext context() {
    return new ReindexingJobContext() {
      @Override
      public UUID getJobId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000001");
      }

      @Override
      public String getJobName() {
        return "test-job";
      }

      @Override
      public Long getStartTime() {
        return 1L;
      }

      @Override
      public UUID getAppId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000002");
      }

      @Override
      public boolean isDistributed() {
        return false;
      }

      @Override
      public String getSource() {
        return "UNIT_TEST";
      }
    };
  }

  private static class RecordingListener implements ReindexingProgressListener {
    private final String name;
    private final int priority;
    private final List<String> events;

    private RecordingListener(String name, int priority, List<String> events) {
      this.name = name;
      this.priority = priority;
      this.events = events;
    }

    private void record(String event) {
      events.add(name + ":" + event);
    }

    @Override
    public void onJobStarted(ReindexingJobContext context) {
      record("onJobStarted");
    }

    @Override
    public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
      record("onJobConfigured");
    }

    @Override
    public void onIndexRecreationStarted(Set<String> entities) {
      record("onIndexRecreationStarted");
    }

    @Override
    public void onEntityTypeStarted(String entityType, long totalRecords) {
      record("onEntityTypeStarted");
    }

    @Override
    public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
      record("onProgressUpdate");
    }

    @Override
    public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
      record("onEntityTypeCompleted");
    }

    @Override
    public void onError(String entityType, IndexingError error, Stats currentStats) {
      record("onError");
    }

    @Override
    public void onReaderFailure(
        String entityType, String entityId, String error, FailureType type) {
      record("onReaderFailure");
    }

    @Override
    public void onProcessFailure(String entityType, String entityId, String error) {
      record("onProcessFailure");
    }

    @Override
    public void onSinkFailure(String entityType, String entityId, String error) {
      record("onSinkFailure");
    }

    @Override
    public void onSubIndexingCompleted(
        String entityType, String subIndex, StepStats subIndexStats) {
      record("onSubIndexingCompleted");
    }

    @Override
    public void onJobCompleted(Stats finalStats, long elapsedMillis) {
      record("onJobCompleted");
    }

    @Override
    public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
      record("onJobCompletedWithErrors");
    }

    @Override
    public void onJobFailed(Stats currentStats, Exception error) {
      record("onJobFailed");
    }

    @Override
    public void onJobStopped(Stats currentStats) {
      record("onJobStopped");
    }

    @Override
    public int getPriority() {
      return priority;
    }
  }

  private static class ThrowingListener implements ReindexingProgressListener {
    private final int priority;

    private ThrowingListener(int priority) {
      this.priority = priority;
    }

    private void fail() {
      throw new IllegalStateException("listener failure");
    }

    @Override
    public void onJobStarted(ReindexingJobContext context) {
      fail();
    }

    @Override
    public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
      fail();
    }

    @Override
    public void onIndexRecreationStarted(Set<String> entities) {
      fail();
    }

    @Override
    public void onEntityTypeStarted(String entityType, long totalRecords) {
      fail();
    }

    @Override
    public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
      fail();
    }

    @Override
    public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
      fail();
    }

    @Override
    public void onError(String entityType, IndexingError error, Stats currentStats) {
      fail();
    }

    @Override
    public void onReaderFailure(
        String entityType, String entityId, String error, FailureType type) {
      fail();
    }

    @Override
    public void onProcessFailure(String entityType, String entityId, String error) {
      fail();
    }

    @Override
    public void onSinkFailure(String entityType, String entityId, String error) {
      fail();
    }

    @Override
    public void onSubIndexingCompleted(
        String entityType, String subIndex, StepStats subIndexStats) {
      fail();
    }

    @Override
    public void onJobCompleted(Stats finalStats, long elapsedMillis) {
      fail();
    }

    @Override
    public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
      fail();
    }

    @Override
    public void onJobFailed(Stats currentStats, Exception error) {
      fail();
    }

    @Override
    public void onJobStopped(Stats currentStats) {
      fail();
    }

    @Override
    public int getPriority() {
      return priority;
    }
  }
}
