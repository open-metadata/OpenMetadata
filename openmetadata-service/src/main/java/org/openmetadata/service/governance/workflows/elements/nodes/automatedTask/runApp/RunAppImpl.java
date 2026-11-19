package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.ModuleConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.ServiceFilter;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppTriggerRetry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class RunAppImpl {
  private static final String DATA_INSIGHTS_APPLICATION = "DataInsightsApplication";

  /** Pause between status reads while waiting for a run; each read is a database query. */
  static final long POLL_INTERVAL_MILLIS = 5_000;

  private final long pollIntervalMillis;

  public RunAppImpl() {
    this(POLL_INTERVAL_MILLIS);
  }

  RunAppImpl(long pollIntervalMillis) {
    this.pollIntervalMillis = pollIntervalMillis;
  }

  public boolean execute(
      PipelineServiceClientInterface pipelineServiceClient,
      String appName,
      boolean waitForCompletion,
      long timeoutSeconds,
      MessageParser.EntityLink entityLink) {
    boolean wasSuccessful = true;
    ServiceEntityInterface service = Entity.getEntity(entityLink, "owners", Include.NON_DELETED);

    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App app;
    try {
      app =
          appRepository.getByName(null, appName, new EntityUtil.Fields(Set.of("bot", "pipelines")));
    } catch (EntityNotFoundException ex) {
      LOG.warn("App: '{}' is not Installed. Skipping", appName);
      return wasSuccessful;
    }

    if (!validateAppShouldRun(app)) {
      return wasSuccessful;
    }

    long startTime = System.currentTimeMillis();
    long timeoutMillis = timeoutSeconds * 1000;

    Map<String, Object> config = getConfig(app, service);

    LOG.info(
        "[GovernanceWorkflows] '{}' running for '{}'", app.getDisplayName(), service.getName());
    if (app.getAppType().equals(AppType.Internal)) {
      wasSuccessful =
          runApp(appRepository, app, config, waitForCompletion, startTime, timeoutMillis);
    } else {
      App updatedApp = JsonUtils.deepCopy(app, App.class);
      updatedApp.setAppConfiguration(config);
      wasSuccessful =
          runApp(pipelineServiceClient, updatedApp, waitForCompletion, startTime, timeoutMillis);
      deployIngestionPipeline(app);
    }

    if (!wasSuccessful) {
      LOG.warn(
          "[GovernanceWorkflows] '{}' failed for '{}'", app.getDisplayName(), service.getName());
    }
    return wasSuccessful;
  }

  private boolean validateAppShouldRun(App app) {
    return DATA_INSIGHTS_APPLICATION.equals(app.getName());
  }

  private Map<String, Object> getConfig(App app, ServiceEntityInterface service) {
    Object config = JsonUtils.deepCopy(app.getAppConfiguration(), Object.class);

    switch (app.getName()) {
      case DATA_INSIGHTS_APPLICATION -> {
        DataInsightsAppConfig updatedAppConfig =
            (JsonUtils.convertValue(config, DataInsightsAppConfig.class));
        ModuleConfiguration updatedModuleConfig =
            updatedAppConfig
                .getModuleConfiguration()
                .withAppAnalytics(new AppAnalyticsConfig().withEnabled(false))
                .withCostAnalysis(new CostAnalysisConfig().withEnabled(false))
                .withDataAssets(
                    new DataAssetsConfig()
                        .withRetention(
                            updatedAppConfig
                                .getModuleConfiguration()
                                .getDataAssets()
                                .getRetention())
                        .withServiceFilter(
                            new ServiceFilter()
                                .withServiceName(service.getName())
                                .withServiceType(Entity.getEntityTypeFromObject(service))));

        config =
            updatedAppConfig
                .withBackfillConfiguration(new BackfillConfiguration().withEnabled(false))
                .withRecreateDataAssetsIndex(false)
                .withModuleConfiguration(updatedModuleConfig);
      }
    }
    return JsonUtils.getMap(config);
  }

  // Internal App Logic
  private boolean runApp(
      AppRepository repository,
      App app,
      Map<String, Object> config,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    boolean triggered =
        AppTriggerRetry.trigger(
            app.getName(),
            () ->
                ApplicationHandler.getInstance()
                    .triggerApplicationOnDemand(
                        app,
                        Entity.getCollectionDAO(),
                        Entity.getSearchRepository(),
                        config,
                        WorkflowEventConsumer.GOVERNANCE_BOT));
    return triggered
        && (!waitForCompletion || waitForCompletion(repository, app, startTime, timeoutMillis));
  }

  boolean waitForCompletion(AppRepository repository, App app, long startTime, long timeoutMillis) {
    AppRunRecord appRunRecord = readLatestAppRun(repository, app, startTime);
    while (!isRunCompleted(appRunRecord) && pauseBeforeNextPoll(startTime, timeoutMillis)) {
      appRunRecord = readLatestAppRun(repository, app, startTime);
    }
    return isRunCompleted(appRunRecord)
        && (appRunRecord.getStatus() == AppRunRecord.Status.SUCCESS
            || appRunRecord.getStatus() == AppRunRecord.Status.COMPLETED);
  }

  // A read that fails is retried at the next poll, as a run that has not recorded a status yet.
  private AppRunRecord readLatestAppRun(AppRepository repository, App app, long startTime) {
    AppRunRecord appRunRecord = null;
    try {
      appRunRecord = repository.getLatestAppRunsAfterStartTime(app, startTime);
    } catch (RuntimeException e) {
      LOG.debug("Could not read the latest run of app '{}': {}", app.getName(), e.getMessage());
    }
    return appRunRecord;
  }

  /**
   * Sleeps until the next status read. Returns false once the timeout has passed or the thread is
   * interrupted, so the caller stops waiting.
   */
  private boolean pauseBeforeNextPoll(long startTime, long timeoutMillis) {
    long remainingMillis = startTime + timeoutMillis - System.currentTimeMillis();
    boolean keepPolling = remainingMillis > 0;
    if (keepPolling) {
      try {
        Thread.sleep(Math.min(pollIntervalMillis, remainingMillis));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        keepPolling = false;
      }
    }
    return keepPolling;
  }

  private boolean isRunCompleted(AppRunRecord appRunRecord) {
    if (appRunRecord == null) {
      return false;
    }
    return !nullOrEmpty(appRunRecord.getExecutionTime());
  }

  private IngestionPipeline deployIngestionPipeline(App app) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    EntityReference pipelineRef = app.getPipelines().get(0);

    OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();

    IngestionPipeline ingestionPipeline = repository.get(null, pipelineRef.getId(), EMPTY_FIELDS);
    ingestionPipeline.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config).build());

    Map<String, Object> ingestionPipelineConfig =
        JsonUtils.readOrConvertValue(ingestionPipeline.getSourceConfig().getConfig(), Map.class);
    ingestionPipelineConfig.put("appConfig", app.getAppConfiguration());
    ingestionPipeline.getSourceConfig().setConfig(ingestionPipelineConfig);

    PipelineServiceClientResponse status =
        repository.deployIngestionPipeline(
            ingestionPipeline,
            Entity.getEntity(
                ingestionPipeline.getService(), "ingestionRunner", Include.NON_DELETED));
    if (status.getCode() == 200) {
      // Persist only the runner-derived flag; the deploy-time appConfig injected above
      // must not leak into the stored pipeline, so re-read the clean entity first.
      IngestionPipeline stored = repository.get(null, pipelineRef.getId(), EMPTY_FIELDS);
      stored.setEnableStreamableLogs(ingestionPipeline.getEnableStreamableLogs());
      repository.createOrUpdate(null, stored, stored.getUpdatedBy());
    }

    return ingestionPipeline;
  }

  private boolean runIngestionPipeline(
      PipelineServiceClientInterface pipelineServiceClient,
      IngestionPipeline ingestionPipeline,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    pipelineServiceClient.runPipeline(
        ingestionPipeline,
        Entity.getEntity(ingestionPipeline.getService(), "ingestionRunner", Include.NON_DELETED));

    if (waitForCompletion) {
      return waitForCompletion(repository, ingestionPipeline, startTime, timeoutMillis);
    } else {
      return true;
    }
  }

  // External App Logic
  private boolean runApp(
      PipelineServiceClientInterface pipelineServiceClient,
      App app,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    IngestionPipeline ingestionPipeline = deployIngestionPipeline(app);
    return runIngestionPipeline(
        pipelineServiceClient, ingestionPipeline, waitForCompletion, startTime, timeoutMillis);
  }

  boolean waitForCompletion(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      long startTime,
      long timeoutMillis) {
    PipelineStatusType state =
        readLatestPipelineState(repository, ingestionPipeline, startTime, timeoutMillis);
    while (!isPipelineRunFinished(state) && pauseBeforeNextPoll(startTime, timeoutMillis)) {
      state = readLatestPipelineState(repository, ingestionPipeline, startTime, timeoutMillis);
    }
    return state == PipelineStatusType.SUCCESS || state == PipelineStatusType.PARTIAL_SUCCESS;
  }

  private PipelineStatusType readLatestPipelineState(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      long startTime,
      long timeoutMillis) {
    List<PipelineStatus> statuses =
        repository
            .listPipelineStatus(
                ingestionPipeline.getFullyQualifiedName(), startTime, startTime + timeoutMillis)
            .getData();
    return statuses.isEmpty() ? null : statuses.get(statuses.size() - 1).getPipelineState();
  }

  private static boolean isPipelineRunFinished(PipelineStatusType state) {
    return state == PipelineStatusType.FAILED
        || state == PipelineStatusType.SUCCESS
        || state == PipelineStatusType.PARTIAL_SUCCESS;
  }
}
