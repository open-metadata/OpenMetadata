package org.openmetadata.service.resources.apps;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.services.apps.AppService.FIELDS;
import static org.openmetadata.service.services.apps.AppService.SCHEDULED_TYPES;

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
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.apps.AppService;
import org.quartz.SchedulerException;

@Path("/v1/apps")
@Tag(
    name = "Apps",
    description = "Apps are internal/external apps used to something on top of Open-metadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apps", order = 8, entityType = Entity.APPLICATION)
public class AppResource {
  public static final String COLLECTION_PATH = "v1/apps/";
  private final AppService service;

  public AppResource(AppService service) {
    this.service = service;
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
                    schema = @Schema(implementation = AppService.AppList.class)))
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
      @Parameter(
              description =
                  "Filter by agent type(s). Can be a single value or comma-separated values",
              schema = @Schema(type = "string"))
          @QueryParam("agentType")
          String agentTypes,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("agentType", agentTypes);
    return service.listInternal(
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
                    schema = @Schema(implementation = AppService.AppRefList.class)))
      })
  public List<EntityReference> list(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return service.listAllAppsReference();
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
                    schema = @Schema(implementation = AppService.AppRunList.class)))
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
    return service.listAppRunsForApp(uriInfo, name, limitParam, offset, startTs, endTs);
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
    App installation = service.getByName(uriInfo, name, service.getFields("id"));
    if (startTs != null) {
      ResultList<AppExtension> appExtensionList =
          byName
              ? service.listAppExtensionAfterTimeByName(
                  installation, startTs, limitParam, offset, AppExtension.class, extensionType)
              : service.listAppExtensionAfterTimeById(
                  installation, startTs, limitParam, offset, AppExtension.class, extensionType);
      return Response.status(Response.Status.OK).entity(appExtensionList).build();
    }

    ResultList<AppExtension> appExtensionList =
        byName
            ? service.listAppExtensionByName(
                installation, limitParam, offset, AppExtension.class, extensionType)
            : service.listAppExtensionById(
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
    return service.getLastLogs(uriInfo, securityContext, name, after);
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
    return service.getLatestAppRunResponse(uriInfo, name, after);
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
    return service.listVersionsInternal(securityContext, id);
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
    App app = service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
    if (include != Include.DELETED && !Boolean.TRUE.equals(app.getDeleted())) {
      return ApplicationHandler.getInstance()
          .appWithDecryptedAppConfiguration(
              app, Entity.getCollectionDAO(), service.getSearchRepository());
    } else {
      return app;
    }
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
    App app = service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    if (include != Include.DELETED && !Boolean.TRUE.equals(app.getDeleted())) {
      return ApplicationHandler.getInstance()
          .appWithDecryptedAppConfiguration(
              app, Entity.getCollectionDAO(), service.getSearchRepository());
    } else {
      return app;
    }
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
    return service.getVersionInternal(securityContext, id, version);
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
    App app =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    service
        .getLimits()
        .enforceLimits(
            securityContext,
            service.getResourceContext(),
            new OperationContext(APPLICATION, MetadataOperation.CREATE));
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              Entity.getCollectionDAO(),
              service.getSearchRepository(),
              securityContext.getUserPrincipal().getName());
    }
    service.unsetAppRuntimeProperties(app);
    return service.create(uriInfo, securityContext, app);
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
    App app = service.get(null, id, service.getFields("bot,pipelines"), Include.NON_DELETED, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(app.getName(), "SystemApp"));
    }
    AppScheduler.getInstance().deleteScheduledApplication(app);
    Response response = service.patchInternal(uriInfo, securityContext, id, patch);
    App updatedApp = (App) response.getEntity();
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              updatedApp,
              Entity.getCollectionDAO(),
              service.getSearchRepository(),
              securityContext.getUserPrincipal().getName());
    }
    service.unsetAppRuntimeProperties(updatedApp);
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
    App app =
        service.getByName(
            null, fqn, service.getFields("bot,pipelines"), Include.NON_DELETED, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(app.getName(), "SystemApp"));
    }
    AppScheduler.getInstance().deleteScheduledApplication(app);
    Response response = service.patchInternal(uriInfo, securityContext, fqn, patch);
    App updatedApp = (App) response.getEntity();
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              updatedApp,
              Entity.getCollectionDAO(),
              service.getSearchRepository(),
              securityContext.getUserPrincipal().getName());
    }
    service.unsetAppRuntimeProperties(updatedApp);
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
    App app =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    AppScheduler.getInstance().deleteScheduledApplication(app);
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(
              app,
              Entity.getCollectionDAO(),
              service.getSearchRepository(),
              securityContext.getUserPrincipal().getName());
    }
    service.unsetAppRuntimeProperties(app);
    return service.createOrUpdate(uriInfo, securityContext, app);
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
    App app = service.getByName(uriInfo, name, service.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    ApplicationHandler.getInstance()
        .performCleanup(
            app,
            Entity.getCollectionDAO(),
            service.getSearchRepository(),
            securityContext.getUserPrincipal().getName());

    service.getLimits().invalidateCache(APPLICATION);
    service.deleteApp(securityContext, app);
    return service.deleteByName(uriInfo, securityContext, name, true, hardDelete);
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
    App app = service.get(uriInfo, id, service.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }

    ApplicationHandler.getInstance()
        .performCleanup(
            app,
            Entity.getCollectionDAO(),
            service.getSearchRepository(),
            securityContext.getUserPrincipal().getName());

    service.deleteApp(securityContext, app);
    return service.delete(uriInfo, securityContext, id, true, hardDelete);
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
    App app = service.get(uriInfo, id, service.getFields("bot,pipelines"), ALL, false);
    if (app.getSystem()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(app.getName(), "SystemApp"));
    }
    return service.deleteAppAsync(uriInfo, securityContext, id, true, hardDelete);
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
    Response response = service.restoreEntity(uriInfo, securityContext, restore.getId());
    if (response.getStatus() == Response.Status.OK.getStatusCode()) {
      App app = (App) response.getEntity();
      if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
        ApplicationHandler.getInstance()
            .installApplication(
                app,
                Entity.getCollectionDAO(),
                service.getSearchRepository(),
                securityContext.getUserPrincipal().getName());
      }
      service.unsetAppRuntimeProperties(app);
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
    return service.scheduleApplication(uriInfo, securityContext, name);
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
    return service.configureApplication(uriInfo, name);
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
    return service.triggerApplicationRun(uriInfo, securityContext, name, configPayload);
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
    return service.stopApplicationRun(uriInfo, securityContext, name);
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
    return service.deployApplicationFlow(uriInfo, securityContext, name);
  }
}
