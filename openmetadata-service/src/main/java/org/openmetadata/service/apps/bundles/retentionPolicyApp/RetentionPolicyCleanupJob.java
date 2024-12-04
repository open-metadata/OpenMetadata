package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.RetentionJobContext;
import org.openmetadata.service.Entity;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

import static org.openmetadata.service.apps.bundles.retentionPolicyApp.RetentionPolicyScheduler.RETENTION_PERIOD_CONTEXT;

@Slf4j
public class RetentionPolicyCleanupJob implements Job {

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    JobDataMap jobDataMap = jobExecutionContext.getJobDetail().getJobDataMap();
    RetentionJobContext jobContext = (RetentionJobContext) jobDataMap.get(RETENTION_PERIOD_CONTEXT);
    String entityType = jobContext.getEntity();

    LOG.info("Executing cleanup job for entity: {}", entityType);

    try {
      CleanupHandler handler = CleanupHandlerFactory.getHandler(entityType);
      handler.performCleanup(jobContext);
    } catch (IllegalArgumentException e) {
      LOG.error("No cleanup handler found for entity: {}", entityType, e);
    }
  }

}
