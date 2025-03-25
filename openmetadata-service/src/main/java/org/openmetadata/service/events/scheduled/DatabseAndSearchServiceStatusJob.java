package org.openmetadata.service.events.scheduled;

import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.JOB_CONTEXT_METER_REGISTRY;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.UNHEALTHY_STATUS;

import io.micrometer.core.instrument.Counter;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchHealthStatus;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
public class DatabseAndSearchServiceStatusJob implements Job {
  private static final String SERVICE_COUNTER = "omd_service_unreachable";
  private static final String SERVICE_NAME = "service_name";
  private static final String SEARCH_SERVICE_NAME = "search";
  private static final String DATABASE_SERVICE_NAME = "database";

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    PrometheusMeterRegistry meterRegistry =
        (PrometheusMeterRegistry)
            jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_METER_REGISTRY);
    checkDatabaseStatus(meterRegistry);
    checkElasticSearchStatus(meterRegistry);
  }

  private void checkElasticSearchStatus(PrometheusMeterRegistry meterRegistry) {
    try {
      SearchHealthStatus status =
          Entity.getSearchRepository().getSearchClient().getSearchHealthStatus();
      if (status.getStatus().equals(UNHEALTHY_STATUS)) {
        publishUnhealthyCounter(meterRegistry, SERVICE_NAME, SEARCH_SERVICE_NAME);
      }
    } catch (Exception ex) {
      LOG.error("Elastic Search Health Check encountered issues: {}", ex.getMessage());
      publishUnhealthyCounter(meterRegistry, SERVICE_NAME, SEARCH_SERVICE_NAME);
    }
  }

  private void checkDatabaseStatus(PrometheusMeterRegistry meterRegistry) {
    try {
      Entity.getCollectionDAO().systemDAO().testConnection();
    } catch (Exception ex) {
      LOG.error("Database Health Check encountered issues: {}", ex.getMessage());
      publishUnhealthyCounter(meterRegistry, SERVICE_NAME, DATABASE_SERVICE_NAME);
    }
  }

  private void publishUnhealthyCounter(PrometheusMeterRegistry meterRegistry, String... tags) {
    Counter.builder(SERVICE_COUNTER).tags(tags).register(meterRegistry).increment();
  }
}
