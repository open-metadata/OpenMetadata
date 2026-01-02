package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.service.services.dqtests.TestDefinitionService.FIELDS;

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
import java.io.IOException;
import java.util.UUID;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.dqtests.TestDefinitionService;

@Path("/v1/dataQuality/testDefinitions")
@Tag(
    name = "Test Definitions",
    description =
        "`Test Definition` is a definition of a type of test using which test cases are created "
            + "that run against data to capture data quality.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestDefinitions")
public class TestDefinitionResource {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testDefinitions";
  private final TestDefinitionService service;

  public TestDefinitionResource(TestDefinitionService service) {
    this.service = service;
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    service.initialize();
  }

  @GET
  @Operation(
      operationId = "listTestDefinitions",
      summary = "List test definitions",
      description =
          "Get a list of test definitions, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test definitions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(implementation = TestDefinitionService.TestDefinitionList.class)))
      })
  public ResultList<TestDefinition> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number test definitions returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of test definitions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of test definitions after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description = "Filter by entityType.",
              schema = @Schema(implementation = TestDefinitionEntityType.class))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description = "Filter by a test platform",
              schema = @Schema(implementation = TestPlatform.class))
          @QueryParam("testPlatform")
          String testPlatformParam,
      @Parameter(
              description = "Filter tests definition by supported data type",
              schema = @Schema(implementation = ColumnDataType.class))
          @QueryParam("supportedDataType")
          String supportedDataTypeParam,
      @Parameter(
              description =
                  "Filter test definitions by supported service. Returns test definitions that either "
                      + "have an empty supportedServices list (supporting all services) or include the specified service.")
          @QueryParam("supportedService")
          String supportedServiceParam) {
    ListFilter filter = new ListFilter(include);
    if (entityType != null) {
      filter.addQueryParam("entityType", entityType);
    }
    if (testPlatformParam != null) {
      filter.addQueryParam("testPlatform", testPlatformParam);
    }
    if (supportedDataTypeParam != null) {
      filter.addQueryParam("supportedDataType", supportedDataTypeParam);
    }
    if (supportedServiceParam != null) {
      filter.addQueryParam("supportedService", supportedServiceParam);
    }
    return service.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTestDefinitionVersion",
      summary = "List test definition versions",
      description = "Get a list of all the versions of a test definition identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test definition versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a test definition by Id",
      description = "Get a Test Definition by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Test definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Definition for instance {id} is not found")
      })
  public TestDefinition get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
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
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getTestDefinitionByName",
      summary = "Get a test definition by name",
      description = "Get a test definition by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Definition for instance {name} is not found")
      })
  public TestDefinition getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the test definition", schema = @Schema(type = "string"))
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
    return service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTestDefinitionVersion",
      summary = "Get a version of the test definition",
      description = "Get a version of the test definition by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "TestDefinition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Definition for instance {id} and version {version} is not found")
      })
  public TestDefinition getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Test Definition version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return service.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTestDefinition",
      summary = "Create a test definition",
      description = "Create a Test definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestDefinition create) {
    TestDefinition testDefinition =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.create(uriInfo, securityContext, testDefinition);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTestDefinition",
      summary = "Update a test definition",
      description = "Update an existing Test Definition using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return service.patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTestDefinition",
      summary = "Update test definition",
      description =
          "Create a test definition, if it does not exist, or update an existing test definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestDefinition create) {
    TestDefinition testDefinition =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createOrUpdate(uriInfo, securityContext, testDefinition);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestDefinition",
      summary = "Delete a test definition",
      description = "Delete a test definition by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Test definition for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteTestDefinitionAsync",
      summary = "Asynchronously delete a test definition",
      description = "Asynchronously delete a test definition by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Test definition for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTestDefinitionByName",
      summary = "Delete a test definition",
      description = "Delete a test definition by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Test definition for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Name of the test definition", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return service.deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted test definition",
      description = "Restore a soft deleted TestDefinition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the TestDefinition. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestDefinition.class)))
      })
  public Response restoreTestDefinition(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return service.restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
