package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.SlackWebApiClient;

class SlackProgressListenerTest {

  @Test
  void jobConfiguredFormatsAllEntitiesAndPublishesConfiguration() throws Exception {
    SlackProgressListener listener =
        new SlackProgressListener("token", "channel", "http://om.local");
    SlackWebApiClient slackClient = mock(SlackWebApiClient.class);
    setField(listener, "slackClient", slackClient);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("all"))
            .batchSize(100)
            .consumerThreads(4)
            .producerThreads(2)
            .queueSize(500)
            .maxConcurrentRequests(8)
            .payloadSize(5L * 1024 * 1024)
            .autoTune(true)
            .recreateIndex(false)
            .build();

    listener.onJobConfigured(mock(ReindexingJobContext.class), config);

    ArgumentCaptor<Map<String, String>> detailsCaptor = ArgumentCaptor.forClass(Map.class);
    verify(slackClient).setConfigurationDetails(detailsCaptor.capture());
    verify(slackClient).sendStartNotification("All", false, 1);

    Map<String, String> details = detailsCaptor.getValue();
    assertEquals("Enabled", details.get("Auto-tune"));
    assertEquals("100", details.get("Batch size"));
    assertEquals("4", details.get("Consumer threads"));
    assertEquals("2", details.get("Producer threads"));
    assertEquals("500", details.get("Queue size"));
    assertEquals("1", details.get("Total entities"));
    assertEquals("No", details.get("Recreating indices"));
    assertEquals("5 MB", details.get("Payload size"));
    assertEquals("8", details.get("Concurrent requests"));
  }

  @Test
  void delegatesProgressCompletionAndErrorNotifications() throws Exception {
    SlackProgressListener listener =
        new SlackProgressListener("token", "channel", "http://om.local");
    SlackWebApiClient slackClient = mock(SlackWebApiClient.class);
    setField(listener, "slackClient", slackClient);

    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(new LinkedHashSet<>(java.util.List.of("table", "user")))
            .batchSize(50)
            .consumerThreads(2)
            .producerThreads(1)
            .queueSize(200)
            .maxConcurrentRequests(3)
            .payloadSize(2L * 1024 * 1024)
            .recreateIndex(true)
            .build();
    Stats stats =
        new Stats()
            .withJobStats(
                new StepStats().withTotalRecords(10).withSuccessRecords(8).withFailedRecords(2));

    listener.onJobConfigured(mock(ReindexingJobContext.class), config);
    listener.onJobStarted(mock(ReindexingJobContext.class));
    listener.onIndexRecreationStarted(Set.of("table", "user"));
    listener.onEntityTypeStarted("table", 10);
    listener.onProgressUpdate(stats, mock(ReindexingJobContext.class));
    listener.onEntityTypeCompleted(
        "table", new StepStats().withSuccessRecords(8).withFailedRecords(2));
    listener.onError(
        "table",
        new IndexingError().withMessage("sink").withErrorSource(IndexingError.ErrorSource.SINK),
        stats);
    listener.onJobCompleted(stats, 5_000L);
    listener.onJobCompletedWithErrors(stats, 6_000L);
    listener.onJobFailed(stats, new IllegalStateException("boom"));
    listener.onJobStopped(stats);

    verify(slackClient).setConfigurationDetails(org.mockito.ArgumentMatchers.anyMap());
    verify(slackClient).sendStartNotification("table, user", true, 2);
    verify(slackClient).sendProgressUpdate(stats);
    verify(slackClient).sendCompletionNotification(stats, 5L, false);
    verify(slackClient).sendCompletionNotification(stats, 6L, true);
    verify(slackClient).sendErrorNotification("boom");
    verifyNoMoreInteractions(slackClient);
    assertEquals(50, listener.getPriority());
  }

  @Test
  void privateHelpersHandleNullEmptyAndExplicitEntitySets() throws Exception {
    SlackProgressListener listener =
        new SlackProgressListener("token", "channel", "http://om.local");

    assertEquals(
        "None",
        invokePrivate(listener, "formatEntities", new Class<?>[] {Set.class}, new Object[] {null}));
    assertEquals(
        "None", invokePrivate(listener, "formatEntities", new Class<?>[] {Set.class}, Set.of()));
    assertEquals(
        "All",
        invokePrivate(listener, "formatEntities", new Class<?>[] {Set.class}, Set.of("all")));
    assertEquals(
        "table, topic",
        invokePrivate(
            listener,
            "formatEntities",
            new Class<?>[] {Set.class},
            new LinkedHashSet<>(java.util.List.of("table", "topic"))));
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private String invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return (String) method.invoke(target, args);
  }
}
