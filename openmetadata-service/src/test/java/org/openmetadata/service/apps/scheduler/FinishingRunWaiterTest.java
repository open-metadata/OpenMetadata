package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.UnhandledServerException;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;

class FinishingRunWaiterTest {
  private static final JobKey RUN_KEY = new JobKey("App-OnDemandJob", AppScheduler.APPS_JOB_GROUP);

  @Test
  void aRunThatStartsWhileWaitingEndsTheWaitAsRunning() throws Exception {
    Scheduler scheduler = mock(Scheduler.class);
    JobExecutionContext finishing = run(AppRunRecord.Status.SUCCESS);
    JobExecutionContext nextRun = run(AppRunRecord.Status.RUNNING);
    when(scheduler.getCurrentlyExecutingJobs()).thenReturn(List.of(finishing), List.of(nextRun));
    FinishingRunWaiter waiter = new FinishingRunWaiter(scheduler, () -> polls(5));

    assertFalse(waiter.awaitLocalRelease("App", Set.of(RUN_KEY)));
  }

  @Test
  void aRunOfAnotherAppIsNotWaitedFor() throws Exception {
    Scheduler scheduler = mock(Scheduler.class);
    JobExecutionContext other = run(AppRunRecord.Status.RUNNING);
    when(scheduler.getCurrentlyExecutingJobs()).thenReturn(List.of(other));
    FinishingRunWaiter waiter = new FinishingRunWaiter(scheduler, () -> polls(0));

    JobKey thisApp = new JobKey("ThisApp-OnDemandJob", AppScheduler.APPS_JOB_GROUP);
    assertTrue(waiter.awaitLocalRelease("ThisApp", Set.of(thisApp)));
  }

  @Test
  void anInterruptedWaitIsAServerErrorAndKeepsTheInterrupt() {
    FinishingRunWaiter.Budget budget = FinishingRunWaiter.timedBudget();
    Thread.currentThread().interrupt();
    try {
      assertThrows(UnhandledServerException.class, budget::awaitNextPoll);
      assertTrue(Thread.currentThread().isInterrupted());
    } finally {
      Thread.interrupted();
    }
  }

  private static FinishingRunWaiter.Budget polls(int count) {
    AtomicInteger remaining = new AtomicInteger(count);
    return () -> remaining.getAndDecrement() > 0;
  }

  private static JobExecutionContext run(AppRunRecord.Status status) {
    JobDetail detail =
        JobBuilder.newJob(Job.class)
            .withIdentity(RUN_KEY)
            .usingJobData(
                OmAppJobListener.SCHEDULED_APP_RUN_EXTENSION,
                JsonUtils.pojoToJson(new AppRunRecord().withStatus(status)))
            .build();
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(detail);
    return context;
  }
}
