package org.openmetadata.service.apps;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.jdbi3.EntityRepository.getEntitiesFromSeedData;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppBoundType;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
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
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.quartz.SchedulerException;

@Slf4j
public class AppService {

  private final AppRepository appRepository;
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final ApplicationHandler applicationHandler;
  private final IngestionPipelineRepository ingestionPipelineRepository;
  private final ExecutorService executorService;
  private final PipelineServiceClientInterface pipelineServiceClient;
  private final AppMapper mapper = new AppMapper();
  private final Authorizer authorizer;

  public static final List<ScheduleType> SCHEDULED_TYPES =
      List.of(
          ScheduleType.Scheduled,
          ScheduleType.ScheduledOrManual,
          ScheduleType.NoSchedule,
          ScheduleType.OnlyManual);

  // Static configuration that should be injected
  private static OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public AppService(
      AppRepository appRepository,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      Authorizer authorizer,
      OpenMetadataApplicationConfig config) {
    this.appRepository = appRepository;
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.applicationHandler = ApplicationHandler.getInstance();
    this.ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    this.executorService = AsyncService.getInstance().getExecutorService();
    this.authorizer = authorizer;
    openMetadataApplicationConfig = config;

    try {
      this.pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(
              config.getPipelineServiceClientConfiguration());
    } catch (Exception e) {
      throw new RuntimeException("Failed to initialize pipeline service client", e);
    }
  }

  public void initializeDefaultApplications() {
    try {
      List<CreateApp> createAppsReq =
          getEntitiesFromSeedData(
              APPLICATION,
              String.format(".*json/data/%s/.*\\.json$", APPLICATION),
              CreateApp.class);
      loadDefaultApplications(createAppsReq);
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
    }
  }

  private void loadDefaultApplications(List<CreateApp> defaultAppCreateRequests) {
    for (CreateApp createApp : defaultAppCreateRequests) {
      try {
        App app = getAppForInit(createApp.getName());
        if (app == null) {
          app = mapper.createToEntity(createApp, ADMIN_USER_NAME);
          scheduleAppIfNeeded(app);
          appRepository.initializeEntity(app);
        } else {
          scheduleAppIfNeeded(app);
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

  private void scheduleAppIfNeeded(App app) {
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      applicationHandler.installApplication(app, collectionDAO, searchRepository, ADMIN_USER_NAME);
    }
  }

  private App getAppForInit(String appName) {
    try {
      return appRepository.getByName(null, appName, appRepository.getFields("bot"), ALL, false);
    } catch (EntityNotFoundException ex) {
      return null;
    }
  }

  public Response createApp(UriInfo uriInfo, SecurityContext securityContext, CreateApp createApp) {
    App app = mapper.createToEntity(createApp, securityContext.getUserPrincipal().getName());

    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      applicationHandler.installApplication(
          app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());
    }

    unsetAppRuntimeProperties(app);
    App createdApp = appRepository.create(uriInfo, app);
    return Response.status(Response.Status.CREATED).entity(createdApp).build();
  }

  public Response patchApp(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch)
      throws SchedulerException {
    App app = appRepository.get(null, id, appRepository.getFields("bot"));
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(app.getName(), "SystemApp"));
    }
    AppScheduler.getInstance().deleteScheduledApplication(app);

    RestUtil.PatchResponse<App> patchResponse =
        appRepository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
    App patchedApp = patchResponse.entity();

    if (SCHEDULED_TYPES.contains(patchedApp.getScheduleType())) {
      applicationHandler.installApplication(
          patchedApp,
          collectionDAO,
          searchRepository,
          securityContext.getUserPrincipal().getName());
    }

    unsetAppRuntimeProperties(patchedApp);
    return Response.ok(patchedApp).build();
  }

  public Response createOrUpdateApp(
      UriInfo uriInfo, SecurityContext securityContext, CreateApp createApp)
      throws SchedulerException {
    App app = mapper.createToEntity(createApp, securityContext.getUserPrincipal().getName());
    AppScheduler.getInstance().deleteScheduledApplication(app);

    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      applicationHandler.installApplication(
          app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());
    }

