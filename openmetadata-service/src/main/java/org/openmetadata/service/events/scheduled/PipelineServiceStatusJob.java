package org.openmetadata.service.events.scheduled;

import static org.openmetadata.service.events.scheduled.PipelineServiceStatusJobHandler.JOB_CONTEXT_CLUSTER_NAME;
import static org.openmetadata.service.events.scheduled.PipelineServiceStatusJobHandler.JOB_CONTEXT_METER_REGISTRY;
import static org.openmetadata.service.events.scheduled.PipelineServiceStatusJobHandler.JOB_CONTEXT_PIPELINE_SERVICE_CLIENT;

import io.micrometer.core.instrument.Counter;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import java.util.Map;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.sdk.PipelineServiceClient;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
public class PipelineServiceStatusJob implements Job {

  private static final String HEALTHY_STATUS = "healthy";
  private static final String STATUS_KEY = "status";
  private static final String COUNTER_NAME = "pipelineServiceClientStatus.counter";
  private static final String UNHEALTHY_TAG_NAME = "unhealthy";
  private static final String CLUSTER_TAG_NAME = "clusterName";

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {

    PipelineServiceClient pipelineServiceClient =
        (PipelineServiceClient)
            jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_PIPELINE_SERVICE_CLIENT);
    PrometheusMeterRegistry meterRegistry =
        (PrometheusMeterRegistry) jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_METER_REGISTRY);
    String clusterName = (String) jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_CLUSTER_NAME);
    try {
      registerStatusMetric(pipelineServiceClient, meterRegistry, clusterName);
    } catch (Exception e) {
      LOG.error("[Pipeline Service Status Job] Failed in sending metric due to", e);
      publishUnhealthyCounter(meterRegistry, clusterName);
    }
  }

  private void registerStatusMetric(
      PipelineServiceClient pipelineServiceClient, PrometheusMeterRegistry meterRegistry, String clusterName) {
    Response response = pipelineServiceClient.getServiceStatus();
    Map<String, String> responseMap = (Map<String, String>) response.getEntity();
    if (responseMap.get(STATUS_KEY) == null || !HEALTHY_STATUS.equals(responseMap.get(STATUS_KEY))) {
      publishUnhealthyCounter(meterRegistry, clusterName);
    }
  }

  private void publishUnhealthyCounter(PrometheusMeterRegistry meterRegistry, String clusterName) {
    Counter.builder(COUNTER_NAME)
        .tags(STATUS_KEY, UNHEALTHY_TAG_NAME, CLUSTER_TAG_NAME, clusterName)
        .register(meterRegistry)
        .increment();
  }
}
