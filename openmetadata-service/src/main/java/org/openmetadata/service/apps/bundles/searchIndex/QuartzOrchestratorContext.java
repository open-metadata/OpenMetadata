package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.QuartzProgressListener;
import org.quartz.JobExecutionContext;

public class QuartzOrchestratorContext implements OrchestratorContext {

  private static final String APP_SCHEDULE_RUN = "AppScheduleRun";

  private final JobExecutionContext ctx;
  private final App app;
  private final Function<JobExecutionContext, AppRunRecord> jobRecordProvider;
  private final StatusPusher statusPusher;

  @FunctionalInterface
  public interface StatusPusher {
    void push(JobExecutionContext ctx, AppRunRecord record, boolean force);
  }

  public QuartzOrchestratorContext(
      JobExecutionContext ctx,
      App app,
      Function<JobExecutionContext, AppRunRecord> jobRecordProvider,
      StatusPusher statusPusher) {
    this.ctx = ctx;
    this.app = app;
    this.jobRecordProvider = jobRecordProvider;
    this.statusPusher = statusPusher;
  }

  @Override
  public String getJobName() {
    return ctx.getJobDetail().getKey().getName();
  }

  @Override
  public String getAppConfigJson() {
    return (String) ctx.getJobDetail().getJobDataMap().get(APP_CONFIG);
  }

  @Override
  public void storeRunStats(Stats stats) {
    ctx.getJobDetail().getJobDataMap().put(APP_RUN_STATS, stats);
  }

  @Override
  public void storeRunRecord(String json) {
    ctx.getJobDetail().getJobDataMap().put(APP_SCHEDULE_RUN, json);
  }

  @Override
  public AppRunRecord getJobRecord() {
    return jobRecordProvider.apply(ctx);
  }

  @Override
  public void pushStatusUpdate(AppRunRecord record, boolean force) {
    statusPusher.push(ctx, record, force);
  }

  @Override
  public UUID getAppId() {
    return app != null ? app.getId() : null;
  }

  @Override
  public Map<String, Object> getAppConfiguration() {
    return app != null ? JsonUtils.getMap(app.getAppConfiguration()) : null;
  }

  @Override
  public void updateAppConfiguration(Map<String, Object> config) {
    if (app != null) {
      app.setAppConfiguration(config);
    }
  }

  @Override
  public ReindexingProgressListener createProgressListener(EventPublisherJob jobData) {
    return new QuartzProgressListener(ctx, jobData, app, jobRecordProvider, statusPusher);
  }

  @Override
  public ReindexingJobContext createReindexingContext(boolean distributed) {
    return new QuartzJobContext(ctx, app, distributed);
  }
}
