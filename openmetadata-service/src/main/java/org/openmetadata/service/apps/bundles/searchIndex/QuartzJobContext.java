package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.UUID;
import org.openmetadata.schema.entity.app.App;
import org.quartz.JobExecutionContext;

/**
 * Implementation of ReindexingJobContext for Quartz-scheduled jobs. Extracts job metadata from
 * Quartz JobExecutionContext and the associated App.
 */
public class QuartzJobContext implements ReindexingJobContext {

  private final UUID jobId;
  private final String jobName;
  private final Long startTime;
  private final UUID appId;
  private final boolean distributed;

  public QuartzJobContext(JobExecutionContext jobExecutionContext, App app, boolean distributed) {
    this.jobName =
        jobExecutionContext != null
            ? jobExecutionContext.getJobDetail().getKey().getName()
            : "unknown";
    this.startTime = System.currentTimeMillis();
    this.appId = app != null ? app.getId() : null;
    this.jobId = appId != null ? appId : UUID.randomUUID();
    this.distributed = distributed;
  }

  @Override
  public UUID getJobId() {
    return jobId;
  }

  @Override
  public String getJobName() {
    return jobName;
  }

  @Override
  public Long getStartTime() {
    return startTime;
  }

  @Override
  public UUID getAppId() {
    return appId;
  }

  @Override
  public boolean isDistributed() {
    return distributed;
  }

  @Override
  public String getSource() {
    return "QUARTZ";
  }
}
