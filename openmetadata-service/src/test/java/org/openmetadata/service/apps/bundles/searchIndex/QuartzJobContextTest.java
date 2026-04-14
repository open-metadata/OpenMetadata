package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class QuartzJobContextTest {

  @Test
  void quartzJobContextUsesQuartzAndAppMetadata() {
    JobDetail jobDetail = newJobDetail();
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(jobDetail);

    App app = mock(App.class);
    UUID appId = UUID.randomUUID();
    when(app.getId()).thenReturn(appId);

    long before = System.currentTimeMillis();
    QuartzJobContext context = new QuartzJobContext(quartzContext, app, true);
    long after = System.currentTimeMillis();

    assertEquals(appId, context.getJobId());
    assertEquals("reindex-job", context.getJobName());
    assertEquals(appId, context.getAppId());
    assertTrue(context.getStartTime() >= before && context.getStartTime() <= after);
    assertTrue(context.isDistributed());
    assertEquals("QUARTZ", context.getSource());
  }

  @Test
  void quartzJobContextFallsBackWhenQuartzContextOrAppIsMissing() {
    QuartzJobContext context = new QuartzJobContext(null, null, false);

    assertNotNull(context.getJobId());
    assertEquals("unknown", context.getJobName());
    assertNull(context.getAppId());
    assertFalse(context.isDistributed());
    assertEquals("QUARTZ", context.getSource());
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
