package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.external.CollateAIAppConfig;
import org.openmetadata.schema.entity.app.internal.CollateAIQualityAgentAppConfig;
import org.openmetadata.schema.entity.app.internal.CollateAITierAgentAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataQualityConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.ModuleConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.ServiceFilter;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class RunAppImpl {
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
      LOG.warn(String.format("App: '%s' is not Installed. Skipping", appName));
      return wasSuccessful;
    }

    if (!validateAppShouldRun(app, service)) {
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
      deployIngestionPipeline(pipelineServiceClient, app);
    }

    if (!wasSuccessful) {
      LOG.warn(
          "[GovernanceWorkflows] '{}' failed for '{}'", app.getDisplayName(), service.getName());
    }
    return wasSuccessful;
  }

  private boolean validateAppShouldRun(App app, ServiceEntityInterface service) {
    // We only want to run the CollateAIApplication and CollateAIQualityAgentApplication for
    // Databases
    if (Entity.getEntityTypeFromObject(service).equals(Entity.DATABASE_SERVICE)
        && List.of("CollateAIApplication", "CollateAIQualityAgentApplication")
            .contains(app.getName())) {
      return true;
    } else
      return List.of("DataInsightsApplication", "CollateAITierAgentApplication")
          .contains(app.getName());
  }

  private String getTableServiceFilter(String serviceName) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"table\"}},{\"term\":{\"service.displayName.keyword\":\"%s\"}}]}}]}}}",
        serviceName);
  }

  private Map<String, Object> getConfig(App app, ServiceEntityInterface service) {
    Object config = JsonUtils.deepCopy(app.getAppConfiguration(), Object.class);

    switch (app.getName()) {
      case "CollateAIApplication" -> config =
          (JsonUtils.convertValue(config, CollateAIAppConfig.class))
              .withFilter(getTableServiceFilter(service.getName()))
              .withPatchIfEmpty(true);
      case "CollateAIQualityAgentApplication" -> config =
          (JsonUtils.convertValue(config, CollateAIQualityAgentAppConfig.class))
              .withFilter(getTableServiceFilter(service.getName()));
      case "CollateAITierAgentApplication" -> config =
          (JsonUtils.convertValue(config, CollateAITierAgentAppConfig.class))
              .withFilter(getTableServiceFilter(service.getName()))
              .withPatchIfEmpty(true);
      case "DataInsightsApplication" -> {
        DataInsightsAppConfig updatedAppConfig =
            (JsonUtils.convertValue(config, DataInsightsAppConfig.class));
        ModuleConfiguration updatedModuleConfig =
            updatedAppConfig
                .getModuleConfiguration()
                .withAppAnalytics(new AppAnalyticsConfig().withEnabled(false))
                .withCostAnalysis(new CostAnalysisConfig().withEnabled(false))
                .withDataQuality(new DataQualityConfig().withEnabled(false))
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
  @SneakyThrows
  private boolean runApp(
      AppRepository repository,
      App app,
      Map<String, Object> config,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    int maxRetries = 5;
    int attempt = 0;
    long initialBackoffMillis = 10000; // 10 second
    long maxBackoffMillis = 60000; // 60 seconds

    while (attempt < maxRetries) {
      try {
        ApplicationHandler.getInstance()
            .triggerApplicationOnDemand(
                app, Entity.getCollectionDAO(), Entity.getSearchRepository(), config);
        break;
      } catch (UnhandledServerException e) {
        if (e.getMessage().contains("Job is already running")) {
          attempt++;
          if (attempt >= maxRetries) {
            LOG.error("Failed to run app after {} retries: {}", maxRetries, e.getMessage());
            return false;
          }

          long backoffMillis =
              Math.min(initialBackoffMillis * (long) Math.pow(2, attempt - 1), maxBackoffMillis);
          LOG.warn(
              "App is already running. Retrying in {} ms (attempt {}/{})",
              backoffMillis,
              attempt,
              maxRetries);

          try {
            Thread.sleep(backoffMillis);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Retry interrupted", ie);
          }
        } else {
          throw e;
        }
      }
    }

    if (waitForCompletion) {
      return waitForCompletion(repository, app, startTime, timeoutMillis);
    } else {
      return true;
    }
  }

  private boolean waitForCompletion(
      AppRepository repository, App app, long startTime, long timeoutMillis) {
    AppRunRecord appRunRecord = null;

    do {
      try {
        if (System.currentTimeMillis() - startTime > timeoutMillis) {
          return false;
        }
        appRunRecord = repository.getLatestAppRunsAfterStartTime(app, startTime);
      } catch (Exception ignore) {
      }
    } while (!isRunCompleted(appRunRecord));

    return appRunRecord.getStatus().equals(AppRunRecord.Status.SUCCESS)
        || appRunRecord.getStatus().equals(AppRunRecord.Status.COMPLETED);
  }

  private boolean isRunCompleted(AppRunRecord appRunRecord) {
    if (appRunRecord == null) {
      return false;
    }
    return !nullOrEmpty(appRunRecord.getExecutionTime());
  }

  private IngestionPipeline deployIngestionPipeline(
      PipelineServiceClientInterface pipelineServiceClient, App app) {
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

    pipelineServiceClient.deployPipeline(
        ingestionPipeline,
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED));

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
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED));

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
    IngestionPipeline ingestionPipeline = deployIngestionPipeline(pipelineServiceClient, app);
    return runIngestionPipeline(
        pipelineServiceClient, ingestionPipeline, waitForCompletion, startTime, timeoutMillis);
  }

  private boolean waitForCompletion(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      long startTime,
      long timeoutMillis) {
    while (true) {
      if (System.currentTimeMillis() - startTime > timeoutMillis) {
        return false;
      }

      List<PipelineStatus> statuses =
          repository
              .listPipelineStatus(
                  ingestionPipeline.getFullyQualifiedName(), startTime, startTime + timeoutMillis)
              .getData();

      if (statuses.isEmpty()) {
        continue;
      }

      PipelineStatus status = statuses.get(statuses.size() - 1);

      if (status.getPipelineState().equals(PipelineStatusType.FAILED)) {
        return false;
      } else if (status.getPipelineState().equals(PipelineStatusType.SUCCESS)
          || status.getPipelineState().equals(PipelineStatusType.PARTIAL_SUCCESS)) {
        return true;
      }
    }
  }
}
