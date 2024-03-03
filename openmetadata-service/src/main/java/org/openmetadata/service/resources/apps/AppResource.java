package org.openmetadata.service.resources.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.BOT;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.apps.ApplicationHandler.removeUninstalledApp;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.api.configuration.apps.AppsPrivateConfiguration;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
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
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;
import org.quartz.SchedulerException;

@Path("/v1/apps")
@Tag(
    name = "Apps",
    description = "Apps are internal/external apps used to something on top of Open-metadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apps")
@Slf4j
public class AppResource extends EntityResource<App, AppRepository> {
  public static final String COLLECTION_PATH = "v1/apps/";
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private AppsPrivateConfiguration privateConfiguration;
  private PipelineServiceClient pipelineServiceClient;
  static final String FIELDS = "owner";
  private SearchRepository searchRepository;

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      this.openMetadataApplicationConfig = config;
      this.privateConfiguration = config.getAppsPrivateConfiguration();
      this.pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(
              config.getPipelineServiceClientConfiguration());

      // Create an On Demand DAO
      CollectionDAO dao = Entity.getCollectionDAO();
      searchRepository = new SearchRepository(config.getElasticSearchConfiguration());
      AppScheduler.initialize(config, dao, searchRepository);

      // Get Create App Requests
      List<CreateApp> createAppsReq =
          getEntitiesFromSeedData(
              APPLICATION, String.format(".*json/data/%s/.*\\.json$", entityType), CreateApp.class);
      for (CreateApp createApp : createAppsReq) {
        AppMarketPlaceDefinition definition =
            repository
                .getMarketPlace()
                .getByName(
                    null,
                    createApp.getName(),
                    new EntityUtil.Fields(repository.getMarketPlace().getAllowedFields()));
        App app = getAppForInit(createApp.getName());
        if (app == null) {
          app =
              getApplication(definition, createApp, "admin")
                  .withFullyQualifiedName(createApp.getName());
          repository.initializeEntity(app);
        }

        // Schedule
        if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
          setAppRuntimeProperties(app);
          ApplicationHandler.installApplication(app, Entity.getCollectionDAO(), searchRepository);
        }
      }

      // Initialize installed applications
      for (App installedApp : repository.listAll()) {
        App appWithBot = getAppForInit(installedApp.getName());
        if (appWithBot == null) {
          LOG.error(
              String.format(
                  "Failed to init app [%s]. GET should return the installed app",
                  installedApp.getName()));
        } else {
          setAppRuntimeProperties(appWithBot);
          ApplicationHandler.runAppInit(appWithBot, dao, searchRepository);
          LOG.info(String.format("Initialized installed app [%s]", installedApp.getName()));
        }
      }
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
    }
  }

  private App getAppForInit(String appName) {
    try {
      return repository.getByName(null, appName, repository.getFields("bot,pipelines"), ALL, false);
    } catch (EntityNotFoundException ex) {
      return null;
    }
  }

  public AppResource(Authorizer authorizer) {
    super(Entity.APPLICATION, authorizer);
  }

  public static class AppList extends ResultList<App> {
    /* Required for serde */
  }

  public static class AppRunList extends ResultList<AppRunRecord> {
    /* Required for serde */
  }

  /**
   * Load the apps' OM configuration and private parameters
   */
  private void setAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, app.getBot().getName())
            .build());

    if (privateConfiguration != null
        && !nullOrEmpty(privateConfiguration.getAppsPrivateConfiguration())) {
      for (AppPrivateConfig appPrivateConfig : privateConfiguration.getAppsPrivateConfiguration()) {
        if (app.getName().equals(appPrivateConfig.getName())) {
          app.setPrivateConfiguration(appPrivateConfig.getParameters());
        }
      }
    }
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
          @Min(0)
          @Max(1000000)
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
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
  public Response listAppRuns(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(description = "Limit records. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Offset records. (0 to 1000000, default = 0)")
          @DefaultValue("0")
          @QueryParam("offset")
          @Min(0)
          @Max(1000000)
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
      return Response.status(Response.Status.OK)
          .entity(repository.listAppRuns(installation.getId(), limitParam, offset))
          .build();
    }
    if (!installation.getPipelines().isEmpty()) {
      EntityReference pipelineRef = installation.getPipelines().get(0);
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      IngestionPipeline ingestionPipeline =
          ingestionPipelineRepository.get(
              uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));
      return Response.ok(
              ingestionPipelineRepository.listPipelineStatus(
                  ingestionPipeline.getFullyQualifiedName(), startTs, endTs),
              MediaType.APPLICATION_JSON_TYPE)
          .build();
    }
    throw new IllegalArgumentException("App does not have an associated pipeline.");
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
          .entity(repository.getLatestAppRuns(installation.getId()))
          .build();
    } else {
      if (!installation.getPipelines().isEmpty()) {
        EntityReference pipelineRef = installation.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));
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
          .entity(repository.getLatestAppRuns(installation.getId()))
          .build();
    } else {
      if (!installation.getPipelines().isEmpty()) {
        EntityReference pipelineRef = installation.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
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
    AppMarketPlaceDefinition definition =
        repository
            .getMarketPlace()
            .getByName(
                uriInfo,
                create.getName(),
                new EntityUtil.Fields(repository.getMarketPlace().getAllowedFields()));
    App app = getApplication(definition, create, securityContext.getUserPrincipal().getName());
    setAppRuntimeProperties(app);
    if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
      ApplicationHandler.installApplication(app, Entity.getCollectionDAO(), searchRepository);
      ApplicationHandler.configureApplication(app, Entity.getCollectionDAO(), searchRepository);
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
    AppScheduler.getInstance().deleteScheduledApplication(app);
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    App updatedApp = (App) response.getEntity();
    setAppRuntimeProperties(updatedApp);
    if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
      ApplicationHandler.installApplication(
          updatedApp, Entity.getCollectionDAO(), searchRepository);
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
    AppMarketPlaceDefinition definition =
        repository
            .getMarketPlace()
            .getByName(
                uriInfo,
                create.getName(),
                new EntityUtil.Fields(repository.getMarketPlace().getAllowedFields()));
    App app = getApplication(definition, create, securityContext.getUserPrincipal().getName());
    AppScheduler.getInstance().deleteScheduledApplication(app);
    setAppRuntimeProperties(app);
    if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
      ApplicationHandler.installApplication(app, Entity.getCollectionDAO(), searchRepository);
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
    App app = repository.getByName(null, name, repository.getFields("bot,pipelines"));
    // Remove from Pipeline Service
    deleteApp(securityContext, app, hardDelete);
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
    App app = repository.get(null, id, repository.getFields("bot,pipelines"));
    // Remove from Pipeline Service
    deleteApp(securityContext, app, hardDelete);
    // Remove from repository
    return delete(uriInfo, securityContext, id, true, hardDelete);
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
      setAppRuntimeProperties(app);
      if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
        ApplicationHandler.installApplication(app, Entity.getCollectionDAO(), searchRepository);
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
    setAppRuntimeProperties(app);
    if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
      ApplicationHandler.installApplication(app, repository.getDaoCollection(), searchRepository);
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
    setAppRuntimeProperties(app);
    try {
      ApplicationHandler.configureApplication(app, repository.getDaoCollection(), searchRepository);
      return Response.status(Response.Status.OK).entity("App has been configured.").build();
    } catch (RuntimeException e) {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Error configuring app [%s]", e.getMessage()))
          .build();
    }
  }

  @POST
  @Path("/trigger/{name}")
  @Operation(
      operationId = "triggerApplicationRun",
      summary = "Trigger an Application run",
      description = "Trigger a Application run by id.",
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
          String name) {
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNER));
    App app = repository.getByName(uriInfo, name, fields);
    setAppRuntimeProperties(app);
    if (app.getAppType().equals(AppType.Internal)) {
      ApplicationHandler.triggerApplicationOnDemand(
          app, Entity.getCollectionDAO(), searchRepository);
      return Response.status(Response.Status.OK).entity("Application Triggered").build();
    } else {
      if (!app.getPipelines().isEmpty()) {
        EntityReference pipelineRef = app.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));
        ingestionPipeline.setOpenMetadataServerConnection(app.getOpenMetadataServerConnection());
        decryptOrNullify(securityContext, ingestionPipeline, app.getBot().getName(), true);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
        PipelineServiceClientResponse response =
            pipelineServiceClient.runPipeline(ingestionPipeline, service);
        return Response.status(response.getCode()).entity(response).build();
      }
    }
    throw new BadRequestException("Failed to trigger application.");
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
    EntityUtil.Fields fields = getFields(String.format("%s,bot,pipelines", FIELD_OWNER));
    App app = repository.getByName(uriInfo, name, fields);
    setAppRuntimeProperties(app);
    if (app.getAppType().equals(AppType.Internal)) {
      ApplicationHandler.installApplication(app, Entity.getCollectionDAO(), searchRepository);
      return Response.status(Response.Status.OK).entity("Application Deployed").build();
    } else {
      if (!app.getPipelines().isEmpty()) {
        EntityReference pipelineRef = app.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                uriInfo, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));

        ingestionPipeline.setOpenMetadataServerConnection(app.getOpenMetadataServerConnection());
        decryptOrNullify(securityContext, ingestionPipeline, app.getBot().getName(), true);
        ServiceEntityInterface service =
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
        PipelineServiceClientResponse status =
            pipelineServiceClient.deployPipeline(ingestionPipeline, service);
        if (status.getCode() == 200) {
          ingestionPipelineRepository.createOrUpdate(uriInfo, ingestionPipeline);
        } else {
          ingestionPipeline.setDeployed(false);
        }
        return Response.status(status.getCode()).entity(status).build();
      }
    }
    throw new BadRequestException("Failed to trigger application.");
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

  private App getApplication(
      AppMarketPlaceDefinition marketPlaceDefinition,
      CreateApp createAppRequest,
      String updatedBy) {
    EntityReference owner = repository.validateOwner(createAppRequest.getOwner());
    App app =
        new App()
            .withId(UUID.randomUUID())
            .withName(marketPlaceDefinition.getName())
            .withDisplayName(createAppRequest.getDisplayName())
            .withDescription(createAppRequest.getDescription())
            .withOwner(owner)
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis())
            .withDeveloper(marketPlaceDefinition.getDeveloper())
            .withDeveloperUrl(marketPlaceDefinition.getDeveloperUrl())
            .withPrivacyPolicyUrl(marketPlaceDefinition.getPrivacyPolicyUrl())
            .withSupportEmail(marketPlaceDefinition.getSupportEmail())
            .withClassName(marketPlaceDefinition.getClassName())
            .withAppType(marketPlaceDefinition.getAppType())
            .withScheduleType(marketPlaceDefinition.getScheduleType())
            .withAppConfiguration(createAppRequest.getAppConfiguration())
            .withRuntime(marketPlaceDefinition.getRuntime())
            .withPermission(marketPlaceDefinition.getPermission())
            .withAppSchedule(createAppRequest.getAppSchedule())
            .withAppLogoUrl(marketPlaceDefinition.getAppLogoUrl())
            .withAppScreenshots(marketPlaceDefinition.getAppScreenshots())
            .withFeatures(marketPlaceDefinition.getFeatures())
            .withSourcePythonClass(marketPlaceDefinition.getSourcePythonClass())
            .withAllowConfiguration(marketPlaceDefinition.getAllowConfiguration());

    // validate Bot if provided
    validateAndAddBot(app, createAppRequest.getBot());

    return app;
  }

  private void validateAndAddBot(App app, String botName) {
    if (!CommonUtil.nullOrEmpty(botName)) {
      app.setBot(Entity.getEntityReferenceByName(BOT, botName, Include.NON_DELETED));
    } else {
      app.setBot(repository.createNewAppBot(app));
    }
  }

  private void deleteApp(SecurityContext securityContext, App installedApp, boolean hardDelete) {
    if (installedApp.getAppType().equals(AppType.Internal)) {
      try {
        AppScheduler.getInstance().deleteScheduledApplication(installedApp);
      } catch (SchedulerException ex) {
        LOG.error("Failed in delete Application from Scheduler.", ex);
        throw new InternalServerErrorException("Failed in Delete App from Scheduler.");
      }
    } else {
      if (!nullOrEmpty(installedApp.getPipelines())) {
        EntityReference pipelineRef = installedApp.getPipelines().get(0);
        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

        IngestionPipeline ingestionPipeline =
            ingestionPipelineRepository.get(
                null, pipelineRef.getId(), ingestionPipelineRepository.getFields(FIELD_OWNER));
        try {
          if (hardDelete) {
            // Remove the Pipeline in case of Delete
            if (!nullOrEmpty(installedApp.getPipelines())) {
              pipelineServiceClient.deletePipeline(ingestionPipeline);
            }
          } else {
            // Just Kill Running ingestion
            if (Boolean.TRUE.equals(ingestionPipeline.getDeployed())) {
              decryptOrNullify(
                  securityContext, ingestionPipeline, installedApp.getBot().getName(), true);
              pipelineServiceClient.killIngestion(ingestionPipeline);
            }
          }
        } catch (Exception ex) {
          LOG.error("Failed in Pipeline Service Client : ", ex);
        }
      }
    }

    // Remove App from instances Map Lookup
    removeUninstalledApp(installedApp.getClassName());
  }
}
