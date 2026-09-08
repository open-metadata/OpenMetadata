package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.JOB_CONTEXT_METER_REGISTRY;

import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class DatabseAndSearchServiceStatusJobTest {

  @Test
  void preventsConcurrentExecutions() {
    assertTrue(
        DatabseAndSearchServiceStatusJob.class.isAnnotationPresent(
            DisallowConcurrentExecution.class));
  }

  @Test
  void skipsIndexMetricsWhenSearchHealthCheckFails() throws IOException {
    PrometheusMeterRegistry meterRegistry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    JobDataMap jobDataMap = new JobDataMap();
    jobDataMap.put(JOB_CONTEXT_METER_REGISTRY, meterRegistry);

    JobDetail jobDetail = mock(JobDetail.class);
    when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(jobDetail);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(mock(CollectionDAO.SystemDAO.class));
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.getSearchHealthStatus()).thenThrow(new IOException("pool exhausted"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);

      new DatabseAndSearchServiceStatusJob().execute(context);
    }

    verify(searchClient, never()).getAllIndexStats();
    verify(searchRepository, never()).getEntityIndexMap();
    assertEquals(
        1.0,
        meterRegistry
            .get("omd_service_unreachable")
            .tag("service_name", "search")
            .counter()
            .count());
  }
}
