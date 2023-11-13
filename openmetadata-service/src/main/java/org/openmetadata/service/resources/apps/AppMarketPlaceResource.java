package org.openmetadata.service.resources.apps;

import static org.openmetadata.service.Entity.APPLICATION;
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
import java.util.List;
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
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Path("/v1/apps/marketplace")
@Tag(name = "Apps", description = "Apps marketplace holds to application available for Open-metadata")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apps/marketplace", order = 8)
@Slf4j
public class AppMarketPlaceResource extends EntityResource<AppMarketPlaceDefinition, AppMarketPlaceRepository> {
  public static final String COLLECTION_PATH = "/v1/apps/marketplace/";
  private PipelineServiceClient pipelineServiceClient;

  static final String FIELDS = "owner,tags";

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      this.pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(config.getPipelineServiceClientConfiguration());

      // Initialize Default Installed Applications
      List<CreateAppMarketPlaceDefinitionReq> createAppMarketPlaceDefinitionReqs =
          getEntitiesFromSeedData(
              APPLICATION,
              String.format(".*json/data/%s/.*\\.json$", entityType),
              CreateAppMarketPlaceDefinitionReq.class);
      for (CreateAppMarketPlaceDefinitionReq definitionReq : createAppMarketPlaceDefinitionReqs) {
        AppMarketPlaceDefinition definition = getApplicationDefinition(definitionReq, "admin");
        // Update Fully Qualified Name
        repository.setFullyQualifiedName(definition);
        this.repository.createOrUpdate(null, definition);
      }
    } catch (Exception ex) {
      LOG.error("Failed in initializing App MarketPlace Resource", ex);
    }
  }

  public AppMarketPlaceResource(Authorizer authorizer) {
    super(Entity.APP_MARKET_PLACE_DEF, authorizer);
  }

  public static class AppMarketPlaceDefinitionList extends ResultList<AppMarketPlaceDefinition> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listApplications",
      summary = "List application",
      description =
          "Get a list of applications. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KPIs",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppMarketPlaceDefinitionList.class)))
      })
  public ResultList<AppMarketPlaceDefinition> list(
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppMarketPlaceDefinition.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {id} is not found")
      })
  public AppMarketPlaceDefinition get(
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppMarketPlaceDefinition.class))),
        @ApiResponse(responseCode = "404", description = "App for instance {name} is not found")
      })
  public AppMarketPlaceDefinition getByName(
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = App.class))),
        @ApiResponse(
            responseCode = "404",
            description = "App for instance {id} and version {version} is " + "not found")
      })
  public AppMarketPlaceDefinition getVersion(
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppMarketPlaceDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAppMarketPlaceDefinitionReq create) {
    AppMarketPlaceDefinition app = getApplicationDefinition(create, securityContext.getUserPrincipal().getName());
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = App.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAppMarketPlaceDefinitionReq create) {
    AppMarketPlaceDefinition app = getApplicationDefinition(create, securityContext.getUserPrincipal().getName());
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AppMarketPlaceDefinition.class)))
      })
  public Response restoreApp(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private AppMarketPlaceDefinition getApplicationDefinition(
      CreateAppMarketPlaceDefinitionReq create, String updatedBy) {
    AppMarketPlaceDefinition app =
        repository
            .copy(new AppMarketPlaceDefinition(), create, updatedBy)
            .withDeveloper(create.getDeveloper())
            .withDeveloperUrl(create.getDeveloperUrl())
            .withSupportEmail(create.getSupportEmail())
            .withPrivacyPolicyUrl(create.getPrivacyPolicyUrl())
            .withClassName(create.getClassName())
            .withAppType(create.getAppType())
            .withScheduleType(create.getScheduleType())
            .withRuntime(create.getRuntime())
            .withAppConfiguration(create.getAppConfiguration())
            .withPermission(create.getPermission())
            .withAppLogoUrl(create.getAppLogoUrl())
            .withAppScreenshots(create.getAppScreenshots())
            .withFeatures(create.getFeatures())
            .withSourcePythonClass(create.getSourcePythonClass());

    // Validate App
    validateApplication(app);
    return app;
  }

  private void validateApplication(AppMarketPlaceDefinition app) {
    // Check if the className Exists in classPath
    if (app.getAppType().equals(AppType.Internal)) {
      // Check class name exists
      try {
        Class.forName(app.getClassName());
      } catch (ClassNotFoundException e) {
        throw new BadRequestException(
            "Application Cannot be registered, because the classname cannot be found on the Classpath.");
      }
    } else {
      PipelineServiceClientResponse response = pipelineServiceClient.validateAppRegistration(app);
      if (response.getCode() != 200) {
        throw new BadRequestException(
            String.format(
                "Application Cannot be registered, Error from Pipeline Service Client. Status Code : %s , Reponse : %s",
                response.getCode(), JsonUtils.pojoToJson(response)));
      }
    }
  }
}
