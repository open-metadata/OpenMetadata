/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.services.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.entity.app.ScheduleTimeline.HOURLY;
import static org.openmetadata.schema.entity.app.ScheduleTimeline.MONTHLY;
import static org.openmetadata.schema.entity.app.ScheduleTimeline.WEEKLY;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.jdbi3.EntityRepository.getEntitiesFromSeedData;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.quartz.SchedulerException;

@Slf4j
@Singleton
@Service(entityType = Entity.APPLICATION)
public class AppService extends EntityBaseService<App, AppRepository> {

  @Getter private final AppMapper mapper;
  public static final String FIELDS = "owners";
  public static final List<ScheduleType> SCHEDULED_TYPES =
      List.of(
          ScheduleType.Scheduled,
          ScheduleType.ScheduledOrManual,
          ScheduleType.NoSchedule,
          ScheduleType.OnlyManual);
  private static final Set<ScheduleTimeline> SCHEDULED_TIMELINE_TYPES =
      Set.of(HOURLY, WEEKLY, MONTHLY);

  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private PipelineServiceClientInterface pipelineServiceClient;
  private SearchRepository searchRepository;

  @Inject
  public AppService(
      AppRepository repository, Authorizer authorizer, AppMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.APPLICATION, App.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
    this.searchRepository = Entity.getSearchRepository();

    try {
      CollectionDAO dao = Entity.getCollectionDAO();
      SearchRepository searchRepo = Entity.getSearchRepository();
      AppScheduler.initialize(config, dao, searchRepo);

      List<org.openmetadata.schema.entity.app.CreateApp> createAppsReq =
          getEntitiesFromSeedData(
              APPLICATION,
              String.format(".*json/data/%s/.*\\.json$", Entity.APPLICATION),
              org.openmetadata.schema.entity.app.CreateApp.class);
      loadDefaultApplications(createAppsReq, searchRepo);
      ApplicationContext.initialize();
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
    }
  }

  @Override
  public App addHref(UriInfo uriInfo, App app) {
    super.addHref(uriInfo, app);
    Entity.withHref(uriInfo, app.getBot());
    Entity.withHref(uriInfo, app.getPipelines());
    return app;
  }

  public List<EntityReference> listAllAppsReference() {
    return repository.listAllAppsReference();
  }

  public App getByName(
      UriInfo uriInfo, String name, EntityUtil.Fields fields, Include include, boolean fromCache) {
    return repository.getByName(uriInfo, name, fields, include, fromCache);
  }

  public App getByName(UriInfo uriInfo, String name, EntityUtil.Fields fields) {
    return repository.getByName(uriInfo, name, fields);
  }

  public App get(
      UriInfo uriInfo, UUID id, EntityUtil.Fields fields, Include include, boolean fromCache) {
    return repository.get(uriInfo, id, fields, include, fromCache);
  }

  public ResultList<AppRunRecord> listAppRuns(App app, int limit, int offset) {
    return repository.listAppRuns(app, limit, offset);
  }

  public AppRunRecord getLatestAppRuns(App app) {
    return repository.getLatestAppRuns(app);
  }

