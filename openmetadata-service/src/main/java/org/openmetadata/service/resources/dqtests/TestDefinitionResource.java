package org.openmetadata.service.resources.dqtests;

import com.google.inject.Inject;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/testDefinitions")
@Tag(
    name = "Test Definitions",
    description =
        "`Test Definition` is a definition of a type of test using which test cases are created "
            + "that run against data to capture data quality.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestDefinitions")
public class TestDefinitionResource extends EntityResource<TestDefinition, TestDefinitionRepository> {
  public static final String COLLECTION_PATH = "/v1/testDefinitions";
  static final String FIELDS = "owner";

  @Override
  public TestDefinition addHref(UriInfo uriInfo, TestDefinition testDefinition) {
    testDefinition.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, testDefinition.getId()));
    Entity.withHref(uriInfo, testDefinition.getOwner());
    return testDefinition;
  }

  @Inject
  public TestDefinitionResource(CollectionDAO dao, Authorizer authorizer) {
    super(TestDefinition.class, new TestDefinitionRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find tag definitions and load classification from the json file, if necessary
    List<TestDefinition> testDefinitions = dao.getEntitiesFromSeedData(".*json/data/tests/.*\\.json$");
    for (TestDefinition testDefinition : testDefinitions) {
      dao.initializeEntity(testDefinition);
    }
  }

  public static class TestDefinitionList extends ResultList<TestDefinition> {
    @SuppressWarnings("unused")
    public TestDefinitionList() {
      // Empty constructor needed for deserialization
    }
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
                    schema = @Schema(implementation = TestDefinitionResource.TestDefinitionList.class)))
      })
  public ResultList<TestDefinition> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number test definitions returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of test definitions before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of test definitions after this cursor", schema = @Schema(type = "string"))
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
      @Parameter(description = "Filter by a test platform", schema = @Schema(implementation = TestPlatform.class))
          @QueryParam("testPlatform")
          String testPlatformParam,
      @Parameter(
              description = "Filter tests definition by supported data type",
              schema = @Schema(implementation = ColumnDataType.class))
          @QueryParam("supportedDataType")
          String supportedDataTypeParam)
      throws IOException {
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
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Test Definition for instance {id} is not found")
      })
  public TestDefinition get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Test Definition for instance {name} is not found")
      })
  public TestDefinition getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the test definition", schema = @Schema(type = "string")) @PathParam("name")
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Definition for instance {id} and version {version} is " + "not found")
      })
  public TestDefinition getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Test Definition version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestDefinition create)
      throws IOException {
    TestDefinition testDefinition = getTestDefinition(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, testDefinition);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTestDefinition",
      summary = "Update a test definition",
      description = "Update an existing Test Definition using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTestDefinition",
      summary = "Update test definition",
      description = "Create a test definition, if it does not exist, or update an existing test definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestDefinition create)
      throws IOException {
    TestDefinition testDefinition = getTestDefinition(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, testDefinition);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestDefinition",
      summary = "Delete a test definition",
      description = "Delete a test definition by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test definition for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the test definition", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTestDefinitionByName",
      summary = "Delete a test definition",
      description = "Delete a test definition by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test definition for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the test definition", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class)))
      })
  public Response restoreTestDefinition(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private TestDefinition getTestDefinition(CreateTestDefinition create, String user) throws IOException {
    return copy(new TestDefinition(), create, user)
        .withDescription(create.getDescription())
        .withEntityType(create.getEntityType())
        .withTestPlatforms(create.getTestPlatforms())
        .withSupportedDataTypes(create.getSupportedDataTypes())
        .withDisplayName(create.getDisplayName())
        .withParameterDefinition(create.getParameterDefinition())
        .withName(create.getName());
  }
}
