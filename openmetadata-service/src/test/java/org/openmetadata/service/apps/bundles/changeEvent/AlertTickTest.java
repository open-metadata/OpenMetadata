package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.subscription.AlertRows;
import org.quartz.JobBuilder;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/** A tick runs only for the alert its job names; any other job is refused once and stops. */
class AlertTickTest {

  @Test
  void aJobThatNamesNoAlertCompletesItsTrigger() {
    JobExecutionContext tick =
        tick(new JobKey("stray", AlertJobs.JOB_GROUP), mock(Scheduler.class));

    try (MockedStatic<AlertRows> rows = mockStatic(AlertRows.class)) {
      JobExecutionException refused =
          assertThrows(JobExecutionException.class, () -> AlertTick.run(null, tick));

      assertTrue(refused.unscheduleFiringTrigger(), "Quartz stops the trigger that fired it");
      rows.verifyNoInteractions();
    }
  }

  @Test
  void aTickThatCannotDecideKeepsItsTrigger() throws SchedulerException {
    Scheduler scheduler = mock(Scheduler.class);
    when(scheduler.getJobDetail(any())).thenThrow(new SchedulerException("store down"));
    String variant = UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
    JobExecutionContext tick = tick(new JobKey(variant, AlertJobs.JOB_GROUP), scheduler);

    JobExecutionException undecided =
        assertThrows(JobExecutionException.class, () -> AlertTick.run(null, tick));

    assertFalse(undecided.unscheduleFiringTrigger(), "the next tick asks the store again");
  }

  private static JobExecutionContext tick(JobKey key, Scheduler scheduler) {
    JobExecutionContext tick = mock(JobExecutionContext.class);
    when(tick.getJobDetail())
        .thenReturn(JobBuilder.newJob(AlertPublisher.class).withIdentity(key).build());
    when(tick.getScheduler()).thenReturn(scheduler);
    return tick;
  }
}
