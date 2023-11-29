package org.openmetadata.service.resources.dqtests;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.beans.IntrospectionException;
import java.lang.reflect.InvocationTargetException;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
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
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ReportDataContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataQuality/testCases/testCaseResolutionStatus")
@Tag(name = "Test Case Failure Status", description = "APIs to test case failure status from resolution center.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCases")
public class TestCaseResolutionStatusResource
    extends EntityTimeSeriesResource<TestCaseResolutionStatus, TestCaseResolutionStatusRepository> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/testCaseResolutionStatus";

  public TestCaseResolutionStatusResource(Authorizer authorizer) {
    super(Entity.ENTITY_TEST_CASE_FAILURE_STATUS, authorizer);
  }

  public static class TestCaseFailureStatusResultList extends ResultList<TestCaseResolutionStatus> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "getTestCaseFailureStatus",
      summary = "List the test case failure statuses",
      description =
          "Get a list of all the test case failure statuses, optionally filtered by `startTs` and `endTs` of the status creation, "
              + "status, assignee, reviewer, and test case id. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test case statuses",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseFailureStatusResultList.class)))
      })
  public ResultList<TestCaseResolutionStatus> list(
      @Context SecurityContext securityContext,
      @Parameter(description = "Test Case ID", schema = @Schema(type = "UUID")) @QueryParam("testCaseId")
          UUID testCaseId,
      @Parameter(description = "Limit the number tests returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tests at the offset", schema = @Schema(type = "string"))
          @QueryParam("offset")
          String offset,
      @Parameter(
              description = "Filter test case statuses after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter test case statuses before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Filter test case statuses by status",
              schema = @Schema(implementation = TestCaseResolutionStatusType.class))
          @QueryParam("testCaseFailureStatus")
          String testCaseFailureStatus,
      @Parameter(description = "Only list the latest statuses", schema = @Schema(type = "Boolean"))
          @DefaultValue("false")
          @QueryParam("latest")
          Boolean latest,
      @Parameter(description = "Filter test case statuses by assignee", schema = @Schema(type = "String"))
          @QueryParam("assignee")
          String assignee,
      @Parameter(description = "Filter test case statuses by reviewer", schema = @Schema(type = "String"))
          @QueryParam("reviewer")
          String reviewer,
      @Parameter(description = "Test case fully qualified name", schema = @Schema(type = "String"))
          @QueryParam("testCaseFQN")
          String testCaseFQN) {
    OperationContext operationContext = new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("testCaseFailureStatus", testCaseFailureStatus);
    filter.addQueryParam("assignee", assignee);
    filter.addQueryParam("reviewer", reviewer);
    filter.addQueryParam("entityFQNHash", testCaseFQN);

    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @GET
  @Path("/sequenceId/{sequenceId}")
  @Operation(
      operationId = "getTestCaseFailureStatusesForASequenceId",
      summary = "Get test case failure statuses for a sequence id",
      description = "Get a test case failure statuses for a sequence id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test case failure status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResolutionStatus.class)))
      })
  public ResultList<TestCaseResolutionStatus> listForSequenceId(
      @Context SecurityContext securityContext,
      @Parameter(description = "Sequence ID", schema = @Schema(type = "UUID")) @NonNull @QueryParam("sequenceId")
          UUID sequenceId) {
    OperationContext operationContext = new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.listTestCaseFailureStatusesForSequenceId(sequenceId);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTestCaseFailureStatusById",
      summary = "Get test case failure status by id",
      description = "Get a test case failure status by id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test case failure status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResolutionStatus.class)))
      })
  public TestCaseResolutionStatus get(
      @Context SecurityContext securityContext,
      @Parameter(description = "Test Case Failure Status ID", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID testCaseFailureStatusId) {
    OperationContext operationContext = new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    return repository.getById(testCaseFailureStatusId);
  }

  @POST
  @Operation(
      operationId = "createTestCaseFailureStatus",
      summary = "Create a new test case failure status",
      description = "Create a new test case failure status",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created test case failure status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateTestCaseResolutionStatus.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestCaseResolutionStatus createTestCaseFailureStatus) {
    OperationContext operationContext = new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityReference testCaseReference =
        EntityUtil.getEntityReference("TestCase", createTestCaseFailureStatus.getTestCaseReference());
    TestCaseResolutionStatus testCaseFailureStatus =
        getTestCaseFailureStatus(
            testCaseReference, createTestCaseFailureStatus, securityContext.getUserPrincipal().getName());

    return create(
        testCaseFailureStatus,
        TestCaseResolutionStatusRepository.TESTCASE_RESOLUTION_STATUS_EXTENSION,
        testCaseReference.getFullyQualifiedName());
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "updateTestCaseFailureStatus",
      summary = "Update an existing test case failure status",
      description = "Update an existing test case failure status",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test case result status", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @RequestBody(
              description =
                  "JsonPatch with array of operations. Only `updateAt` and `updatedBy` fields can be patched.",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {@ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")}))
          JsonPatch patch)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    OperationContext operationContext = new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface resourceContext = ReportDataContext.builder().build();
    authorizer.authorize(securityContext, operationContext, resourceContext);
    RestUtil.PatchResponse<TestCaseResolutionStatus> response =
        repository.patch(id, patch, securityContext.getUserPrincipal().getName());
    return response.toResponse();
  }

  private TestCaseResolutionStatus getTestCaseFailureStatus(
      EntityReference testCaseReference, CreateTestCaseResolutionStatus createTestCaseFailureStatus, String user) {
    EntityReference userReference = EntityUtil.getEntityReference("User", user);
    TestCaseResolutionStatus latestTestCaseFailure =
        repository.getLatestRecord(
            testCaseReference.getFullyQualifiedName(),
            TestCaseResolutionStatusRepository.TESTCASE_RESOLUTION_STATUS_EXTENSION);
    UUID sequenceId;

    if ((latestTestCaseFailure != null)
        && (latestTestCaseFailure.getTestCaseResolutionStatusType() != TestCaseResolutionStatusType.Resolved)) {
      // if the latest status is not resolved then use the same sequence id
      sequenceId = latestTestCaseFailure.getSequenceId();
    } else {
      // if the latest status is resolved then create a new sequence id
      // effectively creating a new test case failure status sequence
      sequenceId = UUID.randomUUID();
    }

    return new TestCaseResolutionStatus()
        .withSequenceId(sequenceId)
        .withTimestamp(System.currentTimeMillis())
        .withTestCaseResolutionStatusType(createTestCaseFailureStatus.getTestCaseResolutionStatusType())
        .withTestCaseResolutionStatusDetails(createTestCaseFailureStatus.getTestCaseResolutionStatusDetails())
        .withUpdatedBy(userReference)
        .withUpdatedAt(System.currentTimeMillis())
        .withTestCaseReference(testCaseReference);
  }
}
