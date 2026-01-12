package org.openmetadata.service.events.scheduled;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;

@Slf4j
public class ServicesStatusJobHandler {
  public static final String HEALTHY_STATUS = "healthy";
  public static final String UNHEALTHY_STATUS = "unhealthy";
  public static final String DATABASE_SEARCH_STATUS_JOB = "databaseAndSearchServiceStatusJob";
  public static final String STATUS_GROUP = "status";
  public static final String DATABASE_SEARCH_STATUS_CRON_TRIGGER = "databaseAndSearchStatusTrigger";
  public static final String JOB_CONTEXT_METER_REGISTRY = "meterRegistry";
  public static final String JOB_CONTEXT_CLUSTER_NAME = "clusterName";

  private final PrometheusMeterRegistry meterRegistry;
  private final String clusterName;
  private final Scheduler scheduler = new StdSchedulerFactory().getScheduler();
  private final int servicesHealthCheckInterval;
  private static ServicesStatusJobHandler instance;

  private ServicesStatusJobHandler(
      EventMonitorConfiguration monitorConfiguration,
      String clusterName)
      throws SchedulerException {
    this.meterRegistry =
        (PrometheusMeterRegistry)
            Metrics.globalRegistry.getRegistries().stream()
                .filter(registry -> registry instanceof PrometheusMeterRegistry)
                .findFirst()
                .orElseThrow(
                    () ->
                        new IllegalStateException(
                            "No PrometheusMeterRegistry found in global registry"));
    this.clusterName = clusterName;
    this.servicesHealthCheckInterval = monitorConfiguration.getServicesHealthCheckInterval();
    this.scheduler.start();
  }

  public static ServicesStatusJobHandler create(
      EventMonitorConfiguration eventMonitorConfiguration,
      String clusterName) {
    if (instance != null) return instance;

    try {
      instance = new ServicesStatusJobHandler(eventMonitorConfiguration, clusterName);
    } catch (Exception ex) {
      throw new RuntimeException("Failed to initialize the Pipeline Service Status Handler", ex);
    }
    return instance;
  }

  private JobDetail jobBuilder(Class<? extends Job> clazz, String jobName, String group) {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(JOB_CONTEXT_METER_REGISTRY, meterRegistry);
    dataMap.put(JOB_CONTEXT_CLUSTER_NAME, clusterName);

    JobBuilder jobBuilder =
        JobBuilder.newJob(clazz).withIdentity(jobName, group).usingJobData(dataMap);

    return jobBuilder.build();
  }

  private Trigger getTrigger(int checkInterval, String identity, String group) {
    return TriggerBuilder.newTrigger()
        .withIdentity(identity, group)
        .withSchedule(
            SimpleScheduleBuilder.simpleSchedule()
                .withIntervalInSeconds(checkInterval)
                .repeatForever())
        .build();
  }


  public void addDatabaseAndSearchStatusJobs() {
    try {
      JobDetail jobDetail =
          jobBuilder(
              DatabseAndSearchServiceStatusJob.class, DATABASE_SEARCH_STATUS_JOB, STATUS_GROUP);
      Trigger trigger =
          getTrigger(
              servicesHealthCheckInterval, DATABASE_SEARCH_STATUS_CRON_TRIGGER, STATUS_GROUP);
      scheduler.scheduleJob(jobDetail, trigger);
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Pipeline Service Status", ex);
    }
  }
}