  public ResultList<AppExtension> listAppExtensionAfterTimeByName(
      App app,
      Long startTs,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return repository.listAppExtensionAfterTimeByName(
        app, startTs, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionAfterTimeById(
      App app,
      Long startTs,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return repository.listAppExtensionAfterTimeById(
        app, startTs, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionByName(
      App app,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return repository.listAppExtensionByName(app, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionById(
      App app,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return repository.listAppExtensionById(app, limit, offset, clazz, extensionType);
  }

  public void initializeEntity(App app) {
    repository.initializeEntity(app);
  }

  public Set<String> getAllowedFields() {
    return repository.getAllowedFields();
  }

  public CollectionDAO getDaoCollection() {
    return repository.getDaoCollection();
  }

  public RestUtil.DeleteResponse<App> deleteApp(
      String userName, UUID id, boolean recursive, boolean hardDelete) {
    return repository.delete(userName, id, recursive, hardDelete);
  }

  public void unsetAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(null);
    app.setPrivateConfiguration(null);
  }

  public static AppRunRecord convertPipelineStatus(App app, PipelineStatus pipelineStatus) {
    return new AppRunRecord()
        .withAppId(app.getId())
        .withAppName(app.getName())
        .withStartTime(pipelineStatus.getStartDate())
        .withExecutionTime(
            pipelineStatus.getEndDate() == null
                ? System.currentTimeMillis() - pipelineStatus.getStartDate()
                : pipelineStatus.getEndDate() - pipelineStatus.getStartDate())
        .withEndTime(pipelineStatus.getEndDate())
        .withStatus(
            switch (pipelineStatus.getPipelineState()) {
              case QUEUED -> AppRunRecord.Status.PENDING;
              case SUCCESS -> AppRunRecord.Status.SUCCESS;
              case FAILED, PARTIAL_SUCCESS -> AppRunRecord.Status.FAILED;
              case RUNNING -> AppRunRecord.Status.RUNNING;
            })
        .withConfig(pipelineStatus.getConfig());
  }

  public ResultList<AppRunRecord> sortRunsByStartTime(ResultList<AppRunRecord> runs) {
    if (runs == null || nullOrEmpty(runs.getData())) {
      return runs;
    }
    List<AppRunRecord> sortedRuns = new ArrayList<>(runs.getData());
    sortedRuns.sort(
        Comparator.comparing(
            AppRunRecord::getStartTime, Comparator.nullsLast(Comparator.reverseOrder())));
    runs.setData(sortedRuns);
    return runs;
  }

  public ResultList<AppRunRecord> listAppRunsForApp(
      UriInfo uriInfo, String name, int limitParam, int offset, Long startTs, Long endTs) {
    App installation = getByName(uriInfo, name, getFields("id,pipelines"));
    ResultList<AppRunRecord> appRuns;
    if (installation.getAppType().equals(AppType.Internal)) {
      appRuns = listAppRuns(installation, limitParam, offset);
    } else if (!installation.getPipelines().isEmpty()) {
      EntityReference pipelineRef = installation.getPipelines().get(0);
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      IngestionPipeline ingestionPipeline =
          ingestionPipelineRepository.get(
              uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));
      appRuns =
          ingestionPipelineRepository
              .listExternalAppStatus(ingestionPipeline.getFullyQualifiedName(), startTs, endTs)
              .map(pipelineStatus -> convertPipelineStatus(installation, pipelineStatus));
    } else {
      throw new IllegalArgumentException("App does not have a scheduled deployment");
    }
    return sortRunsByStartTime(appRuns);
  }

  public Response getLastLogs(
      UriInfo uriInfo, SecurityContext securityContext, String name, String after) {
    App installation = getByName(uriInfo, name, getFields("id,pipelines"));
    if (installation.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK).entity(getLatestAppRuns(installation)).build();
    } else {
      if (!installation.getPipelines().isEmpty()) {
        EntityReference pipelineRef = installation.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));
        return Response.ok(
                pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after),
                MediaType.APPLICATION_JSON_TYPE)
            .build();
      }
    }
    throw new BadRequestException("Failed to Get Logs for the Installation.");
  }

