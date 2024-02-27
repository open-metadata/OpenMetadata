package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.schema.type.Include.ALL;

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
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataQuality/testSuites")
@Tag(
    name = "Test Suites",
    description = "`TestSuite` is a set of test cases grouped together to capture data quality.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestSuites")
public class TestSuiteResource extends EntityResource<TestSuite, TestSuiteRepository> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testSuites";
  public static final String EXECUTABLE_TEST_SUITE_DELETION_ERROR =
      "Cannot delete logical test suite. To delete logical test suite, use DELETE /v1/dataQuality/testSuites/<...>";
  public static final String NON_EXECUTABLE_TEST_SUITE_DELETION_ERROR =
      "Cannot delete executable test suite. To delete executable test suite, use DELETE /v1/dataQuality/testSuites/executable/<...>";

  static final String FIELDS = "owner,tests,summary";

  public TestSuiteResource(Authorizer authorizer) {
    super(Entity.TEST_SUITE, authorizer);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("tests", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class TestSuiteList extends ResultList<TestSuite> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listTestSuites",
      summary = "List test suites",
      description =
          "Get a list of test suites. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test definitions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuiteResource.TestSuiteList.class)))
      })
  public ResultList<TestSuite> list(
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
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description =
                  "Returns executable or logical test suites. If omitted, returns all test suites.",
              schema = @Schema(type = "string", example = "executable"))
          @QueryParam("testSuiteType")
          String testSuiteType,
      @Parameter(
              description = "Include empty test suite in the response.",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("includeEmptyTestSuites")
          @DefaultValue("true")
          Boolean includeEmptyTestSuites,
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
          Include include) {
    ListFilter filter = new ListFilter(include);
    filter.addQueryParam("testSuiteType", testSuiteType);
    filter.addQueryParam("includeEmptyTestSuites", includeEmptyTestSuites);
    EntityUtil.Fields fields = getFields(fieldsParam);

    ResourceContext<?> resourceContext = getResourceContext();
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);

    return super.listInternal(
        uriInfo,
        securityContext,
        fields,
        filter,
        limitParam,
        before,
        after,
        operationContext,
        resourceContext);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTestSuiteVersion",
      summary = "List test suite versions",
      description = "Get a list of all the versions of a test suite identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test suite versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a test suite by Id",
      description = "Get a Test Suite by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Test suite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Suite for instance {id} is not found")
      })
  public TestSuite get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID"))
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getTestSuiteByName",
      summary = "Get a test suite by name",
      description = "Get a test suite by  name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test suite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Suite for instance {name} is not found")
      })
  public TestSuite getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the test suite", schema = @Schema(type = "string"))
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
      operationId = "getSpecificTestSuiteVersion",
      summary = "Get a version of the test suite",
      description = "Get a version of the test suite by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "TestSuite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Suite for instance {id} and version {version} is not found")
      })
  public TestSuite getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Test Suite version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @GET
  @Path("/executionSummary")
  @Operation(
      operationId = "getExecutionSummaryOfTestSuites",
      summary = "Get the execution summary of test suites",
      description = "Get the execution summary of test suites.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Tests Execution Summary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSummary.class)))
      })
  public TestSummary getTestsExecutionSummary(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "get summary for a specific test suite",
              schema = @Schema(type = "String", format = "uuid"))
          @QueryParam("testSuiteId")
          UUID testSuiteId)
      throws IOException {
    ResourceContext<?> resourceContext = getResourceContext();
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.getTestSummary(testSuiteId);
  }

  @POST
  @Operation(
      operationId = "createLogicalTestSuite",
      summary = "Create a logical test suite",
      description = "Create a logical test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test suite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestSuite create) {
    create =
        create.withExecutableEntityReference(
            null); // entity reference is not applicable for logical test suites
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    testSuite.setExecutable(false);
    return create(uriInfo, securityContext, testSuite);
  }

  @POST
  @Path("/executable")
  @Operation(
      operationId = "createExecutableTestSuite",
      summary = "Create an executable test suite",
      description = "Create an executable test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Executable test suite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createExecutable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestSuite create) {
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    testSuite.setExecutable(true);
    return create(uriInfo, securityContext, testSuite);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTestSuite",
      summary = "Update a test suite",
      description = "Update an existing testSuite using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID"))
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
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateLogicalTestSuite",
      summary = "Update logical test suite",
      description =
          "Create a logical TestSuite, if it does not exist or update an existing test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestSuite create) {
    create =
        create.withExecutableEntityReference(
            null); // entity reference is not applicable for logical test suites
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    testSuite.setExecutable(false);
    return createOrUpdate(uriInfo, securityContext, testSuite);
  }

  @PUT
  @Path("/executable")
  @Operation(
      operationId = "createOrUpdateExecutableTestSuite",
      summary = "Create or Update Executable test suite",
      description =
          "Create an Executable TestSuite if it does not exist or update an existing one.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class)))
      })
  public Response createOrUpdateExecutable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestSuite create) {
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    testSuite.setExecutable(true);
    return createOrUpdate(uriInfo, securityContext, testSuite);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteLogicalTestSuite",
      summary = "Delete a logical test suite",
      description = "Delete a logical test suite by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Logical test suite for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the logical entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the logical test suite", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, id, "*", ALL);
    if (Boolean.TRUE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException(NON_EXECUTABLE_TEST_SUITE_DELETION_ERROR);
    }
    RestUtil.DeleteResponse<TestSuite> response =
        repository.deleteLogicalTestSuite(securityContext, testSuite, hardDelete);
    repository.deleteFromSearch(response.entity(), response.changeType());
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteLogicalTestSuite",
      summary = "Delete a logical test suite",
      description = "Delete a logical test suite by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Logical Test suite for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the logical entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "FQN of the logical test suite", schema = @Schema(type = "String"))
          @PathParam("name")
          String name) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    TestSuite testSuite = Entity.getEntityByName(Entity.TEST_SUITE, name, "*", ALL);
    if (Boolean.TRUE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException(NON_EXECUTABLE_TEST_SUITE_DELETION_ERROR);
    }
    RestUtil.DeleteResponse<TestSuite> response =
        repository.deleteLogicalTestSuite(securityContext, testSuite, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  @DELETE
  @Path("/executable/name/{name}")
  @Operation(
      operationId = "deleteTestSuiteByName",
      summary = "Delete a test suite",
      description = "Delete a test suite by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Test suite for instance {name} is not found")
      })
  public Response deleteExecutable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the test suite", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    TestSuite testSuite = Entity.getEntityByName(Entity.TEST_SUITE, name, "*", ALL);
    if (Boolean.FALSE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException(EXECUTABLE_TEST_SUITE_DELETION_ERROR);
    }
    RestUtil.DeleteResponse<TestSuite> response =
        repository.deleteByName(
            securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  @DELETE
  @Path("/executable/{id}")
  @Operation(
      operationId = "deleteTestSuite",
      summary = "Delete a test suite",
      description = "Delete a test suite by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Test suite for instance {id} is not found")
      })
  public Response deleteExecutable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, id, "*", ALL);
    if (Boolean.FALSE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException(EXECUTABLE_TEST_SUITE_DELETION_ERROR);
    }
    RestUtil.DeleteResponse<TestSuite> response =
        repository.delete(securityContext.getUserPrincipal().getName(), id, recursive, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted test suite",
      description = "Restore a soft deleted test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the TestSuite.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class)))
      })
  public Response restoreTestSuite(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private TestSuite getTestSuite(CreateTestSuite create, String user) {
    TestSuite testSuite =
        repository
            .copy(new TestSuite(), create, user)
            .withDescription(create.getDescription())
            .withDisplayName(create.getDisplayName())
            .withName(create.getName());
    if (create.getExecutableEntityReference() != null) {
      Table table =
          Entity.getEntityByName(Entity.TABLE, create.getExecutableEntityReference(), null, null);
      EntityReference entityReference =
          new EntityReference()
              .withId(table.getId())
              .withFullyQualifiedName(table.getFullyQualifiedName())
              .withName(table.getName())
              .withType(Entity.TABLE);
      testSuite.setExecutableEntityReference(entityReference);
    }
    return testSuite;
  }
}
