package org.openmetadata.it.tests.alerts;

import java.util.Date;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.TriggerBuilder;
import org.quartz.impl.JobExecutionContextImpl;
import org.quartz.spi.OperableTrigger;
import org.quartz.spi.TriggerFiredBundle;

/**
 * Runs one tick of an alert on the calling thread, against the real database, without Quartz
 * deciding when. That keeps a test's output independent of scheduling.
 */
final class DirectTick {

  private DirectTick() {}

  /** Returns the job data as the tick left it, which is where destination status lives today. */
  static JobDataMap run(EventSubscription alert) {
    JobDataMap jobData = new JobDataMap();
    jobData.put(AbstractEventConsumer.ALERT_INFO_KEY, JsonUtils.pojoToJson(alert));
    JobDetail jobDetail =
        JobBuilder.newJob(AlertPublisher.class)
            .withIdentity("direct-" + alert.getId())
            .usingJobData(jobData)
            .build();
    AlertPublisher job = new AlertPublisher(new DIContainer());
    job.execute(new JobExecutionContextImpl(null, firedNow(jobDetail), job));
    return jobDetail.getJobDataMap();
  }

  private static TriggerFiredBundle firedNow(JobDetail jobDetail) {
    OperableTrigger trigger =
        (OperableTrigger)
            TriggerBuilder.newTrigger()
                .withIdentity("direct-" + jobDetail.getKey().getName())
                .forJob(jobDetail)
                .startNow()
                .build();
    Date now = new Date();
    return new TriggerFiredBundle(jobDetail, trigger, null, false, now, now, null, null);
  }
}