  public Response getLatestAppRunResponse(UriInfo uriInfo, String name, String after) {
    App installation = getByName(uriInfo, name, getFields("id,pipelines"));
    if (installation.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK).entity(getLatestAppRuns(installation)).build();
    } else {
      if (!installation.getPipelines().isEmpty()) {
        EntityReference pipelineRef = installation.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));
        PipelineStatus latestPipelineStatus =
            ingestionPipelineRepository.getLatestPipelineStatus(ingestionPipeline);
        Map<String, String> lastIngestionLogs =
            pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after);
        Map<String, Object> appRun = new HashMap<>();
        appRun.put("pipelineStatus", latestPipelineStatus);
        appRun.put("lastIngestionLogs", lastIngestionLogs);
        return Response.ok(appRun, MediaType.APPLICATION_JSON_TYPE).build();
      }
    }
    throw new BadRequestException("Failed to Get Logs for the Installation.");
  }

  public Response scheduleApplication(
      UriInfo uriInfo, SecurityContext securityContext, String name) {
    App app = getByName(uriInfo, name, new EntityUtil.Fields(getAllowedFields()));
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              getDaoCollection(),
              searchRepository,
              securityContext.getUserPrincipal().getName());

      return Response.status(Response.Status.OK).entity("App is Scheduled.").build();
    }
    throw new IllegalArgumentException("App is not of schedule type Scheduled.");
  }

  public Response configureApplication(UriInfo uriInfo, String name) {
    App app = getByName(uriInfo, name, new EntityUtil.Fields(getAllowedFields()));
    ApplicationHandler.getInstance()
        .configureApplication(app, getDaoCollection(), searchRepository);
    return Response.status(Response.Status.OK).entity("App has been configured.").build();
  }

  public Response triggerApplicationRun(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Map<String, Object> configPayload) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = getByName(uriInfo, name, fields);
    if (app.getAppType().equals(AppType.Internal)) {
      ApplicationHandler.getInstance()
          .triggerApplicationOnDemand(
              app, Entity.getCollectionDAO(), searchRepository, configPayload);
      return Response.status(Response.Status.OK).build();
    } else {
      if (!app.getPipelines().isEmpty()) {
        IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);

        if (app.getSupportsIngestionRunner()) {
          service.setIngestionRunner(app.getIngestionRunner());
        }

        PipelineServiceClientResponse response =
            pipelineServiceClient.runPipeline(ingestionPipeline, service, configPayload);
        return Response.status(response.getCode()).entity(response).build();
      }
    }
    throw new BadRequestException("Failed to trigger application.");
  }

  public Response stopApplicationRun(
      UriInfo uriInfo, SecurityContext securityContext, String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = getByName(uriInfo, name, fields);
    if (Boolean.TRUE.equals(app.getSupportsInterrupt())) {
      if (app.getAppType().equals(AppType.Internal)) {
        new Thread(() -> AppScheduler.getInstance().stopApplicationRun(app)).start();
        return Response.status(Response.Status.OK)
            .entity("Application stop in progress. Please check status via.")
            .build();
      } else {
        if (!app.getPipelines().isEmpty()) {
          IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
          PipelineServiceClientResponse response =
              pipelineServiceClient.killIngestion(ingestionPipeline);
          return Response.status(response.getCode()).entity(response).build();
        }
      }
    }
    throw new BadRequestException("Application does not support Interrupts.");
  }

  public Response deployApplicationFlow(
      UriInfo uriInfo, SecurityContext securityContext, String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = getByName(uriInfo, name, fields);
    if (app.getAppType().equals(AppType.Internal)) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              Entity.getCollectionDAO(),
              searchRepository,
              securityContext.getUserPrincipal().getName());
      return Response.status(Response.Status.OK).entity("Application Deployed").build();
    } else {
      if (!app.getPipelines().isEmpty()) {
        IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);

        if (app.getSupportsIngestionRunner()) {
          service.setIngestionRunner(app.getIngestionRunner());
        }

        PipelineServiceClientResponse status =
            pipelineServiceClient.deployPipeline(ingestionPipeline, service);
        if (status.getCode() == 200) {
          IngestionPipelineRepository ingestionPipelineRepository =
              (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
          ingestionPipelineRepository.createOrUpdate(
              uriInfo, ingestionPipeline, securityContext.getUserPrincipal().getName());
        } else {
          ingestionPipeline.setDeployed(false);
        }
        return Response.status(status.getCode()).entity(status).build();
      }
    }
    throw new InternalServerErrorException("Failed to deploy application.");
  }

  public void deleteApp(SecurityContext securityContext, App installedApp) {
    ApplicationHandler.getInstance()
        .uninstallApplication(installedApp, Entity.getCollectionDAO(), searchRepository);

    if (installedApp.getAppType().equals(AppType.Internal)) {
      try {
        AppScheduler.getInstance().deleteScheduledApplication(installedApp);
      } catch (SchedulerException ex) {
        LOG.error("Failed in delete Application from Scheduler.", ex);
        throw new InternalServerErrorException("Failed in Delete App from Scheduler.");
      }
    } else {
      if (!nullOrEmpty(installedApp.getPipelines())) {
        IngestionPipeline ingestionPipeline =
            getIngestionPipeline(null, securityContext, installedApp);
        try {
          pipelineServiceClient.deletePipeline(ingestionPipeline);
        } catch (Exception ex) {
          LOG.error("Failed in Pipeline Service Client : ", ex);
        }
      }
    }
  }

  public Response deleteAppAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    String jobId = UUID.randomUUID().toString();
    App app;
    Response response;

    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    app = get(uriInfo, id, getFields("bot,pipelines"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            ApplicationHandler.getInstance()
                .performCleanup(app, Entity.getCollectionDAO(), searchRepository, userName);

            deleteApp(securityContext, app);

            RestUtil.DeleteResponse<App> deleteResponse =
                deleteApp(userName, id, recursive, hardDelete);

            if (hardDelete) {
              limits.invalidateCache(entityType);
            }

            WebsocketNotificationHandler.sendDeleteOperationCompleteNotification(
                jobId, securityContext, deleteResponse.entity());
          } catch (Exception e) {
            WebsocketNotificationHandler.sendDeleteOperationFailedNotification(
                jobId, securityContext, app, e.getMessage());
          }
        });

    response =
        Response.accepted()
            .entity(
                new DeleteEntityResponse(
                    jobId,
                    "Delete operation initiated for " + app.getName(),
                    app.getName(),
                    hardDelete,
                    recursive))
            .build();

    return response;
  }

  public IngestionPipeline getIngestionPipeline(
      UriInfo uriInfo, SecurityContext securityContext, App app) {
    EntityReference pipelineRef = app.getPipelines().get(0);
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    IngestionPipeline ingestionPipeline =
        ingestionPipelineRepository.get(
            uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));

    ingestionPipeline.setOpenMetadataServerConnection(app.getOpenMetadataServerConnection());
    decryptOrNullify(securityContext, ingestionPipeline, app.getBot().getName(), true);

    return ingestionPipeline;
  }

  private void decryptOrNullify(
      SecurityContext securityContext,
      IngestionPipeline ingestionPipeline,
      String botName,
      boolean forceNotMask) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.VIEW_ALL),
          getResourceContextById(ingestionPipeline.getId()));
    } catch (AuthorizationException e) {
      ingestionPipeline.getSourceConfig().setConfig(null);
    }
    secretsManager.decryptIngestionPipeline(ingestionPipeline);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, botName).build();
    ingestionPipeline.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    if (authorizer.shouldMaskPasswords(securityContext) && !forceNotMask) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(ingestionPipeline);
    }
  }

  private void loadDefaultApplications(
      List<org.openmetadata.schema.entity.app.CreateApp> defaultAppCreateRequests,
      SearchRepository searchRepo) {
    for (org.openmetadata.schema.entity.app.CreateApp createApp : defaultAppCreateRequests) {
      try {
        App app = getAppForInit(createApp.getName());
        if (app == null) {
          app = mapper.createToEntity(createApp, ADMIN_USER_NAME);
          scheduleAppIfNeeded(app, searchRepo);
          repository.initializeEntity(app);
        } else {
          scheduleAppIfNeeded(app, searchRepo);
        }
      } catch (AppException ex) {
        LOG.warn(
            "We could not install the application {}. Error: {}",
            createApp.getName(),
            ex.getMessage());
      } catch (Exception ex) {
        LOG.error("Failed in Creation/Initialization of Application : {}", createApp.getName(), ex);
      }
    }
  }

  private void scheduleAppIfNeeded(App app, SearchRepository searchRepo) {
    if (SCHEDULED_TIMELINE_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(app, Entity.getCollectionDAO(), searchRepo, ADMIN_USER_NAME);
    }
  }

  private App getAppForInit(String appName) {
    try {
      return repository.getByName(
          null, appName, repository.getFields("bot,pipelines"), Include.ALL, false);
    } catch (org.openmetadata.service.exception.EntityNotFoundException ex) {
      return null;
    }
  }

  public OpenMetadataApplicationConfig getOpenMetadataApplicationConfig() {
    return openMetadataApplicationConfig;
  }

  public SearchRepository getSearchRepository() {
    return searchRepository;
  }

  public static class AppList extends ResultList<App> {}

  public static class AppRefList extends ResultList<EntityReference> {}

  public static class AppRunList extends ResultList<AppRunRecord> {}
}
