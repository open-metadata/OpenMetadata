package org.openmetadata.service.resources.apps;

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
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AppService;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
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
  static final String FIELDS = "owners";
  private AppService appService;

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      CollectionDAO dao = Entity.getCollectionDAO();
      SearchRepository searchRepository = Entity.getSearchRepository();
      AppScheduler.initialize(config, dao, searchRepository);
      this.appService = new AppService(repository, dao, searchRepository, authorizer, config);
      this.appService.initializeDefaultApplications();
      ApplicationContext.initialize();
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
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
    return appService.getInstalledAppsReference();
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
    return appService.listAppRuns(
        uriInfo, securityContext, name, limitParam, offset, startTs, endTs);
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
    return appService.listAppExtension(
        uriInfo, securityContext, name, limitParam, offset, startTs, extensionType, byName);
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
    return appService.getLastLogs(uriInfo, securityContext, name, after);
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
    return appService.getLatestAppRun(uriInfo, securityContext, name, after);
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
    limits.enforceLimits(
        securityContext,
        getResourceContext(),
        new OperationContext(Entity.APPLICATION, MetadataOperation.CREATE));
    return appService.createApp(uriInfo, securityContext, create);
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
    return appService.patchApp(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchApplicationByName",
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
    App app = repository.getByName(null, fqn, repository.getFields("id"));
    return appService.patchApp(uriInfo, securityContext, app.getId(), patch);
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
    return appService.createOrUpdateApp(uriInfo, securityContext, create);
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
    limits.invalidateCache(entityType);
    return appService.deleteApp(uriInfo, securityContext, name, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "uninstallAppById",
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
    return appService.deleteAppById(uriInfo, securityContext, id, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "uninstallAppByIdAsync",
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
    return appService.deleteAppAsync(uriInfo, securityContext, id, true, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted App",
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
    return appService.restoreApp(uriInfo, securityContext, restore);
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
    return appService.scheduleApp(uriInfo, securityContext, name);
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
    return appService.configureApp(uriInfo, securityContext, name);
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
    return appService.triggerApp(uriInfo, securityContext, name, configPayload);
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
    return appService.stopApp(uriInfo, securityContext, name);
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
    return appService.deployApp(uriInfo, securityContext, name);
  }

  @POST
  @Path("/{appId}/serviceConfiguration")
  @Operation(
      operationId = "addServiceConfiguration",
      summary = "Add service configuration for service-bound app",
      description = "Add a new service configuration for a service-bound application.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Service configuration added successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Response.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "Application not found")
      })
  public Response addServiceConfiguration(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("appId")
          UUID appId,
      @RequestBody(
              description = "Service configuration to add",
              content = @Content(mediaType = MediaType.APPLICATION_JSON))
          Map<String, Object> serviceConfig) {
    return appService.addServiceConfiguration(uriInfo, securityContext, appId, serviceConfig);
  }

  @DELETE
  @Path("/{appId}/serviceConfiguration/{serviceId}")
  @Operation(
      operationId = "removeServiceConfiguration",
      summary = "Remove service configuration for service-bound app",
      description = "Remove a service configuration by serviceId for a service-bound application.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Service configuration removed successfully"),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(
            responseCode = "404",
            description = "Application or service configuration not found")
      })
  public Response removeServiceConfiguration(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("appId")
          UUID appId,
      @Parameter(description = "Id of the Service", schema = @Schema(type = "UUID"))
          @PathParam("serviceId")
          UUID serviceId) {
    return appService.removeServiceConfiguration(uriInfo, securityContext, appId, serviceId);
  }
}
