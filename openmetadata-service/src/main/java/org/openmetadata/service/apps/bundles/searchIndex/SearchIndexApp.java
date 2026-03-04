package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {

  public static class ReindexingException extends RuntimeException {
    public ReindexingException(String message) {
      super(message);
    }

    public ReindexingException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  @Getter private EventPublisherJob jobData;
  private volatile ReindexingOrchestrator orchestrator;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
  }

  @Override
  public void execute(JobExecutionContext ctx) {
    OrchestratorContext orchCtx =
        new QuartzOrchestratorContext(
            ctx, getApp(), this::getJobRecord, this::pushAppStatusUpdates);
    ReindexingOrchestrator orch =
        new ReindexingOrchestrator(collectionDAO, searchRepository, orchCtx);
    this.orchestrator = orch;
    orch.run(jobData);
    this.jobData = orch.getJobData();
  }

  @Override
  public void stop() {
    ReindexingOrchestrator orch = this.orchestrator;
    if (orch != null) {
      orch.stop();
      this.jobData = orch.getJobData();
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST, "Invalid App Configuration: " + e.getMessage());
    }
  }
}
