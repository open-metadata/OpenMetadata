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
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.beans.IntrospectionException;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataQuality/testCases/testCaseIncidentStatus")
@Tag(
    name = "Test Case Incident Manager",
    description = "APIs to test case incident status from incident manager.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCases")
public class TestCaseResolutionStatusResource
    extends EntityTimeSeriesResource<TestCaseResolutionStatus, TestCaseResolutionStatusRepository> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/testCaseIncidentStatus";
  private TestCaseResolutionStatusMapper mapper = new TestCaseResolutionStatusMapper();

  public TestCaseResolutionStatusResource(Authorizer authorizer) {
    super(Entity.TEST_CASE_RESOLUTION_STATUS, authorizer);
  }

  public static class TestCaseResolutionStatusResultList
      extends ResultList<TestCaseResolutionStatus> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "getTestCaseResolutionStatus",
      summary = "List the test case failure statuses",
      description =
          "Get a list of all the test case failure statuses, optionally filtered by `startTs` and `endTs` of the status creation, "
              + "status, assignee, and test case id. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test case statuses",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResolutionStatusResultList.class)))
      })
  public ResultList<TestCaseResolutionStatus> list(
      @Context SecurityContext securityContext,
      @Parameter(description = "Test Case ID", schema = @Schema(type = "UUID"))
          @QueryParam("testCaseId")
          UUID testCaseId,
      @Parameter(description = "Limit the number tests returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of tests at the offset",
              schema = @Schema(type = "string"))
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
              schema = @Schema(implementation = TestCaseResolutionStatusTypes.class))
          @QueryParam("testCaseResolutionStatusType")
          String testCaseResolutionStatusType,
      @Parameter(description = "Only list the latest statuses", schema = @Schema(type = "Boolean"))
          @DefaultValue("false")
          @QueryParam("latest")
          Boolean latest,
      @Parameter(
              description = "Filter test case statuses by assignee",
              schema = @Schema(type = "String"))
          @QueryParam("assignee")
          String assignee,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(description = "Test case fully qualified name", schema = @Schema(type = "String"))
          @QueryParam("testCaseFQN")
          String testCaseFQN,
      @Parameter(
              description = "Origin entity for which the incident was opened for",
              schema = @Schema(type = "String"))
          @QueryParam("originEntityFQN")
          String originEntityFQN) {
    List<AuthRequest> requests = new ArrayList<>();
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface testCaseResourceContext = getTestCaseResourceContext(testCaseFQN);
    requests.add(new AuthRequest(testCaseOperationContext, testCaseResourceContext));
    if (originEntityFQN != null) {
      OperationContext entityOperationContext =
          new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
      ResourceContextInterface entityResourceContext =
          new ResourceContext<>(Entity.TABLE, null, originEntityFQN);
      requests.add(new AuthRequest(entityOperationContext, entityResourceContext));
    }
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

    ListFilter filter = new ListFilter(include);
    filter.addQueryParam("testCaseResolutionStatusType", testCaseResolutionStatusType);
    filter.addQueryParam("assignee", assignee);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(testCaseFQN));
    filter.addQueryParam("originEntityFQN", originEntityFQN);

    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @GET
  @Path("/stateId/{stateId}")
  @Operation(
      operationId = "getTestCaseResolutionStatusesForAStateId",
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
  public ResultList<TestCaseResolutionStatus> listForStateId(
      @Context SecurityContext securityContext,
      @Parameter(description = "Sequence ID", schema = @Schema(type = "UUID")) @PathParam("stateId")
          UUID stateId) {
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    authorizer.authorize(securityContext, testCaseOperationContext, testCaseResourceContext);

    return repository.listTestCaseResolutionStatusesForStateId(stateId);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTestCaseResolutionStatusById",
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
      @Parameter(description = "Test Case Failure Status ID", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID testCaseResolutionStatusId) {
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    authorizer.authorize(securityContext, testCaseOperationContext, testCaseResourceContext);

    return repository.getById(testCaseResolutionStatusId);
  }

  @POST
  @Operation(
      operationId = "createTestCaseResolutionStatus",
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
      @Valid CreateTestCaseResolutionStatus createTestCaseResolutionStatus) {
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface entityResourceContext = TestCaseResourceContext.builder().build();

    List<AuthRequest> requests =
        List.of(
            new AuthRequest(entityOperationContext, entityResourceContext),
            new AuthRequest(testCaseOperationContext, testCaseResourceContext));

    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
    TestCaseResolutionStatus testCaseResolutionStatus =
        mapper.createToEntity(
            createTestCaseResolutionStatus, securityContext.getUserPrincipal().getName());
    return create(
        testCaseResolutionStatus,
        testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName());
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "updateTestCaseResolutionStatus",
      summary = "Update an existing test case failure status",
      description = "Update an existing test case failure status",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test case result status", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description =
                  "JsonPatch with array of operations. Only `updateAt` and `updatedBy` fields can be patched.",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    authorizer.authorize(securityContext, testCaseOperationContext, testCaseResourceContext);
    RestUtil.PatchResponse<TestCaseResolutionStatus> response =
        repository.patch(id, patch, securityContext.getUserPrincipal().getName());
    return response.toResponse();
  }

  protected static ResourceContextInterface getEntityResourceContext(
      String fqn, String entityType) {
    ResourceContextInterface resourceContext;
    if (fqn != null) {
      MessageParser.EntityLink entityLinkParsed = new MessageParser.EntityLink(entityType, fqn);
      resourceContext = TestCaseResourceContext.builder().entityLink(entityLinkParsed).build();
    } else {
      resourceContext = TestCaseResourceContext.builder().build();
    }
    return resourceContext;
  }

  protected static ResourceContextInterface getTestCaseResourceContext(String name) {
    ResourceContextInterface resourceContext;
    if (name != null) {
      resourceContext = TestCaseResourceContext.builder().name(name).build();
    } else {
      resourceContext = TestCaseResourceContext.builder().build();
    }
    return resourceContext;
  }
}
