package org.openmetadata.service.events.scheduled;

import io.micrometer.prometheus.PrometheusMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.util.MicrometerBundleSingleton;
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
public class PipelineServiceStatusJobHandler {

  public static final String PIPELINE_SERVICE_STATUS_JOB = "pipelineServiceStatusJob";
  public static final String STATUS_GROUP = "status";
  public static final String STATUS_CRON_TRIGGER = "statusTrigger";
  public static final String JOB_CONTEXT_PIPELINE_SERVICE_CLIENT = "pipelineServiceClient";
  public static final String JOB_CONTEXT_METER_REGISTRY = "meterRegistry";
  public static final String JOB_CONTEXT_CLUSTER_NAME = "clusterName";

  private final PipelineServiceClient pipelineServiceClient;
  private final PrometheusMeterRegistry meterRegistry;
  private final String clusterName;
  private final Integer healthCheckInterval;
  private final Scheduler scheduler = new StdSchedulerFactory().getScheduler();

  private static PipelineServiceStatusJobHandler INSTANCE;

  private PipelineServiceStatusJobHandler(PipelineServiceClientConfiguration config, String clusterName)
      throws SchedulerException {
    this.pipelineServiceClient = PipelineServiceClientFactory.createPipelineServiceClient(config);
    this.meterRegistry = MicrometerBundleSingleton.prometheusMeterRegistry;
    this.clusterName = clusterName;
    this.healthCheckInterval = config.getHealthCheckInterval();
    this.scheduler.start();
  }

  public static PipelineServiceStatusJobHandler create(PipelineServiceClientConfiguration config, String clusterName) {
    if (INSTANCE != null) return INSTANCE;

    try {
      INSTANCE = new PipelineServiceStatusJobHandler(config, clusterName);
    } catch (Exception ex) {
      LOG.error("Failed to initialize the Pipeline Service Status Handler");
    }

    return INSTANCE;
  }

  private JobDetail jobBuilder() {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(JOB_CONTEXT_PIPELINE_SERVICE_CLIENT, pipelineServiceClient);
    dataMap.put(JOB_CONTEXT_METER_REGISTRY, meterRegistry);
    dataMap.put(JOB_CONTEXT_CLUSTER_NAME, clusterName);

    JobBuilder jobBuilder =
        JobBuilder.newJob(PipelineServiceStatusJob.class)
            .withIdentity(PIPELINE_SERVICE_STATUS_JOB, STATUS_GROUP)
            .usingJobData(dataMap);

    return jobBuilder.build();
  }

  private Trigger getTrigger() {
    return TriggerBuilder.newTrigger()
        .withIdentity(STATUS_CRON_TRIGGER, STATUS_GROUP)
        .withSchedule(SimpleScheduleBuilder.simpleSchedule().withIntervalInSeconds(healthCheckInterval).repeatForever())
        .build();
  }

  public void addPipelineServiceStatusJob() {
    try {
      JobDetail jobDetail = jobBuilder();
      Trigger trigger = getTrigger();
      scheduler.scheduleJob(jobDetail, trigger);
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Pipeline Service Status", ex);
    }
  }
}