    unsetAppRuntimeProperties(app);
    App updatedApp =
        appRepository
            .createOrUpdate(uriInfo, app, securityContext.getUserPrincipal().getName())
            .getEntity();
    return Response.ok(updatedApp).build();
  }

  public Response deleteApp(
      UriInfo uriInfo, SecurityContext securityContext, String name, boolean hardDelete) {
    App app = appRepository.getByName(uriInfo, name, appRepository.getFields("bot"), ALL, false);

    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    applicationHandler.performCleanup(
        app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());

    deleteAppInternal(securityContext, app);
    return appRepository
        .deleteByName(securityContext.getUserPrincipal().getName(), name, true, hardDelete)
        .toResponse();
  }

  public Response deleteAppById(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean hardDelete) {
    App app = appRepository.get(uriInfo, id, appRepository.getFields("bot"), ALL, false);

    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    applicationHandler.performCleanup(
        app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());

    deleteAppInternal(securityContext, app);
    return appRepository
        .delete(securityContext.getUserPrincipal().getName(), id, true, hardDelete)
        .toResponse();
  }

  public Response deleteAppAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    String jobId = UUID.randomUUID().toString();
    App app = appRepository.get(uriInfo, id, appRepository.getFields("bot"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    executorService.submit(
        () -> {
          try {
            applicationHandler.performCleanup(app, collectionDAO, searchRepository, userName);
            deleteAppInternal(securityContext, app);
            RestUtil.DeleteResponse<App> deleteResponse =
                appRepository.delete(userName, id, recursive, hardDelete);
            WebsocketNotificationHandler.sendDeleteOperationCompleteNotification(
                jobId, securityContext, deleteResponse.entity());
          } catch (Exception e) {
            WebsocketNotificationHandler.sendDeleteOperationFailedNotification(
                jobId, securityContext, app, e.getMessage());
          }
        });

    return Response.accepted()
        .entity(
            new DeleteEntityResponse(
                jobId,
                "Delete operation initiated for " + app.getName(),
                app.getName(),
                hardDelete,
                recursive))
        .build();
  }

  public Response restoreApp(
      UriInfo uriInfo, SecurityContext securityContext, RestoreEntity restore) {
    RestUtil.PutResponse<App> putResponse =
        appRepository.restoreEntity(securityContext.getUserPrincipal().getName(), restore.getId());
    Response response = Response.ok(putResponse.getEntity()).build();

    if (response.getStatus() == Response.Status.OK.getStatusCode()) {
      App app = (App) response.getEntity();
      if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
        applicationHandler.installApplication(
            app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());
      }
      unsetAppRuntimeProperties(app);
    }

    return response;
  }

  // Application execution operations
  public Response scheduleApp(UriInfo uriInfo, SecurityContext securityContext, String name) {
    App app =
        appRepository.getByName(
            uriInfo, name, new EntityUtil.Fields(appRepository.getAllowedFields()));

    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      applicationHandler.installApplication(
          app,
          appRepository.getDaoCollection(),
          searchRepository,
          securityContext.getUserPrincipal().getName());
      return Response.status(Response.Status.OK).entity("App is Scheduled.").build();
    }

    throw new IllegalArgumentException("App is not of schedule type Scheduled.");
  }

  public Response configureApp(UriInfo uriInfo, SecurityContext securityContext, String name) {
    App app =
        appRepository.getByName(
            uriInfo, name, new EntityUtil.Fields(appRepository.getAllowedFields()));
    applicationHandler.configureApplication(
        app, appRepository.getDaoCollection(), searchRepository);
    return Response.status(Response.Status.OK).entity("App has been configured.").build();
  }

  public Response triggerApp(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Map<String, Object> configPayload) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot", FIELD_OWNERS));
    App app = appRepository.getByName(uriInfo, name, fields);

    if (app.getAppType().equals(AppType.Internal)) {
      applicationHandler.triggerApplicationOnDemand(
          app, collectionDAO, searchRepository, configPayload);
      return Response.status(Response.Status.OK).build();
    } else {
      if (AppBoundConfigurationUtil.getPipeline(app) != null) {
        IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
        PipelineServiceClientResponse response =
            pipelineServiceClient.runPipeline(ingestionPipeline, service, configPayload);
        return Response.status(response.getCode()).entity(response).build();
      }
    }

    throw new BadRequestException("Failed to trigger application.");
  }

  public Response stopApp(UriInfo uriInfo, SecurityContext securityContext, String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot", FIELD_OWNERS));
    App app = appRepository.getByName(uriInfo, name, fields);

    if (Boolean.TRUE.equals(app.getSupportsInterrupt())) {
      if (app.getAppType().equals(AppType.Internal)) {
        new Thread(() -> AppScheduler.getInstance().stopApplicationRun(app)).start();
        return Response.status(Response.Status.OK)
            .entity("Application stop in progress. Please check status via.")
            .build();
      } else {
        if (AppBoundConfigurationUtil.getPipeline(app) != null) {
          IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
          PipelineServiceClientResponse response =
              pipelineServiceClient.killIngestion(ingestionPipeline);
          return Response.status(response.getCode()).entity(response).build();
        }
      }
    }

    throw new BadRequestException("Application does not support Interrupts.");
  }

  public Response deployApp(UriInfo uriInfo, SecurityContext securityContext, String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot", FIELD_OWNERS));
    App app = appRepository.getByName(uriInfo, name, fields);

    if (app.getAppType().equals(AppType.Internal)) {
      applicationHandler.installApplication(
          app, collectionDAO, searchRepository, securityContext.getUserPrincipal().getName());
      return Response.status(Response.Status.OK).entity("Application Deployed").build();
    } else {
      if (AppBoundConfigurationUtil.getPipeline(app) != null) {
        IngestionPipeline ingestionPipeline = getIngestionPipeline(uriInfo, securityContext, app);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
        PipelineServiceClientResponse status =
            pipelineServiceClient.deployPipeline(ingestionPipeline, service);

        if (status.getCode() == 200) {
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

  // Service configuration operations for service-bound apps
  public Response addServiceConfiguration(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID appId,
      Map<String, Object> serviceConfig) {
    App app =
        appRepository.get(
            uriInfo, appId, appRepository.getFields("appBoundType,appBoundConfiguration"));

    if (app.getBoundType() != AppBoundType.Service) {
      throw new BadRequestException(
          "Cannot add service configuration to non-service-bound application");
    }

    String serviceRefId = (String) serviceConfig.get("serviceRef");
    if (serviceRefId == null) {
      throw new BadRequestException("serviceRef is required in service configuration");
    }

    UUID serviceId = UUID.fromString(serviceRefId);
    EntityReference serviceRef =
        new EntityReference().withId(serviceId).withType((String) serviceConfig.get("serviceType"));

    AppBoundConfigurationUtil.addServiceConfiguration(app, serviceRef);

    if (serviceConfig.containsKey("appConfiguration")) {
      AppBoundConfigurationUtil.setAppConfiguration(
          app, serviceId, serviceConfig.get("appConfiguration"));
    }

    String updatedBy = securityContext.getUserPrincipal().getName();
    appRepository.createOrUpdate(uriInfo, app, updatedBy);

    if (app.getAppType() == AppType.Internal && SCHEDULED_TYPES.contains(app.getScheduleType())) {
      try {
        AppScheduler.getInstance().scheduleServiceBoundApplication(app, serviceId.toString());
      } catch (Exception e) {
        LOG.error("Failed to schedule service-bound application {}", app.getName(), e);
      }
    }

    return Response.status(Response.Status.OK)
        .entity("Service configuration added successfully")
        .build();
  }

  public Response removeServiceConfiguration(
      UriInfo uriInfo, SecurityContext securityContext, UUID appId, UUID serviceId) {
    App app =
        appRepository.get(
            uriInfo, appId, appRepository.getFields("appBoundType,appBoundConfiguration"));

    if (app.getBoundType() != AppBoundType.Service) {
      throw new BadRequestException(
          "Cannot remove service configuration from non-service-bound application");
    }

    boolean removed = AppBoundConfigurationUtil.removeServiceConfiguration(app, serviceId);
    if (!removed) {
      throw new EntityNotFoundException(
          String.format("Service configuration for service %s not found", serviceId));
    }

    String updatedBy = securityContext.getUserPrincipal().getName();
    appRepository.createOrUpdate(uriInfo, app, updatedBy);

    if (app.getAppType() == AppType.Internal) {
      try {
        AppScheduler.getInstance().deleteServiceBoundApplication(app, serviceId.toString());
      } catch (Exception e) {
        LOG.error("Failed to delete service-bound application job {}", app.getName(), e);
      }
    }

    return Response.status(Response.Status.OK)
        .entity("Service configuration removed successfully")
        .build();
  }

  // Monitoring and status operations
  public ResultList<AppRunRecord> listAppRuns(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      int limitParam,
      int offset,
      Long startTs,
      Long endTs) {
    App app = appRepository.getByName(uriInfo, name, appRepository.getFields("id"));

    if (app.getAppType().equals(AppType.Internal)) {
      return appRepository.listAppRuns(app, limitParam, offset);
    }

    EntityReference pipelineRef = AppBoundConfigurationUtil.getPipeline(app);
    if (pipelineRef != null) {
      IngestionPipeline ingestionPipeline =
          ingestionPipelineRepository.get(
              uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));

      return ingestionPipelineRepository
          .listExternalAppStatus(ingestionPipeline.getFullyQualifiedName(), startTs, endTs)
          .map(pipelineStatus -> convertPipelineStatus(app, pipelineStatus));
    }

    throw new IllegalArgumentException("App does not have a scheduled deployment");
  }

  public Response listAppExtension(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      int limitParam,
      int offset,
      Long startTs,
      AppExtension.ExtensionType extensionType,
      boolean byName) {
    App app = appRepository.getByName(uriInfo, name, appRepository.getFields("id"));
    ResultList<AppExtension> appExtensionList;

    if (startTs != null) {
      appExtensionList =
          byName
              ? appRepository.listAppExtensionAfterTimeByName(
                  app, startTs, limitParam, offset, AppExtension.class, extensionType)
              : appRepository.listAppExtensionAfterTimeById(
                  app, startTs, limitParam, offset, AppExtension.class, extensionType);
    } else {
      appExtensionList =
          byName
              ? appRepository.listAppExtensionByName(
                  app, limitParam, offset, AppExtension.class, extensionType)
              : appRepository.listAppExtensionById(
                  app, limitParam, offset, AppExtension.class, extensionType);
    }

    return Response.status(Response.Status.OK).entity(appExtensionList).build();
  }

  public Response getLastLogs(
      UriInfo uriInfo, SecurityContext securityContext, String name, String after) {
    App app = appRepository.getByName(uriInfo, name, appRepository.getFields("id"));

    if (app.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK)
          .entity(appRepository.getLatestAppRuns(app))
          .build();
    } else {
      EntityReference pipelineRef = AppBoundConfigurationUtil.getPipeline(app);
      if (pipelineRef != null) {
        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));

        return Response.ok(
                pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after),
                jakarta.ws.rs.core.MediaType.APPLICATION_JSON_TYPE)
            .build();
      }
    }

    throw new BadRequestException("Failed to Get Logs for the Installation.");
  }

  public Response getLatestAppRun(
      UriInfo uriInfo, SecurityContext securityContext, String name, String after) {
    App app = appRepository.getByName(uriInfo, name, appRepository.getFields("id"));

    if (app.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK)
          .entity(appRepository.getLatestAppRuns(app))
          .build();
    } else {
      EntityReference pipelineRef = AppBoundConfigurationUtil.getPipeline(app);
      if (pipelineRef != null) {
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

        return Response.ok(appRun, jakarta.ws.rs.core.MediaType.APPLICATION_JSON_TYPE).build();
      }
    }

    throw new BadRequestException("Failed to Get Logs for the Installation.");
  }

  public List<EntityReference> getInstalledAppsReference() {
    return appRepository.listAllAppsReference();
  }

  // Helper methods
  private void unsetAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(null);
    AppBoundConfigurationUtil.unsetPrivateConfiguration(app);
  }

  protected static AppRunRecord convertPipelineStatus(App app, PipelineStatus pipelineStatus) {
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

  private void decryptOrNullify(
      SecurityContext securityContext,
      IngestionPipeline ingestionPipeline,
      String botName,
      boolean forceNotMask) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(APPLICATION, MetadataOperation.VIEW_ALL),
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

  private IngestionPipeline getIngestionPipeline(
      UriInfo uriInfo, SecurityContext securityContext, App app) {
    EntityReference pipelineRef = AppBoundConfigurationUtil.getPipeline(app);

    IngestionPipeline ingestionPipeline =
        ingestionPipelineRepository.get(
            uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));

    ingestionPipeline.setOpenMetadataServerConnection(app.getOpenMetadataServerConnection());
    decryptOrNullify(securityContext, ingestionPipeline, app.getBot().getName(), true);

    return ingestionPipeline;
  }

  private void deleteAppInternal(SecurityContext securityContext, App installedApp) {
    applicationHandler.uninstallApplication(installedApp, collectionDAO, searchRepository);

    if (installedApp.getAppType().equals(AppType.Internal)) {
      try {
        AppScheduler.getInstance().deleteScheduledApplication(installedApp);
      } catch (SchedulerException ex) {
        LOG.error("Failed in delete Application from Scheduler.", ex);
        throw new InternalServerErrorException("Failed in Delete App from Scheduler.");
      }
    } else {
      if (AppBoundConfigurationUtil.getPipeline(installedApp) != null) {
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

  private EntityUtil.Fields getFields(String fieldsParam) {
    return new EntityUtil.Fields(appRepository.getAllowedFields(), fieldsParam);
  }

  private org.openmetadata.service.security.policyevaluator.ResourceContext getResourceContextById(
      UUID id) {
    return new org.openmetadata.service.security.policyevaluator.ResourceContext(
        APPLICATION, id, null);
  }
}
