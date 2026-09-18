package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.AlertRows;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

class LegacyJobDataReaderTest {

  private final EventSubscription alert =
      new EventSubscription()
          .withId(UUID.randomUUID())
          .withName("alert")
          .withEnabled(true)
          .withDestinations(List.of(new SubscriptionDestination().withId(UUID.randomUUID())));

  @Test
  void olderServerReadsPositionFromRowAfterNewerCommit() {
    JobDataMap written = CopyForOlderServers.dataFor(alert, Map.of());

    LegacyJobDataReader.WhatAnOlderServerSees seen = LegacyJobDataReader.read(written);

    assertNotNull(seen, "the previous release refuses a job without the alert in its data");
    assertEquals(alert.getId(), seen.alert().getId());
    assertTrue(seen.readsPositionFromTheRow());
  }

  @Test
  void olderServerDoesNotResendSkippedBacklog() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(dataAnOlderServerLeftBehind());

    boolean safe =
        withTheAlertStillStored(() -> CopyForOlderServers.ensure(scheduler, alert, Map.of()));

    assertTrue(safe);
    assertTrue(LegacyJobDataReader.read(rewrittenData(scheduler)).readsPositionFromTheRow());
  }

  @Test
  void olderServerIgnoresGapKeyDroppedByNewerTick() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(dataAnOlderServerLeftBehind());

    withTheAlertStillStored(() -> CopyForOlderServers.ensure(scheduler, alert, Map.of()));

    assertEquals(0L, LegacyJobDataReader.read(rewrittenData(scheduler)).gapSince());
  }

  @Test
  void rewriteSkippedWhenJobDataAlreadyMatches() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(CopyForOlderServers.dataFor(alert, Map.of()));

    assertTrue(CopyForOlderServers.ensure(scheduler, alert, Map.of()));

    verify(scheduler, never()).addJob(any(), anyBoolean(), anyBoolean());
  }

  // An older server that handles an edit replaces the job with the offset it read before the
  // running tick commits. Only a read of the stored data, never the fire-time snapshot, sees it.
  @Test
  void olderServerEditDuringNewerTickDoesNotResend() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(CopyForOlderServers.dataFor(alert, Map.of()));
    assertTrue(CopyForOlderServers.ensure(scheduler, alert, Map.of()));
    when(scheduler.getJobDetail(any(JobKey.class)))
        .thenReturn(jobWith(dataAnOlderServerLeftBehind()));

    withTheAlertStillStored(() -> CopyForOlderServers.ensure(scheduler, alert, Map.of()));

    assertTrue(LegacyJobDataReader.read(rewrittenData(scheduler)).readsPositionFromTheRow());
  }

  @Test
  void tickDoesNotSendWhenStaleOffsetKeyCannotBeDropped() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(dataAnOlderServerLeftBehind());
    doThrow(new SchedulerException("job store is down"))
        .when(scheduler)
        .addJob(any(), eq(true), eq(true));

    assertFalse(CopyForOlderServers.ensure(scheduler, alert, Map.of()));
  }

  @Test
  void rewriteNeverBringsBackAJobOfADeletedAlert() throws SchedulerException {
    Scheduler scheduler = schedulerHolding(dataAnOlderServerLeftBehind());

    try (MockedStatic<AlertRows> rows = mockStatic(AlertRows.class)) {
      rows.when(() -> AlertRows.readOrNull(alert.getId())).thenReturn(null);
      CopyForOlderServers.ensure(scheduler, alert, Map.of());
    }

    verify(scheduler).deleteJob(any(JobKey.class));
  }

  private JobDataMap dataAnOlderServerLeftBehind() {
    JobDataMap data = CopyForOlderServers.dataFor(alert, Map.of());
    EventSubscriptionOffset cached =
        new EventSubscriptionOffset().withCurrentOffset(100L).withStartingOffset(1L);
    data.put(AbstractEventConsumer.ALERT_OFFSET_KEY, JsonUtils.pojoToJson(cached));
    data.put(AbstractEventConsumer.ALERT_PENDING_GAP_SINCE_KEY, "1700000000000");
    return data;
  }

  private Scheduler schedulerHolding(JobDataMap stored) throws SchedulerException {
    Scheduler scheduler = mock(Scheduler.class);
    when(scheduler.getJobDetail(any(JobKey.class))).thenReturn(jobWith(stored));
    return scheduler;
  }

  private JobDetail jobWith(JobDataMap data) {
    return JobBuilder.newJob(AlertPublisher.class)
        .withIdentity(alert.getId().toString(), "OMAlertJobGroup")
        .usingJobData(data)
        .build();
  }

  private static JobDataMap rewrittenData(Scheduler scheduler) throws SchedulerException {
    ArgumentCaptor<JobDetail> rewritten = ArgumentCaptor.forClass(JobDetail.class);
    verify(scheduler).addJob(rewritten.capture(), eq(true), eq(true));
    return rewritten.getValue().getJobDataMap();
  }

  private boolean withTheAlertStillStored(BooleanSupplier action) {
    try (MockedStatic<AlertRows> rows = mockStatic(AlertRows.class)) {
      rows.when(() -> AlertRows.readOrNull(alert.getId())).thenReturn(alert);
      return action.getAsBoolean();
    }
  }
}
