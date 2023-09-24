package org.openmetadata.service.resources.apps;

import static org.openmetadata.service.Entity.FIELD_OWNER;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
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
import lombok.SneakyThrows;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.app.CreateAppSchedule;
import org.openmetadata.schema.entity.app.CreateApplication;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AppRepository;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.unitofwork.JdbiUnitOfWorkProvider;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;
import org.quartz.SchedulerException;

@Path("/v1/apps")
@Tag(name = "Apps", description = "Apps are internal/external apps used to something on top of Open-metadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apps")
public class AppResource extends EntityResource<Application, AppRepository> {
  public static final String COLLECTION_PATH = "v1/apps/";
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private PipelineServiceClient pipelineServiceClient;
  static final String FIELDS = "owner";
  private SearchClient searchClient;

  @Override
  @SneakyThrows
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(config.getPipelineServiceClientConfiguration());

    // Create an On Demand DAO
    CollectionDAO dao = JdbiUnitOfWorkProvider.getInstance().getHandle().getJdbi().onDemand(CollectionDAO.class);
    searchClient = IndexUtil.getSearchClient(config.getElasticSearchConfiguration(), dao);
    AppScheduler.initialize(dao, searchClient);
  }

  public AppResource(CollectionDAO dao, Authorizer authorizer) {
    super(Application.class, new AppRepository(dao), authorizer);
  }

  public static class AppList extends ResultList<Application> {
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
            description = "List of KPIs",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AppList.class)))
      })
  public ResultList<Application> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of installed applications returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tests before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tests after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the app", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {id} is not found")
      })
  public Application get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {name} is not found")
      })
  public Application getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the App", schema = @Schema(type = "string")) @PathParam("name") String name,
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class))),
        @ApiResponse(
            responseCode = "404",
            description = "App for instance {id} and version {version} is " + "not found")
      })
  public Application getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "KPI version number in the form `major`.`minor`",
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateApplication create) {
    Application app = getApplication(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, app);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchApplication",
      summary = "Updates a App",
      description = "Update an existing App using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchApplication(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateApplication create) {
    Application app = getApplication(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, app);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteAppByName",
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
      @Parameter(description = "Name of the App", schema = @Schema(type = "string")) @PathParam("name") String name) {
    return deleteByName(uriInfo, securityContext, name, true, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteApp",
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
      @Parameter(description = "Id of the App", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Application.class)))
      })
  public Response restoreApp(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @POST
  @Path("/schedule/{id}")
  @Operation(
      operationId = "scheduleApplication",
      summary = "Schedule an Application",
      description = "Schedule a application to be run on demand.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Response.class))),
        @ApiResponse(responseCode = "404", description = "Application for instance {id} is not found")
      })
  public Response scheduleApplication(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Application", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Context SecurityContext securityContext,
      @Valid CreateAppSchedule create) {
    AppSchedule appSchedule =
        new AppSchedule()
            .withScheduleId(UUID.randomUUID())
            .withScheduleType(create.getScheduleType())
            .withCronExpression(create.getCronExpression());
    return repository.addApplicationSchedule(uriInfo, id, appSchedule).toResponse();
  }

  @DELETE
  @Path("/schedule/{appId}")
  @Operation(
      operationId = "deleteApplicationSchedule",
      summary = "Delete an Application Schedule",
      description = "Schedule a application to be run on demand.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Response.class))),
        @ApiResponse(responseCode = "404", description = "Application for instance {id} is not found")
      })
  public Response deleteApplicationSchedule(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Application", schema = @Schema(type = "UUID")) @PathParam("appId") UUID appId,
      @Context SecurityContext securityContext)
      throws SchedulerException {
    return repository.deleteApplicationSchedule(uriInfo, appId).toResponse();
  }

  @POST
  @Path("/onDemand/{id}")
  @Operation(
      operationId = "triggerApplication",
      summary = "Trigger an Application on demand",
      description = "Trigger a application to be run on demand.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Application",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Response.class))),
        @ApiResponse(responseCode = "404", description = "Application for instance {id} is not found")
      })
  public Response triggerApplicationOnDemand(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Application pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    EntityUtil.Fields fields = getFields(FIELD_OWNER);
    Application application = repository.get(uriInfo, id, fields);
    ApplicationHandler.triggerApplicationOnDemand(
        application, JdbiUnitOfWorkProvider.getInstance().getHandle().getJdbi().onDemand(CollectionDAO.class));
    return Response.status(Response.Status.CREATED).entity(null).build();
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      operationId = "triggerApplicationExternal",
      summary = "Trigger an Application run",
      description = "Trigger a Application run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Application trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Application for instance {id} is not found")
      })
  public PipelineServiceClientResponse runAutomationsWorkflow(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Context SecurityContext securityContext) {
    EntityUtil.Fields fields = getFields(String.format("%s,%s", FIELD_OWNER, "bot"));
    Application app = repository.get(uriInfo, id, fields);
    app.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, app.getBot().getName()).build());
    return pipelineServiceClient.runApplicationFlow(app);
  }

  private Application getApplication(CreateApplication create, String updatedBy) {
    return copy(new Application(), create, updatedBy)
        .withDeveloper(create.getDeveloper())
        .withDeveloperUrl(create.getDeveloperUrl())
        .withAppType(create.getAppType())
        .withExecutionContext(create.getExecutionContext())
        .withConfiguration(create.getConfiguration())
        .withBot(create.getBot());
  }
}
