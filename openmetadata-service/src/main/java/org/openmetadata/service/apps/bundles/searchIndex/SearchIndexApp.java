package org.openmetadata.service.apps.bundles.searchIndex;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;

@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {
  private static final String REINDEX_LOCK_KEY = "SEARCH_REINDEX_LOCK";
  private static final List<String> ACTIVE_DISTRIBUTED_JOB_STATUSES =
      List.of(
          IndexJobStatus.RUNNING.name(),
          IndexJobStatus.READY.name(),
          IndexJobStatus.INITIALIZING.name());

  public static class ReindexingException extends RuntimeException {
    public ReindexingException(String message) {
      super(message);
    }

    public ReindexingException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  @Getter private EventPublisherJob jobData;
  private volatile ReindexingOrchestrator orchestrator;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    Map<String, Object> appConfig =
        SearchIndexAppConfigSanitizer.copyWithoutRemovedOptions(
            JsonUtils.getMap(app.getAppConfiguration()));
    jobData = JsonUtils.convertValue(appConfig, EventPublisherJob.class);
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
  public boolean tryStopOutsideQuartz() {
    List<String> runningJobIds = collectionDAO.searchIndexJobDAO().getRunningJobIds();
    if (runningJobIds.isEmpty()) {
      return false;
    }
    DistributedSearchIndexCoordinator coordinator =
        new DistributedSearchIndexCoordinator(collectionDAO);
    for (String jobIdStr : runningJobIds) {
      try {
        LOG.info("Stopping distributed job {} via coordinator fallback", jobIdStr);
        coordinator.requestStop(java.util.UUID.fromString(jobIdStr));
      } catch (Exception e) {
        LOG.warn("Failed to stop distributed job {}", jobIdStr, e);
      }
    }
    updateRunRecordToStopped();
    return true;
  }

  private void updateRunRecordToStopped() {
    try {
      App app = getApp();
      if (app == null) {
        return;
      }
      AppRepository appRepository = new AppRepository();
      appRepository
          .getLatestAppRunsOptional(app)
          .filter(run -> run.getStatus() == AppRunRecord.Status.RUNNING)
          .ifPresent(
              run -> {
                run.withStatus(AppRunRecord.Status.STOPPED);
                run.withEndTime(System.currentTimeMillis());
                SearchIndexAppConfigSanitizer.removeRemovedOptions(run.getConfig());
                appRepository.updateAppStatus(app.getId(), run);
                LOG.info("Updated app run record to STOPPED for {}", app.getName());
              });
    } catch (Exception e) {
      LOG.warn("Failed to update app run record to STOPPED", e);
    }
  }

  @Override
  public void uninstall() {
    stop();
    purgeSearchIndexTables();
    super.uninstall();
  }

  private void purgeSearchIndexTables() {
    List<CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord> activeJobs =
        collectionDAO.searchIndexJobDAO().findByStatuses(ACTIVE_DISTRIBUTED_JOB_STATUSES);
    if (!activeJobs.isEmpty()) {
      LOG.warn(
          "Uninstalling SearchIndexApp while {} distributed job(s) are still active. "
              + "Forcing all active jobs to STOPPED before purging state tables. "
              + "Other pods participating in these jobs will lose coordination.",
          activeJobs.size());
      for (CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord job : activeJobs) {
        try {
          collectionDAO
              .searchIndexJobDAO()
              .update(
                  job.id(),
                  IndexJobStatus.STOPPED.name(),
                  job.processedRecords(),
                  job.successRecords(),
                  job.failedRecords(),
                  job.stats(),
                  job.startedAt(),
                  System.currentTimeMillis(),
                  System.currentTimeMillis(),
                  "Job force-stopped by uninstall");
        } catch (Exception e) {
          LOG.error("Failed to force-stop job {} during uninstall", job.id(), e);
        }
      }
    }
    for (Runnable cleanup :
        List.<Runnable>of(
            () -> collectionDAO.searchIndexPartitionDAO().deleteAll(),
            () -> collectionDAO.searchIndexServerStatsDAO().deleteAll(),
            () -> collectionDAO.searchIndexFailureDAO().deleteAll(),
            () -> collectionDAO.searchReindexLockDAO().delete(REINDEX_LOCK_KEY),
            () -> collectionDAO.searchIndexJobDAO().deleteAll(),
            () -> {
              App app = getApp();
              if (app != null) {
                collectionDAO.appExtensionTimeSeriesDao().deleteAllByAppId(app.getId().toString());
              }
            })) {
      try {
        cleanup.run();
      } catch (Exception e) {
        LOG.error("Failed to purge search index table during uninstall", e);
      }
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(
          SearchIndexAppConfigSanitizer.copyWithoutRemovedOptions(appConfig),
          EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST, "Invalid App Configuration: " + e.getMessage());
    }
  }
}
