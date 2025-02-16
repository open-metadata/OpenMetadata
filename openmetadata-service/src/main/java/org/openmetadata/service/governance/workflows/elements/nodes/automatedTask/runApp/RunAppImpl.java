package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.List;
import java.util.Set;
import javax.json.JsonPatch;
import lombok.SneakyThrows;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.external.CollateAIAppConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

public class RunAppImpl {
  public boolean execute(
      PipelineServiceClientInterface pipelineServiceClient,
      String appName,
      boolean waitForCompletion,
      long timeoutSeconds,
      MessageParser.EntityLink entityLink) {
    ServiceEntityInterface service = Entity.getEntity(entityLink, "owners", Include.NON_DELETED);

    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App app =
        appRepository.getByName(null, appName, new EntityUtil.Fields(Set.of("bot", "pipelines")));
    App updatedApp = getUpdatedApp(app, service);

    updateApp(appRepository, app, updatedApp);

    long startTime = System.currentTimeMillis();
    long timeoutMillis = timeoutSeconds * 1000;
    boolean success = true;

    if (app.getAppType().equals(AppType.Internal)) {
      success = runApp(appRepository, app, waitForCompletion, startTime, timeoutMillis);
    } else {
      success = runApp(pipelineServiceClient, app, waitForCompletion, startTime, timeoutMillis);
    }

    updateApp(appRepository, updatedApp, app);
    return success;
  }

  private App getUpdatedApp(App app, ServiceEntityInterface service) {
    App updatedApp = JsonUtils.deepCopy(app, App.class);
    Object updatedConfig = JsonUtils.deepCopy(app.getAppConfiguration(), Object.class);

    if (app.getName().equals("CollateAIApplication")) {
      //            ((CollateAIAppConfig)
      // updatedConfig).withFilter(String.format("{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}]}},{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"table\"}}]}},{\"bool\":{\"must\":[{\"term\":{\"service.name.keyword\":\"%s\"}}]}}]}}}", service.getName().toLowerCase()));
      ((CollateAIAppConfig) updatedConfig)
          .withFilter(
              String.format(
                  "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"name.keyword\":\"table_entity\"}}]}},{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"table\"}}]}},{\"bool\":{\"must\":[{\"term\":{\"service.name.keyword\":\"%s\"}}]}}]}}}",
                  service.getName().toLowerCase()));
    }

    updatedApp.withAppConfiguration(updatedConfig);
    return updatedApp;
  }

  private void updateApp(AppRepository repository, App originalApp, App updatedApp) {
    JsonPatch patch = JsonUtils.getJsonPatch(originalApp, updatedApp);
    repository.patch(null, originalApp.getId(), "admin", patch);
  }

  // Internal App Logic
  @SneakyThrows
  private boolean runApp(
      AppRepository repository,
      App app,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    ApplicationHandler.getInstance()
        .triggerApplicationOnDemand(app, Entity.getCollectionDAO(), Entity.getSearchRepository());

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

  // External App Logic
  private boolean runApp(
      PipelineServiceClientInterface pipelineServiceClient,
      App app,
      boolean waitForCompletion,
      long startTime,
      long timeoutMillis) {
    EntityReference pipelineRef = app.getPipelines().get(0);

    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();

    IngestionPipeline ingestionPipeline = repository.get(null, pipelineRef.getId(), EMPTY_FIELDS);
    ingestionPipeline.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config).build());

    ServiceEntityInterface service =
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);

    pipelineServiceClient.deployPipeline(ingestionPipeline, service);
    pipelineServiceClient.runPipeline(ingestionPipeline, service);

    if (waitForCompletion) {
      return waitForCompletion(repository, ingestionPipeline, startTime, timeoutMillis);
    } else {
      return true;
    }
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
      return !status.getPipelineState().equals(PipelineStatusType.FAILED);
    }
  }
}
