package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.QuartzProgressListener;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class QuartzOrchestratorContextTest {

  @Test
  void orchestratorContextDelegatesQuartzStorageAndFactoryMethods() {
    JobDetail jobDetail = newJobDetail();
    jobDetail.getJobDataMap().put(OmAppJobListener.APP_CONFIG, "{\"batchSize\": 10}");
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(jobDetail);

    App app = mock(App.class);
    UUID appId = UUID.randomUUID();
    Map<String, Object> appConfig = Map.of("batchSize", 10, "mode", "smart");
    when(app.getId()).thenReturn(appId);
    when(app.getAppConfiguration()).thenReturn(appConfig);

    AppRunRecord appRunRecord = new AppRunRecord();
    QuartzOrchestratorContext.StatusPusher statusPusher =
        mock(QuartzOrchestratorContext.StatusPusher.class);
    QuartzOrchestratorContext context =
        new QuartzOrchestratorContext(quartzContext, app, ctx -> appRunRecord, statusPusher);

    Stats stats = new Stats();
    context.storeRunStats(stats);
    context.storeRunRecord("record-json");

    assertEquals("reindex-job", context.getJobName());
    assertEquals("{\"batchSize\": 10}", context.getAppConfigJson());
    assertSame(stats, jobDetail.getJobDataMap().get(OmAppJobListener.APP_RUN_STATS));
    assertEquals("record-json", jobDetail.getJobDataMap().get("AppScheduleRun"));
    assertSame(appRunRecord, context.getJobRecord());
    assertEquals(appId, context.getAppId());
    assertEquals(appConfig, context.getAppConfiguration());

    Map<String, Object> updatedConfig = Map.of("batchSize", 25);
    context.updateAppConfiguration(updatedConfig);
    verify(app).setAppConfiguration(updatedConfig);

    AppRunRecord pushedRecord = new AppRunRecord();
    context.pushStatusUpdate(pushedRecord, false);
    verify(statusPusher).push(quartzContext, pushedRecord, false);

    assertInstanceOf(
        QuartzProgressListener.class,
        context.createProgressListener(
            new EventPublisherJob().withEntities(java.util.Set.of("table"))));
    assertInstanceOf(QuartzJobContext.class, context.createReindexingContext(true));
  }

  @Test
  void orchestratorContextHandlesMissingApp() {
    QuartzOrchestratorContext context =
        new QuartzOrchestratorContext(
            mock(JobExecutionContext.class),
            null,
            ctx -> new AppRunRecord(),
            (ctx, record, force) -> {});

    assertNull(context.getAppId());
    assertNull(context.getAppConfiguration());
    context.updateAppConfiguration(Map.of("ignored", true));
  }

  private JobDetail newJobDetail() {
    return JobBuilder.newJob(NoOpQuartzJob.class)
        .withIdentity("reindex-job")
        .usingJobData(new JobDataMap())
        .build();
  }

  public static class NoOpQuartzJob implements Job {
    @Override
    public void execute(JobExecutionContext context) {}
  }
}
