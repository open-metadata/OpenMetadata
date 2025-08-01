package org.openmetadata.service.resources.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.jdbi3.EntityRepository.getEntitiesFromSeedData;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
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
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.quartz.SchedulerException;

@Path("/v1/apps")
@Tag(
    name = "Apps",
    description = "Apps are internal/external apps used to something on top of Open-metadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apps", order = 8)
@Slf4j
public class AppResource extends EntityResource<App, AppRepository> {
  public static final String COLLECTION_PATH = "v1/apps/";
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private PipelineServiceClientInterface pipelineServiceClient;
  static final String FIELDS = "owners";
  private SearchRepository searchRepository;
  public static final List<ScheduleType> SCHEDULED_TYPES =
      List.of(
          ScheduleType.Scheduled,
          ScheduleType.ScheduledOrManual,
          ScheduleType.NoSchedule,
          ScheduleType.OnlyManual);
  private final AppMapper mapper = new AppMapper();

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      this.openMetadataApplicationConfig = config;
      this.pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(
              config.getPipelineServiceClientConfiguration());

      // Create an On Demand DAO
      CollectionDAO dao = Entity.getCollectionDAO();
      searchRepository = Entity.getSearchRepository();
      AppScheduler.initialize(config, dao, searchRepository);

      // Initialize Default Apps
      List<CreateApp> createAppsReq =
          getEntitiesFromSeedData(
              APPLICATION, String.format(".*json/data/%s/.*\\.json$", entityType), CreateApp.class);
      loadDefaultApplications(createAppsReq);
      ApplicationContext.initialize();
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
    }
  }

  private void loadDefaultApplications(List<CreateApp> defaultAppCreateRequests) {
    // Get Create App Requests
    for (CreateApp createApp : defaultAppCreateRequests) {
      try {
        App app = getAppForInit(createApp.getName());
        if (app == null) {
          app = mapper.createToEntity(createApp, ADMIN_USER_NAME);
          scheduleAppIfNeeded(app);
          repository.initializeEntity(app);
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
      ApplicationHandler.getInstance()
          .installApplication(app, Entity.getCollectionDAO(), searchRepository, ADMIN_USER_NAME);
    }
  }

  private App getAppForInit(String appName) {
    try {
      return repository.getByName(null, appName, repository.getFields("bot,pipelines"), ALL, false);
    } catch (EntityNotFoundException ex) {
      return null;
    }
  }

  public AppResource(Authorizer authorizer, Limits limits) {
    super(Entity.APPLICATION, authorizer, limits);
  }

  public static class AppList extends ResultList<App> {
    /* Required for serde */
  }

  public static class AppRefList extends ResultList<EntityReference> {
    /* Required for serde */
  }

  public static class AppRunList extends ResultList<AppRunRecord> {
    /* Required for serde */
  }

  /**
   * We don't want to store runtime information into the DB
   */
  private void unsetAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(null);
    app.setPrivateConfiguration(null);
  }

  @GET
  @Operation(
      operationId = "listInstalledApplications",
      summary = "List installed application",
      description =
          "Get a list of applications. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Installed Applications",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppList.class)))
      })
  public ResultList<App> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number of installed applications returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of tests before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of tests after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(description = "Filter by agent type", schema = @Schema(type = "string"))
          @QueryParam("agentType")
          String agentType,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("agentType", agentType);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/installed")
  @Operation(
      operationId = "listInstalledAppsInformation",
      summary = "List Entity Reference for installed application",
      description = "Get a list of applications ",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Installed Applications Entity Reference",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppRefList.class)))
      })
  public List<EntityReference> list(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return repository.listAllAppsReference();
  }

  @GET
  @Path("/name/{name}/status")
  @Operation(
      operationId = "listAppRunRecords",
      summary = "List App Run Records",
      description =
          "Get a list of applications Run Record."
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `offset` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Installed Applications Runs",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppRunList.class)))
      })
  public ResultList<AppRunRecord> listAppRuns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(description = "Limit records. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(1000)
          int limitParam,
      @Parameter(description = "Offset records. (0 to 1000000, default = 0)")
          @DefaultValue("0")
          @QueryParam("offset")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(1000)
          int offset,
      @Parameter(
              description = "Filter pipeline status after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline status before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs) {
    App installation = repository.getByName(uriInfo, name, repository.getFields("id,pipelines"));
    if (installation.getAppType().equals(AppType.Internal)) {
      return repository.listAppRuns(installation, limitParam, offset);
    }
    if (!installation.getPipelines().isEmpty()) {
      EntityReference pipelineRef = installation.getPipelines().get(0);
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      IngestionPipeline ingestionPipeline =
          ingestionPipelineRepository.get(
              uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNERS));
      return ingestionPipelineRepository
          .listExternalAppStatus(ingestionPipeline.getFullyQualifiedName(), startTs, endTs)
          .map(pipelineStatus -> convertPipelineStatus(installation, pipelineStatus));
    }
    throw new IllegalArgumentException("App does not have a scheduled deployment");
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

  @GET
  @Path("/name/{name}/extension")
  @Operation(
      operationId = "listAppExtension",
      summary = "List App Extension data",
      description =
          "Get a list of applications Extension data."
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `offset` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Installed Applications Runs",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppExtension.class)))
      })
  public Response listAppExtension(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(description = "Limit records. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(description = "Offset records. (0 to 1000000, default = 0)")
          @DefaultValue("0")
          @QueryParam("offset")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int offset,
      @Parameter(
              description = "Filter pipeline status after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(description = "Get the extension type", schema = @Schema(type = "string"))
          @QueryParam("extensionType")
          AppExtension.ExtensionType extensionType,
      @Parameter(
              description = "List extensions by name instead of id",
              schema = @Schema(type = "boolean"))
          @QueryParam("byName")
          @DefaultValue("false")
          boolean byName) {
    App installation = repository.getByName(uriInfo, name, repository.getFields("id"));
    if (startTs != null) {
      ResultList<AppExtension> appExtensionList =
          byName
              ? repository.listAppExtensionAfterTimeByName(
                  installation, startTs, limitParam, offset, AppExtension.class, extensionType)
              : repository.listAppExtensionAfterTimeById(
                  installation, startTs, limitParam, offset, AppExtension.class, extensionType);
      return Response.status(Response.Status.OK).entity(appExtensionList).build();
    }

    ResultList<AppExtension> appExtensionList =
        byName
            ? repository.listAppExtensionByName(
                installation, limitParam, offset, AppExtension.class, extensionType)
            : repository.listAppExtensionById(
                installation, limitParam, offset, AppExtension.class, extensionType);

    return Response.status(Response.Status.OK).entity(appExtensionList).build();
  }

  @GET
  @Path("/name/{name}/logs")
  @Operation(
      summary = "Retrieve all logs from last ingestion pipeline run for the application",
      description = "Get all logs from last ingestion pipeline run by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "JSON object with the task instance name of the ingestion on each key and log in the value",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Logs for instance {id} is not found")
      })
  public Response getLastLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Returns log chunk after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          @DefaultValue("")
          String after) {
    App installation = repository.getByName(uriInfo, name, repository.getFields("id,pipelines"));
    if (installation.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK)
          .entity(repository.getLatestAppRuns(installation))
          .build();
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

  @GET
  @Path("/name/{name}/runs/latest")
  @Operation(
      operationId = "latestAppRunRecord",
      summary = "Get Latest App Run Record",
      description = "Get a latest applications Run Record.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Installed Applications Runs",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppRunRecord.class)))
      })
  public Response listLatestAppRun(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Returns log chunk after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          @DefaultValue("")
          String after) {
    App installation = repository.getByName(uriInfo, name, repository.getFields("id,pipelines"));
    if (installation.getAppType().equals(AppType.Internal)) {
      return Response.status(Response.Status.OK)
          .entity(repository.getLatestAppRuns(installation))
          .build();
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

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllInstalledApplications",
      summary = "List Installed Application versions",
      description = "Get a list of all the versions of a application identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of installed application versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the app", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a app by Id",
      description = "Get a app by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The App",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {id} is not found")
      })
  public App get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getAppByName",
      summary = "Get a App by name",
      description = "Get a App by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The App",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {name} is not found")
      })
  public App getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    App app = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    ApplicationHandler.getInstance().setAppPrivateConfig(app);
    return decryptOrNullify(securityContext, app);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificAppVersion",
      summary = "Get a version of the App",
      description = "Get a version of the App by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "App",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class))),
        @ApiResponse(
            responseCode = "404",
            description = "App for instance {id} and version {version} is not found")
      })
  public App getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "App version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createApplication",
      summary = "Create a Application",
      description = "Create a application",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateApp create) {
    App app = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    limits.enforceLimits(
        securityContext,
        getResourceContext(),
        new OperationContext(APPLICATION, MetadataOperation.CREATE));
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              Entity.getCollectionDAO(),
              searchRepository,
              securityContext.getUserPrincipal().getName());
    }
    // We don't want to store this information
    unsetAppRuntimeProperties(app);
    return create(uriInfo, securityContext, app);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchApplication",
      summary = "Updates a App",
      description = "Update an existing App using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchApplication(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch)
      throws SchedulerException {
    App app = repository.get(null, id, repository.getFields("bot,pipelines"));
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(app.getName(), "SystemApp"));
    }
    AppScheduler.getInstance().deleteScheduledApplication(app);
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    App updatedApp = (App) response.getEntity();
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              updatedApp,
              Entity.getCollectionDAO(),
              searchRepository,
              securityContext.getUserPrincipal().getName());
    }
    // We don't want to store this information
    unsetAppRuntimeProperties(updatedApp);
    return response;
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchApplication",
      summary = "Updates a App by name.",
      description = "Update an existing App using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchApplication(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch)
      throws SchedulerException {
    App app = repository.getByName(null, fqn, repository.getFields("bot,pipelines"));
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(app.getName(), "SystemApp"));
    }
    AppScheduler.getInstance().deleteScheduledApplication(app);
    Response response = patchInternal(uriInfo, securityContext, fqn, patch);
    App updatedApp = (App) response.getEntity();
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              updatedApp,
              Entity.getCollectionDAO(),
              searchRepository,
              securityContext.getUserPrincipal().getName());
    }
    // We don't want to store this information
    unsetAppRuntimeProperties(updatedApp);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateApp",
      summary = "Create Or Update App",
      description = "Create or Update App, it it does not exist or update an existing KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated Application Objective ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateApp create)
      throws SchedulerException {
    App app = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    AppScheduler.getInstance().deleteScheduledApplication(app);
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              Entity.getCollectionDAO(),
              searchRepository,
              securityContext.getUserPrincipal().getName());
    }
    // We don't want to store this information
    unsetAppRuntimeProperties(app);
    return createOrUpdate(uriInfo, securityContext, app);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "uninstallAppByName",
      summary = "Delete a App by name",
      description = "Delete a App by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "400",
            description = "System entity {name} of type SystemApp can not be deleted."),
        @ApiResponse(responseCode = "404", description = "App for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    App app =
        repository.getByName(uriInfo, name, repository.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    ApplicationHandler.getInstance()
        .performCleanup(
            app,
            Entity.getCollectionDAO(),
            searchRepository,
            securityContext.getUserPrincipal().getName());

    limits.invalidateCache(entityType);
    // Remove from Pipeline Service
    deleteApp(securityContext, app);
    return deleteByName(uriInfo, securityContext, name, true, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "uninstallAppByName",
      summary = "Delete a App by Id",
      description = "Delete a App by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "400",
            description = "System entity {name} of type SystemApp can not be deleted."),
        @ApiResponse(responseCode = "404", description = "App for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    App app = repository.get(uriInfo, id, repository.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    ApplicationHandler.getInstance()
        .performCleanup(
            app,
            Entity.getCollectionDAO(),
            searchRepository,
            securityContext.getUserPrincipal().getName());

    // Remove from Pipeline Service
    deleteApp(securityContext, app);
    // Remove from repository
    return delete(uriInfo, securityContext, id, true, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "uninstallAppByNameAsync",
      summary = "Asynchronously delete a App by Id",
      description = "Asynchronously delete a App by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "400",
            description = "System entity {name} of type SystemApp can not be deleted."),
        @ApiResponse(responseCode = "404", description = "App for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    App app = repository.get(uriInfo, id, repository.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }
    return deleteAppAsync(uriInfo, securityContext, id, true, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted KPI",
      description = "Restore a soft deleted App.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the App. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = App.class)))
      })
  public Response restoreApp(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    Response response = restoreEntity(uriInfo, securityContext, restore.getId());
    if (response.getStatus() == Response.Status.OK.getStatusCode()) {
      App app = (App) response.getEntity();
      if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
        ApplicationHandler.getInstance()
            .installApplication(
                app,
                Entity.getCollectionDAO(),
                searchRepository,
                securityContext.getUserPrincipal().getName());
      }
      // We don't want to store this information
      unsetAppRuntimeProperties(app);
    }
    return response;
  }

  @POST
  @Path("/schedule/{name}")
  @Operation(
      operationId = "scheduleApplication",
      summary = "Schedule an Application",
      description = "Schedule a application to be run on demand.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Response.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Application for instance {id} is not found")
      })
  public Response scheduleApplication(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Context SecurityContext securityContext) {
    App app =
        repository.getByName(uriInfo, name, new EntityUtil.Fields(repository.getAllowedFields()));
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              repository.getDaoCollection(),
              searchRepository,
              securityContext.getUserPrincipal().getName());

      return Response.status(Response.Status.OK).entity("App is Scheduled.").build();
    }
    throw new IllegalArgumentException("App is not of schedule type Scheduled.");
  }

  @POST
  @Path("/configure/{name}")
  @Operation(
      operationId = "configureApplication",
      summary = "Configure an Application",
      description = "Schedule a application to be run on demand.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Response.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Application for instance {id} is not found")
      })
  public Response configureApplication(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Context SecurityContext securityContext) {
    App app =
        repository.getByName(uriInfo, name, new EntityUtil.Fields(repository.getAllowedFields()));
    // The application will have the updated appConfiguration we can use to run the `configure`
    // logic
    ApplicationHandler.getInstance()
        .configureApplication(app, repository.getDaoCollection(), searchRepository);
    return Response.status(Response.Status.OK).entity("App has been configured.").build();
  }

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Path("/trigger/{name}")
  @Operation(
      operationId = "triggerApplicationRun",
      summary = "Trigger an Application run",
      description = "Trigger a Application run by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Application trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Application for instance {id} is not found")
      })
  public Response triggerApplicationRun(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @RequestBody(
              description =
                  "Configuration payload. Keys will be added to the current configuration. Delete keys by setting them to null.",
              content = @Content(mediaType = MediaType.APPLICATION_JSON))
          Map<String, Object> configPayload) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = repository.getByName(uriInfo, name, fields);
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
        PipelineServiceClientResponse response =
            pipelineServiceClient.runPipeline(ingestionPipeline, service, configPayload);
        return Response.status(response.getCode()).entity(response).build();
      }
    }
    throw new BadRequestException("Failed to trigger application.");
  }

  @POST
  @Path("/stop/{name}")
  @Operation(
      operationId = "stopApplicationRun",
      summary = "Stop a Application run",
      description = "Stop a application run by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Application stopped status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Application for instance {id} is not found")
      })
  public Response stopApplicationRun(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = repository.getByName(uriInfo, name, fields);
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

  @POST
  @Path("/deploy/{name}")
  @Operation(
      operationId = "deployApplicationToQuartzOrIngestion",
      summary = "Deploy App to Quartz or Ingestion",
      description = "Deploy App to Quartz or Ingestion.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Application trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Application for instance {id} is not found")
      })
  public Response deployApplicationFlow(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNERS));
    App app = repository.getByName(uriInfo, name, fields);
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

  private App decryptOrNullify(SecurityContext securityContext, App app) {
    if (app == null || app.getPrivateConfiguration() == null) {
      return app;
    }
    // Mask sensitive fields for non-bot users
    if (authorizer.shouldMaskPasswords(securityContext)) {
      app.setPrivateConfiguration(
          EntityMaskerFactory.getEntityMasker()
              .maskAppPrivateConfig(app.getPrivateConfiguration(), app.getAppType().value()));
    }
    return app;
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

  private IngestionPipeline getIngestionPipeline(
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

  private void deleteApp(SecurityContext securityContext, App installedApp) {
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
    app = repository.get(uriInfo, id, repository.getFields("bot,pipelines"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            ApplicationHandler.getInstance()
                .performCleanup(app, Entity.getCollectionDAO(), searchRepository, userName);

            // Remove from Pipeline Service
            deleteApp(securityContext, app);

            // Remove from repository
            RestUtil.DeleteResponse<App> deleteResponse =
                repository.delete(userName, id, recursive, hardDelete);

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
}
