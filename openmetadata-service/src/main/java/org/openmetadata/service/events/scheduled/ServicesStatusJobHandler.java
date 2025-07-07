package org.openmetadata.service.events.scheduled;

import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;
import org.openmetadata.service.util.MicrometerBundleSingleton;
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
  public static final String PIPELINE_SERVICE_STATUS_JOB = "pipelineServiceStatusJob";
  public static final String STATUS_GROUP = "status";
  public static final String PIPELINE_STATUS_CRON_TRIGGER = "pipelineStatusTrigger";
  public static final String DATABASE_SEARCH_STATUS_CRON_TRIGGER = "databaseAndSearchStatusTrigger";
  public static final String JOB_CONTEXT_PIPELINE_SERVICE_CLIENT = "pipelineServiceClient";
  public static final String JOB_CONTEXT_METER_REGISTRY = "meterRegistry";
  public static final String JOB_CONTEXT_CLUSTER_NAME = "clusterName";

  private final PipelineServiceClientConfiguration config;
  private final PipelineServiceClientInterface pipelineServiceClient;
  private final PrometheusMeterRegistry meterRegistry;
  private final String clusterName;
  private final Integer healthCheckInterval;
  private final Scheduler scheduler = new StdSchedulerFactory().getScheduler();
  private final int servicesHealthCheckInterval;
  private static ServicesStatusJobHandler instance;

  private ServicesStatusJobHandler(
      EventMonitorConfiguration monitorConfiguration,
      PipelineServiceClientConfiguration config,
      String clusterName)
      throws SchedulerException {
    this.config = config;
    this.pipelineServiceClient = PipelineServiceClientFactory.createPipelineServiceClient(config);
    this.meterRegistry = MicrometerBundleSingleton.prometheusMeterRegistry;
    this.clusterName = clusterName;
    this.healthCheckInterval = config.getHealthCheckInterval();
    this.servicesHealthCheckInterval = monitorConfiguration.getServicesHealthCheckInterval();
    this.scheduler.start();
  }

  public static ServicesStatusJobHandler create(
      EventMonitorConfiguration eventMonitorConfiguration,
      PipelineServiceClientConfiguration config,
      String clusterName) {
    if (instance != null) return instance;

    try {
      instance = new ServicesStatusJobHandler(eventMonitorConfiguration, config, clusterName);
    } catch (Exception ex) {
      throw new RuntimeException("Failed to initialize the Pipeline Service Status Handler", ex);
    }
    return instance;
  }

  private JobDetail jobBuilder(Class<? extends Job> clazz, String jobName, String group) {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(JOB_CONTEXT_PIPELINE_SERVICE_CLIENT, pipelineServiceClient);
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

  public void addPipelineServiceStatusJob() {
    // Only register the job to listen to the status if the Pipeline Service Client is indeed
    // enabled
    if (config.getEnabled().equals(Boolean.TRUE)) {
      try {
        JobDetail jobDetail =
            jobBuilder(PipelineServiceStatusJob.class, PIPELINE_SERVICE_STATUS_JOB, STATUS_GROUP);
        Trigger trigger =
            getTrigger(healthCheckInterval, PIPELINE_STATUS_CRON_TRIGGER, STATUS_GROUP);
        scheduler.scheduleJob(jobDetail, trigger);
      } catch (Exception ex) {
        LOG.error("Failed in setting up job Scheduler for Pipeline Service Status", ex);
      }
    }
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
