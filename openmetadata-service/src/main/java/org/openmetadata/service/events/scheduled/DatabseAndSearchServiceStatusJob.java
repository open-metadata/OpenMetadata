package org.openmetadata.service.events.scheduled;

import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.HEALTHY_STATUS;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.JOB_CONTEXT_METER_REGISTRY;

import io.micrometer.core.instrument.Counter;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexMetrics;
import org.openmetadata.service.search.SearchHealthStatus;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
@DisallowConcurrentExecution
public class DatabseAndSearchServiceStatusJob implements Job {
  private static final String SERVICE_COUNTER = "omd_service_unreachable";
  private static final String SERVICE_NAME = "service_name";
  private static final String SEARCH_SERVICE_NAME = "search";
  private static final String DATABASE_SERVICE_NAME = "database";

  private static final AtomicReference<SearchIndexMetrics> searchIndexMetrics =
      new AtomicReference<>();

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    PrometheusMeterRegistry meterRegistry =
        (PrometheusMeterRegistry)
            jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_METER_REGISTRY);
    checkDatabaseStatus(meterRegistry);
    if (checkElasticSearchStatus(meterRegistry)) {
      refreshSearchIndexMetrics(meterRegistry);
    } else {
      LOG.debug("Skipping search index metrics refresh because search is unhealthy");
    }
  }

  private boolean checkElasticSearchStatus(PrometheusMeterRegistry meterRegistry) {
    try {
      SearchHealthStatus status =
          Entity.getSearchRepository().getSearchClient().getSearchHealthStatus();
      if (status == null || !HEALTHY_STATUS.equals(status.getStatus())) {
        publishUnhealthyCounter(meterRegistry, SERVICE_NAME, SEARCH_SERVICE_NAME);
        return false;
      }
      return true;
    } catch (Exception ex) {
      LOG.error("Elastic Search Health Check encountered issues", ex);
      publishUnhealthyCounter(meterRegistry, SERVICE_NAME, SEARCH_SERVICE_NAME);
      return false;
    }
  }

  private void checkDatabaseStatus(PrometheusMeterRegistry meterRegistry) {
    try {
      Entity.getCollectionDAO().systemDAO().testConnection();
    } catch (Exception ex) {
      LOG.error("Database Health Check encountered issues", ex);
      publishUnhealthyCounter(meterRegistry, SERVICE_NAME, DATABASE_SERVICE_NAME);
    }
  }

  private void publishUnhealthyCounter(PrometheusMeterRegistry meterRegistry, String... tags) {
    Counter.builder(SERVICE_COUNTER).tags(tags).register(meterRegistry).increment();
  }

  private void refreshSearchIndexMetrics(PrometheusMeterRegistry meterRegistry) {
    try {
      SearchRepository searchRepository = Entity.getSearchRepository();
      if (searchRepository == null) {
        return;
      }

      SearchIndexMetrics metrics = searchIndexMetrics.get();
      if (metrics == null) {
        metrics = new SearchIndexMetrics(meterRegistry, searchRepository);
        if (searchIndexMetrics.compareAndSet(null, metrics)) {
          metrics.registerMetrics();
          LOG.info("SearchIndexMetrics initialized and registered");
        } else {
          metrics = searchIndexMetrics.get();
        }
      }

      metrics.refreshStats();
    } catch (Exception e) {
      LOG.debug("Failed to refresh search index metrics: {}", e.getMessage());
    }
  }
}
