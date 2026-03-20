package org.openmetadata.service.apps.bundles.searchIndex;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReindexingOrchestratorTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private OrchestratorContext context;
  @Mock private SearchClient searchClient;

  private ReindexingOrchestrator orchestrator;

  @BeforeEach
  void setUp() {
    orchestrator = new ReindexingOrchestrator(collectionDAO, searchRepository, context);
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);

    AppRunRecord appRunRecord = new AppRunRecord();
    appRunRecord.setStartTime(System.currentTimeMillis());
    appRunRecord.setStatus(AppRunRecord.Status.RUNNING);
    appRunRecord.setAppId(UUID.randomUUID());
    when(context.getJobRecord()).thenReturn(appRunRecord);

    when(context.getAppConfigJson()).thenReturn(null);
    when(context.getAppConfiguration())
        .thenReturn(Map.of("entities", Set.of("table"), "batchSize", 10, "recreateIndex", false));
    when(context.getJobName()).thenReturn("test-job");

    CollectionDAO.AppExtensionTimeSeries timeSeriesDAO =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(timeSeriesDAO);
  }

  @Test
  void testPreflightCallsEnsureHybridSearchPipeline() {
    EventPublisherJob jobData =
        new EventPublisherJob().withEntities(Set.of()).withBatchSize(10).withRecreateIndex(false);

    orchestrator.run(jobData);

    verify(searchRepository).ensureHybridSearchPipeline();
  }

  @Test
  void testPreflightContinuesWhenPipelineSetupFails() {
    doThrow(new RuntimeException("Pipeline creation failed"))
        .when(searchRepository)
        .ensureHybridSearchPipeline();

    EventPublisherJob jobData =
        new EventPublisherJob().withEntities(Set.of()).withBatchSize(10).withRecreateIndex(false);

    orchestrator.run(jobData);

    verify(searchRepository).ensureHybridSearchPipeline();
    verify(searchRepository).createOrUpdateIndexTemplates();
  }
}
