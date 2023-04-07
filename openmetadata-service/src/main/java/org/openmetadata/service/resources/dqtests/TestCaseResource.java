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
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataQuality/testCases")
@Tag(
    name = "Test Cases",
    description =
        "Test case is a test definition to capture data quality tests against tables,"
            + " columns, and other data assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCases")
public class TestCaseResource extends EntityResource<TestCase, TestCaseRepository> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";

  static final String FIELDS = "owner,testSuite,testDefinition";

  @Override
  public TestCase addHref(UriInfo uriInfo, TestCase test) {
    test.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, test.getId()));
    Entity.withHref(uriInfo, test.getOwner());
    Entity.withHref(uriInfo, test.getTestSuite());
    Entity.withHref(uriInfo, test.getTestDefinition());
    return test;
  }

  @Inject
  public TestCaseResource(CollectionDAO dao, Authorizer authorizer) {
    super(TestCase.class, new TestCaseRepository(dao), authorizer);
  }

  public static class TestCaseList extends ResultList<TestCase> {
    @SuppressWarnings("unused")
    public TestCaseList() {
      // Empty constructor needed for deserialization
    }
  }

  public static class TestCaseResultList extends ResultList<TestCaseResult> {
    @SuppressWarnings("unused")
    public TestCaseResultList() {
      /* Required for serde */
    }
  }

  @GET
  @Operation(
      operationId = "listTestCases",
      summary = "List test cases",
      description =
          "Get a list of test. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test definitions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResource.TestCaseList.class)))
      })
  public ResultList<TestCase> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number tests returned. (1 to 1000000, default = " + "10)")
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
              description = "Return list of tests by entity link",
              schema = @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>"))
          @QueryParam("entityLink")
          String entityLink,
      @Parameter(description = "Returns list of tests filtered by the testSuite id", schema = @Schema(type = "string"))
          @QueryParam("testSuiteId")
          String testSuiteId,
      @Parameter(description = "Include all the tests at the entity level", schema = @Schema(type = "boolean"))
          @QueryParam("includeAllTests")
          @DefaultValue("false")
          Boolean includeAllTests,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("testSuiteId", testSuiteId)
            .addQueryParam("includeAllTests", includeAllTests.toString());
    ResourceContextInterface resourceContext;
    if (entityLink != null) {
      EntityLink entityLinkParsed = EntityLink.parse(entityLink);
      filter.addQueryParam("entityFQN", entityLinkParsed.getFullyQualifiedFieldValue());
      resourceContext = TestCaseResourceContext.builder().entityLink(entityLinkParsed).build();
    } else {
      resourceContext = TestCaseResourceContext.builder().build();
    }

    // Override OperationContext to change the entity to table and operation from VIEW_ALL to VIEW_TESTS
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    Fields fields = getFields(fieldsParam);
    return super.listInternal(
        uriInfo, securityContext, fields, filter, limitParam, before, after, operationContext, resourceContext);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTestCaseVersion",
      summary = "List test case versions",
      description = "Get a list of all the versions of a testCases identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();

    // Override OperationContext to change the entity to table and operation from VIEW_ALL to VIEW_TESTS
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    return super.listVersionsInternal(securityContext, id, operationContext, resourceContext);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a test case by Id",
      description = "Get a TestCase by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The TestCases",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(responseCode = "404", description = "Test for instance {id} is not found")
      })
  public TestCase get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    // TODO fix hardcoded entity type
    // Override OperationContext to change the entity to table and operation from VIEW_ALL to VIEW_TESTS
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    return getInternal(uriInfo, securityContext, id, fields, include, operationContext, resourceContext);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getTestCaseByName",
      summary = "Get a test case by fully qualified name",
      description = "Get a test case by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The TestCase",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(responseCode = "404", description = "Test for instance {fqn} is not found")
      })
  public TestCase getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
    // TODO fix hardcoded entity type
    // Override OperationContext to change the entity to table and operation from VIEW_ALL to VIEW_TESTS
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    return getByNameInternal(uriInfo, securityContext, fqn, fields, include, operationContext, resourceContext);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTestCaseVersion",
      summary = "Get a version of the test case",
      description = "Get a version of the test case by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Test",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test for instance {id} and version {version} is " + "not found")
      })
  public TestCase getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Test version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    return super.getVersionInternal(securityContext, id, version, operationContext, resourceContext);
  }

  @POST
  @Operation(
      operationId = "createTestCase",
      summary = "Create a test case",
      description = "Create a test case",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestCase create)
      throws IOException {
    // Override OperationContext to change the entity to table and operation from CREATE to EDIT_TESTS
    EntityLink entityLink = EntityLink.parse(create.getEntityLink());
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName(), entityLink);
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().entityLink(entityLink).build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    test = addHref(uriInfo, dao.create(uriInfo, test));
    LOG.info("Created {}:{}", Entity.getEntityTypeFromObject(test), test.getId());
    return Response.created(test.getHref()).entity(test).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTest",
      summary = "Update a test case",
      description = "Update an existing test using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    // Override OperationContext to change the entity to table and operation from UPDATE to EDIT_TESTS
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    PatchResponse<TestCase> response = dao.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTest",
      summary = "Update test case",
      description = "Create a TestCase, it it does not exist or update an existing TestCase.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated testCase.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestCase create)
      throws IOException {
    // Override OperationContext to change the entity to table and operation from CREATE/UPDATE to EDIT_TESTS
    EntityLink entityLink = EntityLink.parse(create.getEntityLink());
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().entityLink(entityLink).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName(), entityLink);

    dao.prepareInternal(test);
    PutResponse<TestCase> response = dao.createOrUpdate(uriInfo, test);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestCase",
      summary = "Delete a test case by Id",
      description = "Delete a test case by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test case for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    // Override OperationContext to change the entity to table and operation from DELETE to EDIT_TESTS
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    DeleteResponse<TestCase> response = dao.delete(securityContext.getUserPrincipal().getName(), id, false, hardDelete);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteTestCaseByName",
      summary = "Delete a test case by fully qualified name",
      description = "Delete a testCase by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "TestCase for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted test case",
      description = "Restore a soft deleted test case.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Chart ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public Response restoreTestCase(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{fqn}/testCaseResult")
  @Operation(
      operationId = "addTestCaseResult",
      summary = "Add test case result data",
      description = "Add test case result data to the testCase.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the TestCase. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public Response addTestCaseResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid TestCaseResult testCaseResult)
      throws IOException {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.addTestCaseResult(securityContext.getUserPrincipal().getName(), uriInfo, fqn, testCaseResult)
        .toResponse();
  }

  @GET
  @Path("/{fqn}/testCaseResult")
  @Operation(
      operationId = "listTestCaseResults",
      summary = "List of test case results",
      description =
          "Get a list of all the test case results for the given testCase id, optionally filtered by  `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of testCase results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResource.TestCaseResultList.class)))
      })
  public ResultList<TestCaseResult> listTestCaseResults(
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter testCase results after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter testCase results before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    return dao.getTestCaseResults(fqn, startTs, endTs);
  }

  @DELETE
  @Path("/{fqn}/testCaseResult/{timestamp}")
  @Operation(
      operationId = "DeleteTestCaseResult",
      summary = "Delete test case result",
      description = "Delete testCase result for a testCase.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the TestCaseResult",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public Response deleteTestCaseResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Timestamp of the testCase result", schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp)
      throws IOException {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.deleteTestCaseResult(securityContext.getUserPrincipal().getName(), fqn, timestamp).toResponse();
  }

  private TestCase getTestCase(CreateTestCase create, String user, EntityLink entityLink) throws IOException {
    return copy(new TestCase(), create, user)
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withParameterValues(create.getParameterValues())
        .withEntityLink(create.getEntityLink())
        .withEntityFQN(entityLink.getFullyQualifiedFieldValue())
        .withTestSuite(getEntityReference(Entity.TEST_SUITE, create.getTestSuite()))
        .withTestDefinition(getEntityReference(Entity.TEST_DEFINITION, create.getTestDefinition()));
  }
}
