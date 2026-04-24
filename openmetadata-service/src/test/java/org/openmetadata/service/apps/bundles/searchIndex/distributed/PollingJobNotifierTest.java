package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class PollingJobNotifierTest {

  @Test
  void startStopAndPublicNotificationMethodsManageLifecycle() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexJobDAO jobDAO = mock(CollectionDAO.SearchIndexJobDAO.class);
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(jobDAO.getRunningJobIds()).thenReturn(List.of());

    PollingJobNotifier notifier = new PollingJobNotifier(collectionDAO, "server-12345678");
    UUID jobId = UUID.randomUUID();

    assertFalse(notifier.isRunning());
    assertEquals("database-polling", notifier.getType());

    notifier.start();
    notifier.start();
    assertTrue(notifier.isRunning());
    ScheduledExecutorService scheduler = (ScheduledExecutorService) getField(notifier, "scheduler");
    assertNotNull(scheduler);
    scheduler.shutdownNow();
    assertTrue(scheduler.awaitTermination(5, TimeUnit.SECONDS));

    notifier.notifyJobStarted(jobId, "FULL");
    assertTrue(getKnownJobs(notifier).contains(jobId));

    notifier.notifyJobCompleted(jobId);
    assertFalse(getKnownJobs(notifier).contains(jobId));

    notifier.stop();
    assertFalse(notifier.isRunning());
    assertTrue(getKnownJobs(notifier).isEmpty());
  }

  @Test
  void pollForJobsDiscoversNewJobsAndClearsCompletedOnes() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexJobDAO jobDAO = mock(CollectionDAO.SearchIndexJobDAO.class);
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()), List.of());

    PollingJobNotifier notifier = new PollingJobNotifier(collectionDAO, "server-abcdef12");
    AtomicReference<UUID> callbackJob = new AtomicReference<>();
    notifier.onJobStarted(callbackJob::set);
    getRunningFlag(notifier).set(true);

    invokePoll(notifier);

    assertEquals(jobId, callbackJob.get());
    assertTrue(getKnownJobs(notifier).contains(jobId));

    setLastPollTime(notifier, System.currentTimeMillis() - 31_000L);
    invokePoll(notifier);

    assertTrue(getKnownJobs(notifier).isEmpty());
  }

  @Test
  void activePollingIntervalAndExceptionHandlingBehaveAsExpected() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexJobDAO jobDAO = mock(CollectionDAO.SearchIndexJobDAO.class);
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(jobDAO.getRunningJobIds()).thenThrow(new IllegalStateException("db down"));

    PollingJobNotifier notifier = new PollingJobNotifier(collectionDAO, "server-abcdef12");
    getRunningFlag(notifier).set(true);
    notifier.setParticipating(true);

    setLastPollTime(notifier, System.currentTimeMillis() - 500L);
    invokePoll(notifier);
    verifyNoInteractions(jobDAO);

    setLastPollTime(notifier, System.currentTimeMillis() - 1_500L);
    invokePoll(notifier);

    assertTrue(getKnownJobs(notifier).isEmpty());
  }

  @Test
  void stopHandlesPreconfiguredSchedulerAndInterruptedTermination() throws Exception {
    PollingJobNotifier notifier =
        new PollingJobNotifier(mock(CollectionDAO.class), "server-abcdef12");
    ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    getRunningFlag(notifier).set(true);
    getKnownJobs(notifier).add(UUID.randomUUID());
    setField(notifier, "scheduler", scheduler);

    notifier.stop();

    assertTrue(scheduler.isShutdown());
    assertTrue(getKnownJobs(notifier).isEmpty());
    assertFalse(notifier.isRunning());
  }

  private void invokePoll(PollingJobNotifier notifier) throws Exception {
    Method method = notifier.getClass().getDeclaredMethod("pollForJobs");
    method.setAccessible(true);
    method.invoke(notifier);
  }

  @SuppressWarnings("unchecked")
  private Set<UUID> getKnownJobs(PollingJobNotifier notifier) throws Exception {
    return (Set<UUID>) getField(notifier, "knownJobs");
  }

  private AtomicBoolean getRunningFlag(PollingJobNotifier notifier) throws Exception {
    return (AtomicBoolean) getField(notifier, "running");
  }

  private void setLastPollTime(PollingJobNotifier notifier, long value) throws Exception {
    Field field = notifier.getClass().getDeclaredField("lastPollTime");
    field.setAccessible(true);
    field.setLong(notifier, value);
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
