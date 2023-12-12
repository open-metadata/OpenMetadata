package org.openmetadata.service.resources.dqtests;

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
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.mask.PIIMasker;
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
  description = "Test case is a test definition to capture data quality tests against tables," +
  " columns, and other data assets."
)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCases")
public class TestCaseResource extends EntityResource<TestCase, TestCaseRepository> {

  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases";

  static final String FIELDS = "owner,testSuite,testDefinition,testSuites";

  @Override
  public TestCase addHref(UriInfo uriInfo, TestCase test) {
    super.addHref(uriInfo, test);
    Entity.withHref(uriInfo, test.getTestSuite());
    Entity.withHref(uriInfo, test.getTestDefinition());
    return test;
  }

  public TestCaseResource(Authorizer authorizer) {
    super(Entity.TEST_CASE, authorizer);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("testSuite,testDefinition", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class TestCaseList extends ResultList<TestCase> {
    /* Required for serde */
  }

  public static class TestCaseResultList extends ResultList<TestCaseResult> {
    /* Required for serde */
  }

  @GET
  @Operation(
    operationId = "listTestCases",
    summary = "List test cases",
    description = "Get a list of test. Use `fields` " +
    "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
    "entries in the list using `limit` and `before` or `after` query params." +
    "Use the `testSuite` field to get the executable Test Suite linked to this test case " +
    "or use the `testSuites` field to list test suites (executable and logical) linked.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "List of test definitions",
        content = @Content(
          mediaType = "application/json",
          schema = @Schema(implementation = TestCaseResource.TestCaseList.class)
        )
      )
    }
  )
  public ResultList<TestCase> list(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(
      description = "Fields requested in the returned resource",
      schema = @Schema(type = "string", example = FIELDS)
    ) @QueryParam("fields") String fieldsParam,
    @Parameter(description = "Limit the number tests returned. (1 to 1000000, default = 10)") @DefaultValue(
      "10"
    ) @QueryParam("limit") @Min(0) @Max(1000000) int limitParam,
    @Parameter(description = "Returns list of tests before this cursor", schema = @Schema(type = "string")) @QueryParam(
      "before"
    ) String before,
    @Parameter(description = "Returns list of tests after this cursor", schema = @Schema(type = "string")) @QueryParam(
      "after"
    ) String after,
    @Parameter(
      description = "Return list of tests by entity link",
      schema = @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>")
    ) @QueryParam("entityLink") String entityLink,
    @Parameter(
      description = "Returns list of tests filtered by the testSuite id",
      schema = @Schema(type = "string")
    ) @QueryParam("testSuiteId") String testSuiteId,
    @Parameter(
      description = "Returns the list of tests ordered by the most recent execution date",
      schema = @Schema(type = "boolean")
    ) @QueryParam("orderByLastExecutionDate") @DefaultValue("false") Boolean orderByLastExecutionDate,
    @Parameter(
      description = "Include all the tests at the entity level",
      schema = @Schema(type = "boolean")
    ) @QueryParam("includeAllTests") @DefaultValue("false") Boolean includeAllTests,
    @Parameter(
      description = "Include all, deleted, or non-deleted entities.",
      schema = @Schema(implementation = Include.class)
    ) @QueryParam("include") @DefaultValue("non-deleted") Include include
  ) {
    ListFilter filter = new ListFilter(include)
      .addQueryParam("testSuiteId", testSuiteId)
      .addQueryParam("includeAllTests", includeAllTests.toString())
      .addQueryParam("orderByLastExecutionDate", orderByLastExecutionDate.toString());
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

    ResultList<TestCase> tests = super.listInternal(
      uriInfo,
      securityContext,
      fields,
      filter,
      limitParam,
      before,
      after,
      operationContext,
      resourceContext
    );
    return PIIMasker.getTestCases(tests, authorizer, securityContext);
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class))
      )
    }
  )
  public EntityHistory listVersions(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id
  ) {
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      ),
      @ApiResponse(responseCode = "404", description = "Test for instance {id} is not found")
    }
  )
  public TestCase get(
    @Context UriInfo uriInfo,
    @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @Context SecurityContext securityContext,
    @Parameter(
      description = "Fields requested in the returned resource",
      schema = @Schema(type = "string", example = FIELDS)
    ) @QueryParam("fields") String fieldsParam,
    @Parameter(
      description = "Include all, deleted, or non-deleted entities.",
      schema = @Schema(implementation = Include.class)
    ) @QueryParam("include") @DefaultValue("non-deleted") Include include
  ) {
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      ),
      @ApiResponse(responseCode = "404", description = "Test for instance {fqn} is not found")
    }
  )
  public TestCase getByName(
    @Context UriInfo uriInfo,
    @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string")) @PathParam(
      "fqn"
    ) String fqn,
    @Context SecurityContext securityContext,
    @Parameter(
      description = "Fields requested in the returned resource",
      schema = @Schema(type = "string", example = FIELDS)
    ) @QueryParam("fields") String fieldsParam,
    @Parameter(
      description = "Include all, deleted, or non-deleted entities.",
      schema = @Schema(implementation = Include.class)
    ) @QueryParam("include") @DefaultValue("non-deleted") Include include
  ) {
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      ),
      @ApiResponse(responseCode = "404", description = "Test for instance {id} and version {version} is not found")
    }
  )
  public TestCase getVersion(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @Parameter(
      description = "Test version number in the form `major`.`minor`",
      schema = @Schema(type = "string", example = "0.1 or 1.1")
    ) @PathParam("version") String version
  ) {
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      ),
      @ApiResponse(responseCode = "400", description = "Bad request")
    }
  )
  public Response create(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Valid CreateTestCase create
  ) {
    // Override OperationContext to change the entity to table and operation from CREATE to EDIT_TESTS
    EntityLink entityLink = EntityLink.parse(create.getEntityLink());
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName(), entityLink);
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().entityLink(entityLink).build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    repository.isTestSuiteExecutable(create.getTestSuite());
    test = addHref(uriInfo, repository.create(uriInfo, test));
    return Response.created(test.getHref()).entity(test).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
    operationId = "patchTest",
    summary = "Update a test case",
    description = "Update an existing test using JsonPatch.",
    externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902")
  )
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @RequestBody(
      description = "JsonPatch with array of operations",
      content = @Content(
        mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
        examples = { @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]") }
      )
    ) JsonPatch patch
  ) {
    // Override OperationContext to change the entity to table and operation from UPDATE to EDIT_TESTS
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    PatchResponse<TestCase> response = repository.patch(
      uriInfo,
      id,
      securityContext.getUserPrincipal().getName(),
      patch
    );
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PATCH
  @Path("/{fqn}/testCaseResult/{timestamp}")
  @Operation(
    operationId = "patchTestCaseResult",
    summary = "Update a test case result",
    description = "Update an existing test case using JsonPatch.",
    externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902")
  )
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchTestCaseResult(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "fqn of the test case", schema = @Schema(type = "string")) @PathParam("fqn") String fqn,
    @Parameter(description = "Timestamp of the testCase result", schema = @Schema(type = "long")) @PathParam(
      "timestamp"
    ) Long timestamp,
    @RequestBody(
      description = "JsonPatch with array of operations",
      content = @Content(
        mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
        examples = { @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]") }
      )
    ) JsonPatch patch
  ) {
    // Override OperationContext to change the entity to table and operation from UPDATE to EDIT_TESTS
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    PatchResponse<TestCaseResult> patchResponse = repository.patchTestCaseResults(fqn, timestamp, patch);
    return patchResponse.toResponse();
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      )
    }
  )
  public Response createOrUpdate(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Valid CreateTestCase create
  ) {
    // Override OperationContext to change the entity to table and operation from CREATE/UPDATE to EDIT_TESTS
    EntityLink entityLink = EntityLink.parse(create.getEntityLink());
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().entityLink(entityLink).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName(), entityLink);
    repository.isTestSuiteExecutable(create.getTestSuite());
    repository.prepareInternal(test, true);
    PutResponse<TestCase> response = repository.createOrUpdate(uriInfo, test);
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
    }
  )
  public Response delete(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Hard delete the entity. (Default = `false`)") @QueryParam("hardDelete") @DefaultValue(
      "false"
    ) boolean hardDelete,
    @Parameter(description = "Id of the test case", schema = @Schema(type = "UUID")) @PathParam("id") UUID id
  ) {
    // Override OperationContext to change the entity to table and operation from DELETE to EDIT_TESTS
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    DeleteResponse<TestCase> response = repository.delete(
      securityContext.getUserPrincipal().getName(),
      id,
      false,
      hardDelete
    );
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
    }
  )
  public Response delete(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Hard delete the entity. (Default = `false`)") @QueryParam("hardDelete") @DefaultValue(
      "false"
    ) boolean hardDelete,
    @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string")) @PathParam(
      "fqn"
    ) String fqn
  ) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @DELETE
  @Path("/logicalTestCases/{testSuiteId}/{id}")
  @Operation(
    operationId = "deleteLogicalTestCase",
    summary = "Delete a logical test case by Id from a test suite",
    description = "Delete a logical test case by `Id` a test suite.",
    responses = {
      @ApiResponse(responseCode = "200", description = "OK"),
      @ApiResponse(responseCode = "404", description = "Logical test case for instance {id} is not found")
    }
  )
  public Response deleteLogicalTestCase(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @PathParam("testSuiteId") UUID testSuiteId,
    @PathParam("id") UUID id
  ) {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().id(id).build();
    OperationContext operationContext = new OperationContext(Entity.TEST_SUITE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    DeleteResponse<TestCase> response = repository.deleteTestCaseFromLogicalTestSuite(testSuiteId, id);
    return response.toResponse();
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      )
    }
  )
  public Response restoreTestCase(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Valid RestoreEntity restore
  ) {
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      )
    }
  )
  public Response addTestCaseResult(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string")) @PathParam(
      "fqn"
    ) String fqn,
    @Valid TestCaseResult testCaseResult
  ) {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository
      .addTestCaseResult(securityContext.getUserPrincipal().getName(), uriInfo, fqn, testCaseResult)
      .toResponse();
  }

  @GET
  @Path("/{fqn}/testCaseResult")
  @Operation(
    operationId = "listTestCaseResults",
    summary = "List of test case results",
    description = "Get a list of all the test case results for the given testCase id, optionally filtered by  `startTs` and `endTs` of the profile. " +
    "Use cursor-based pagination to limit the number of " +
    "entries in the list using `limit` and `before` or `after` query params.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "List of testCase results",
        content = @Content(
          mediaType = "application/json",
          schema = @Schema(implementation = TestCaseResource.TestCaseResultList.class)
        )
      )
    }
  )
  public ResultList<TestCaseResult> listTestCaseResults(
    @Context SecurityContext securityContext,
    @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string")) @PathParam(
      "fqn"
    ) String fqn,
    @Parameter(
      description = "Filter testCase results after the given start timestamp",
      schema = @Schema(type = "number")
    ) @NonNull @QueryParam("startTs") Long startTs,
    @Parameter(
      description = "Filter testCase results before the given end timestamp",
      schema = @Schema(type = "number")
    ) @NonNull @QueryParam("endTs") Long endTs
  ) {
    return repository.getTestCaseResults(fqn, startTs, endTs);
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
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))
      )
    }
  )
  public Response deleteTestCaseResult(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Fully qualified name of the test case", schema = @Schema(type = "string")) @PathParam(
      "fqn"
    ) String fqn,
    @Parameter(description = "Timestamp of the testCase result", schema = @Schema(type = "long")) @PathParam(
      "timestamp"
    ) Long timestamp
  ) {
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().name(fqn).build();
    OperationContext operationContext = new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.deleteTestCaseResult(securityContext.getUserPrincipal().getName(), fqn, timestamp).toResponse();
  }

  @PUT
  @Path("/logicalTestCases")
  @Operation(
    operationId = "addTestCasesToLogicalTestSuite",
    summary = "Add test cases to a logical test suite",
    description = "Add test cases to a logical test suite.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "Successfully added test cases to the logical test suite.",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class))
      )
    }
  )
  public Response addTestCasesToLogicalTestSuite(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Valid CreateLogicalTestCases createLogicalTestCases
  ) {
    // don't get entity from cache as test result summary may be stale
    TestSuite testSuite = Entity.getEntity(
      Entity.TEST_SUITE,
      createLogicalTestCases.getTestSuiteId(),
      null,
      null,
      false
    );
    OperationContext operationContext = new OperationContext(Entity.TEST_SUITE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface resourceContext = TestCaseResourceContext.builder().entity(testSuite).build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    if (Boolean.TRUE.equals(testSuite.getExecutable())) {
      throw new IllegalArgumentException("You are trying to add test cases to an executable test suite.");
    }
    List<UUID> testCaseIds = createLogicalTestCases.getTestCaseIds();

    if (testCaseIds == null || testCaseIds.isEmpty()) {
      return new RestUtil.PutResponse<>(Response.Status.OK, testSuite, RestUtil.ENTITY_NO_CHANGE).toResponse();
    }

    int existingTestCaseCount = repository.getTestCaseCount(testCaseIds);
    if (existingTestCaseCount != testCaseIds.size()) {
      throw new IllegalArgumentException("You are trying to add one or more test cases that do not exist.");
    }
    return repository.addTestCasesToLogicalTestSuite(testSuite, testCaseIds).toResponse();
  }

  private TestCase getTestCase(CreateTestCase create, String user, EntityLink entityLink) {
    return repository
      .copy(new TestCase(), create, user)
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
