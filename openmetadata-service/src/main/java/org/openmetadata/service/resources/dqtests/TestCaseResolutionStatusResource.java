package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

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
  private static final int MAX_BULK_CREATE_SIZE = 100;
  private static final String MAX_BULK_CREATE_SIZE_TEXT = "100";
  private final TestCaseResolutionStatusMapper mapper = new TestCaseResolutionStatusMapper();

  public TestCaseResolutionStatusResource(Authorizer authorizer) {
    super(Entity.TEST_CASE_RESOLUTION_STATUS, authorizer);
  }

  public static class TestCaseResolutionStatusResultList
      extends ResultList<TestCaseResolutionStatus> {
    /* Required for serde */
  }

  public static class TestCaseIncidentGroupResultList extends ResultList<TestCaseIncidentGroup> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "getTestCaseResolutionStatus",
      summary = "List the test case failure statuses",
      description =
          "Get a list of all the test case failure statuses, optionally filtered by `startTs` and `endTs` of the status creation, "
              + "status, assignee, test case id, and the test definition of the test case. "
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
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter test case statuses before the given end timestamp",
              schema = @Schema(type = "number"))
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
          String originEntityFQN,
      @Parameter(description = "Filter incidents by domain", schema = @Schema(type = "String"))
          @QueryParam("domain")
          String domain,
      @Parameter(
              description =
                  "Filter incidents by the test definition of their test case, by name or fully qualified name",
              schema = @Schema(type = "String"))
          @QueryParam("testDefinition")
          String testDefinition,
      @Parameter(
              description =
                  "Filter incidents by a direct owner (user or team name) of their test case",
              schema = @Schema(type = "String"))
          @QueryParam("owner")
          String owner) {
    ResourceContextInterface testCaseResourceContext = getTestCaseResourceContext(testCaseFQN);
    ResourceContextInterface entityResourceContext =
        buildEntityResourceContext(testCaseFQN, testCaseId, originEntityFQN);
    List<AuthRequest> requests =
        buildViewAuthRequests(testCaseResourceContext, entityResourceContext);

    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

    ListFilter filter = new ListFilter(include);
    filter.addQueryParam("testCaseResolutionStatusType", testCaseResolutionStatusType);
    filter.addQueryParam("incidentAssignee", assignee);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(testCaseFQN));
    filter.addQueryParam("originEntityFQN", originEntityFQN);
    filter.addQueryParam("domain", domain);
    UUID testDefinitionId = resolveFilterEntityId(Entity.TEST_DEFINITION, testDefinition);
    if (testDefinitionId != null) {
      filter.addQueryParam("testDefinitionId", testDefinitionId.toString());
    }
    UUID testCaseOwnerId = resolveOwnerFilterId(owner);
    if (testCaseOwnerId != null) {
      filter.addQueryParam("testCaseOwnerId", testCaseOwnerId.toString());
    }

    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  @GET
  @Path("/incidentGroups")
  @Operation(
      operationId = "listTestCaseIncidentGroups",
      summary = "List open incident counts grouped by a dimension",
      description =
          "Get the number of distinct open incidents grouped by `table`, `testDefinition`, or `owner`. "
              + "Resolved incidents are never included. Optionally filter by open statuses, current "
              + "assignee, test case, domain, and a date range applied to the incident's `createdAt` "
              + "or `updatedAt` timestamp. Use `limit` and the `paging.before`/`paging.after` cursors "
              + "as the `offset` query param to paginate the groups.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of incident groups with counts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseIncidentGroupResultList.class)))
      })
  public ResultList<TestCaseIncidentGroup> listIncidentGroups(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Dimension to group incidents by",
              required = true,
              schema = @Schema(implementation = IncidentGroupBy.class))
          @QueryParam("groupBy")
          String groupBy,
      @Parameter(
              description =
                  "Filter incidents by their current open status. Repeatable or comma-separated; `Resolved` is rejected.",
              schema = @Schema(implementation = TestCaseResolutionStatusTypes.class))
          @QueryParam("status")
          List<String> statuses,
      @Parameter(
              description = "Filter incidents by their current assignee",
              schema = @Schema(type = "String"))
          @QueryParam("assignee")
          String assignee,
      @Parameter(description = "Test case fully qualified name", schema = @Schema(type = "String"))
          @QueryParam("testCaseFQN")
          String testCaseFQN,
      @Parameter(
              description = "Incident timestamp the `startTs`/`endTs` range applies to",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {
                        TestCaseResolutionStatusRepository.INCIDENT_DATE_FIELD_CREATED_AT,
                        TestCaseResolutionStatusRepository.INCIDENT_DATE_FIELD_UPDATED_AT
                      }))
          @QueryParam("dateField")
          @DefaultValue(TestCaseResolutionStatusRepository.INCIDENT_DATE_FIELD_CREATED_AT)
          String dateField,
      @Parameter(
              description = "Filter incidents after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter incidents before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Filter incidents by domain", schema = @Schema(type = "String"))
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Limit the number of groups returned. (1 to 1000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          int limit,
      @Parameter(
              description =
                  "Returns the list of groups at the offset. Use the `paging.before`/`paging.after` "
                      + "cursor from a previous response",
              schema = @Schema(type = "string"))
          @QueryParam("offset")
          String offset,
      @Parameter(
              description = "Sort type for the incident count",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {
                        TestCaseResolutionStatusRepository.INCIDENT_SORT_TYPE_ASC,
                        TestCaseResolutionStatusRepository.INCIDENT_SORT_TYPE_DESC
                      }))
          @QueryParam("sortType")
          @DefaultValue(TestCaseResolutionStatusRepository.INCIDENT_SORT_TYPE_DESC)
          String sortType) {
    IncidentGroupBy groupByDimension = parseIncidentGroupBy(groupBy);
    List<TestCaseResolutionStatusTypes> statusFilters = parseIncidentStatuses(statuses);

    ResourceContextInterface testCaseResourceContext = getTestCaseResourceContext(testCaseFQN);
    ResourceContextInterface entityResourceContext =
        buildEntityResourceContext(testCaseFQN, null, null);
    List<AuthRequest> requests =
        buildViewAuthRequests(testCaseResourceContext, entityResourceContext);
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

    ListFilter filter = new ListFilter(null);
    if (!statusFilters.isEmpty()) {
      filter.addQueryParam(
          "testCaseResolutionStatusType",
          statusFilters.stream()
              .map(TestCaseResolutionStatusTypes::value)
              .collect(Collectors.joining(",")));
    }
    filter.addQueryParam("incidentAssignee", assignee);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(testCaseFQN));
    UUID domainId = resolveFilterEntityId(Entity.DOMAIN, domain);
    if (domainId != null) {
      filter.addQueryParam("incidentDomainId", domainId.toString());
    }
    filter.addQueryParam("incidentDateField", dateField);
    if (startTs != null) {
      filter.addQueryParam("incidentStartTs", String.valueOf(startTs));
    }
    if (endTs != null) {
      filter.addQueryParam("incidentEndTs", String.valueOf(endTs));
    }
    return repository.listIncidentGroups(groupByDimension, filter, sortType, limit, offset);
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
    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    ResourceContextInterface entityResourceContext = TestCaseResourceContext.builder().build();
    List<AuthRequest> requests =
        buildViewAuthRequests(testCaseResourceContext, entityResourceContext);
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

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
    TestCaseResolutionStatus testCaseResolutionStatus =
        repository.getById(testCaseResolutionStatusId);
    TestCase testCase =
        Entity.getEntityByName(
            Entity.TEST_CASE,
            testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName(),
            "",
            Include.ALL);

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());

    ResourceContextInterface testCaseResourceContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    ResourceContextInterface entityResourceContext =
        TestCaseResourceContext.builder().entityLink(entityLink).build();
    List<AuthRequest> requests =
        buildViewAuthRequests(testCaseResourceContext, entityResourceContext);
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

    return testCaseResolutionStatus;
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

    TestCase testCase =
        Entity.getEntityByName(
            Entity.TEST_CASE,
            createTestCaseResolutionStatus.getTestCaseReference(),
            "",
            Include.ALL);

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());

    ResourceContextInterface testCaseResourceContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    ResourceContextInterface entityResourceContext =
        TestCaseResourceContext.builder().entityLink(entityLink).build();
    List<AuthRequest> requests =
        buildEditAuthRequests(testCaseResourceContext, entityResourceContext);

    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
    TestCaseResolutionStatus testCaseResolutionStatus =
        mapper.createToEntity(
            createTestCaseResolutionStatus, securityContext.getUserPrincipal().getName());
    return create(
        testCaseResolutionStatus,
        testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName());
  }

  @PUT
  @Path("/bulk")
  @Operation(
      operationId = "bulkCreateTestCaseResolutionStatus",
      summary = "Bulk create test case failure statuses",
      description =
          "Create a new failure status for multiple test case incidents in one operation — e.g. "
              + "assigning or resolving a selection of incidents at once, up to a limit of "
              + MAX_BULK_CREATE_SIZE_TEXT
              + " per request. Each entry is validated and authorized exactly like a single "
              + "create; the BulkOperationResult reports per-entry success or failure.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Bulk operation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class)))
      })
  public Response bulkCreate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid List<CreateTestCaseResolutionStatus> createRequests) {
    if (listOrEmpty(createRequests).size() > MAX_BULK_CREATE_SIZE) {
      throw new IllegalArgumentException(
          String.format(
              "Bulk request size %d exceeds the maximum of %d entries",
              createRequests.size(), MAX_BULK_CREATE_SIZE));
    }
    Map<String, TestCase> testCasesByFqn = prefetchTestCases(createRequests);
    EntityReference updatedBy =
        Entity.getEntityReferenceByName(
            Entity.USER, securityContext.getUserPrincipal().getName(), Include.ALL);
    List<BulkResponse> successes = new ArrayList<>();
    List<BulkResponse> failures = new ArrayList<>();
    for (CreateTestCaseResolutionStatus createRequest : listOrEmpty(createRequests)) {
      processBulkEntry(
          securityContext,
          createRequest,
          testCasesByFqn.get(createRequest.getTestCaseReference()),
          updatedBy,
          successes,
          failures);
    }
    return Response.ok(buildBulkResult(listOrEmpty(createRequests).size(), successes, failures))
        .build();
  }

  private static Map<String, TestCase> prefetchTestCases(
      List<CreateTestCaseResolutionStatus> createRequests) {
    List<String> fqns =
        listOrEmpty(createRequests).stream()
            .map(CreateTestCaseResolutionStatus::getTestCaseReference)
            .filter(fqn -> !nullOrEmpty(fqn))
            .distinct()
            .toList();
    Map<String, TestCase> result = new HashMap<>();
    if (!fqns.isEmpty()) {
      TestCaseRepository testCaseRepository =
          (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
      for (TestCase testCase : testCaseRepository.getDao().findEntityByNames(fqns, Include.ALL)) {
        result.put(testCase.getFullyQualifiedName(), testCase);
      }
    }
    return result;
  }

  private void processBulkEntry(
      SecurityContext securityContext,
      CreateTestCaseResolutionStatus createRequest,
      TestCase testCase,
      EntityReference updatedBy,
      List<BulkResponse> successes,
      List<BulkResponse> failures) {
    try {
      if (testCase == null) {
        throw new EntityNotFoundException(
            CatalogExceptionMessage.entityNotFound(
                Entity.TEST_CASE, createRequest.getTestCaseReference()));
      }
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      ResourceContextInterface testCaseResourceContext =
          TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
      ResourceContextInterface entityResourceContext =
          TestCaseResourceContext.builder().entityLink(entityLink).build();
      authorizer.authorizeRequests(
          securityContext,
          buildEditAuthRequests(testCaseResourceContext, entityResourceContext),
          AuthorizationLogic.ANY);

      TestCaseResolutionStatus status = mapper.createToEntity(createRequest, updatedBy, testCase);
      repository.createNewRecord(status, testCase.getFullyQualifiedName());
      successes.add(new BulkResponse().withRequest(createRequest));
    } catch (AuthorizationException e) {
      failures.add(
          new BulkResponse()
              .withRequest(createRequest)
              .withMessage("Permission denied: " + e.getMessage())
              .withStatus(Response.Status.FORBIDDEN.getStatusCode()));
    } catch (Exception e) {
      failures.add(
          new BulkResponse()
              .withRequest(createRequest)
              .withMessage(e.getMessage())
              .withStatus(Response.Status.BAD_REQUEST.getStatusCode()));
    }
  }

  private static BulkOperationResult buildBulkResult(
      int processed, List<BulkResponse> successes, List<BulkResponse> failures) {
    ApiStatus status = ApiStatus.SUCCESS;
    if (successes.isEmpty() && !failures.isEmpty()) {
      status = ApiStatus.FAILURE;
    } else if (!failures.isEmpty()) {
      status = ApiStatus.PARTIAL_SUCCESS;
    }
    return new BulkOperationResult()
        .withStatus(status)
        .withNumberOfRowsProcessed(processed)
        .withNumberOfRowsPassed(successes.size())
        .withNumberOfRowsFailed(failures.size())
        .withSuccessRequest(successes)
        .withFailedRequest(failures);
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
          JsonPatch patch) {

    TestCaseResolutionStatus testCaseResolutionStatus = repository.getById(id);
    TestCase testCase =
        Entity.getEntityByName(
            Entity.TEST_CASE,
            testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName(),
            "",
            Include.ALL);

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());

    ResourceContextInterface testCaseResourceContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    ResourceContextInterface entityResourceContext =
        TestCaseResourceContext.builder().entityLink(entityLink).build();
    List<AuthRequest> requests =
        buildEditAuthRequests(testCaseResourceContext, entityResourceContext);

    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
    RestUtil.PatchResponse<TestCaseResolutionStatus> response =
        repository.patch(id, patch, securityContext.getUserPrincipal().getName());
    return response.toResponse();
  }

  @GET
  @Path("/search/list")
  @Operation(
      operationId = "listTestCaseResolutionStatusFromSearchService",
      summary = "List test case resolution status using search service",
      description =
          "Get a list of test case resolution status using the search service. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `offset` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test case resolution status",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseResolutionStatusResultList.class)))
      })
  public ResultList<TestCaseResolutionStatus> listFromSearch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Limit the number of incidents returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limit,
      @Parameter(
              description = "Returns list of incidents after this offset",
              schema = @Schema(type = "string"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int offset,
      @Parameter(
              description = "Filter test case statuses after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter test case statuses before the given end timestamp",
              schema = @Schema(type = "number"))
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
          String originEntityFQN,
      @Parameter(description = "domain filter to use in list", schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(
              description = "Field used to sort the incidents listing",
              schema = @Schema(type = "string"))
          @QueryParam("sortField")
          String sortField,
      @Parameter(
              description = "Sort type",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"asc", "desc"}))
          @QueryParam("sortType")
          @DefaultValue("desc")
          String sortType,
      @Parameter(
              description =
                  "Field to filter incidents by date range. Use 'timestamp' for created at or 'updatedAt' for last updated at.",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"timestamp", "updatedAt"}))
          @QueryParam("dateField")
          @DefaultValue("timestamp")
          String dateField)
      throws IOException {

    // Use updatedAt as default sort field for TestCaseResolutionStatus since it doesn't have a name
    // field
    String defaultSortField = sortField != null ? sortField : "updatedAt";
    SearchSortFilter searchSortFilter =
        new SearchSortFilter(defaultSortField, sortType, null, null);
    SearchListFilter searchListFilter = new SearchListFilter(include);
    searchListFilter.addQueryParam("testCaseResolutionStatusType", testCaseResolutionStatusType);
    searchListFilter.addQueryParam("assignee", assignee);
    searchListFilter.addQueryParam("testCaseFqn", testCaseFQN);
    searchListFilter.addQueryParam("originEntityFQN", originEntityFQN);
    searchListFilter.addQueryParam("domains", domain);
    searchListFilter.addQueryParam("dateField", dateField);
    if (startTs != null) {
      searchListFilter.addQueryParam("startTimestamp", String.valueOf(startTs));
    }
    if (endTs != null) {
      searchListFilter.addQueryParam("endTimestamp", String.valueOf(endTs));
    }

    ResourceContextInterface testCaseResourceContext = TestCaseResourceContext.builder().build();
    ResourceContextInterface entityResourceContext =
        buildEntityResourceContext(testCaseFQN, null, originEntityFQN);
    List<AuthRequest> requests =
        List.of(
            new AuthRequest(
                new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL),
                testCaseResourceContext),
            new AuthRequest(
                new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL),
                entityResourceContext));

    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);

    if (latest) {
      // For latest results, use aggregation grouped by test case to get the latest status per test
      // case
      return repository.listLatestFromSearch(
          Fields.EMPTY_FIELDS,
          searchListFilter,
          "testCase.fullyQualifiedName.keyword", // Group by test case to get latest status per test
          // case
          null,
          limit,
          offset,
          defaultSortField,
          sortType);
    } else {
      return repository.listFromSearchWithOffset(
          new Fields(null), searchListFilter, limit, offset, searchSortFilter, null, null);
    }
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

  protected static List<AuthRequest> buildViewAuthRequests(
      ResourceContextInterface testCaseResourceContext,
      ResourceContextInterface entityResourceContext) {
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL),
            testCaseResourceContext),
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL), entityResourceContext),
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS),
            entityResourceContext));
  }

  protected static List<AuthRequest> buildEditAuthRequests(
      ResourceContextInterface testCaseResourceContext,
      ResourceContextInterface entityResourceContext) {
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS),
            entityResourceContext),
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.EDIT_ALL), entityResourceContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS),
            testCaseResourceContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_ALL),
            testCaseResourceContext));
  }

  private static IncidentGroupBy parseIncidentGroupBy(String groupBy) {
    IncidentGroupBy result;
    if (nullOrEmpty(groupBy)) {
      throw new IllegalArgumentException("Query parameter 'groupBy' is required");
    }
    try {
      result = IncidentGroupBy.fromValue(groupBy);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid groupBy '%s'. Must be one of %s",
              groupBy, Stream.of(IncidentGroupBy.values()).map(IncidentGroupBy::value).toList()));
    }
    return result;
  }

  private static List<TestCaseResolutionStatusTypes> parseIncidentStatuses(List<String> statuses) {
    List<TestCaseResolutionStatusTypes> result = new ArrayList<>();
    for (String statusParam : listOrEmpty(statuses)) {
      for (String value : statusParam.split(",")) {
        result.add(parseIncidentStatus(value.trim()));
      }
    }
    return result;
  }

  private static TestCaseResolutionStatusTypes parseIncidentStatus(String value) {
    TestCaseResolutionStatusTypes result;
    try {
      result = TestCaseResolutionStatusTypes.fromValue(value);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(String.format("Invalid status '%s'", value));
    }
    if (result == TestCaseResolutionStatusTypes.Resolved) {
      throw new IllegalArgumentException(
          String.format(
              "Status '%s' is not allowed; incident groups only count open incidents",
              TestCaseResolutionStatusTypes.Resolved.value()));
    }
    return result;
  }

  private static UUID resolveFilterEntityId(String entityType, String name) {
    UUID entityId = null;
    if (!nullOrEmpty(name)) {
      EntityReference result =
          Entity.getEntityReferenceByName(entityType, name, Include.NON_DELETED);
      if (!nullOrEmpty(result)) {
        entityId = result.getId();
      }
    }
    return entityId;
  }

  private static UUID resolveOwnerFilterId(String owner) {
    UUID result = null;
    if (!nullOrEmpty(owner)) {
      try {
        result = resolveFilterEntityId(Entity.USER, owner);
      } catch (EntityNotFoundException e) {
        result = resolveFilterEntityId(Entity.TEAM, owner);
      }
    }
    return result;
  }

  protected static ResourceContextInterface buildEntityResourceContext(
      String testCaseFQN, UUID testCaseId, String originEntityFQN) {
    if (testCaseFQN != null) {
      TestCase testCase = Entity.getEntityByName(Entity.TEST_CASE, testCaseFQN, "", Include.ALL);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      return TestCaseResourceContext.builder().entityLink(entityLink).build();
    } else if (testCaseId != null) {
      TestCase testCase = Entity.getEntity(Entity.TEST_CASE, testCaseId, "", Include.ALL);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      return TestCaseResourceContext.builder().entityLink(entityLink).build();
    } else if (originEntityFQN != null) {
      EntityInterface entityInterface =
          Entity.getEntityByName(Entity.TABLE, originEntityFQN, "", Include.ALL);
      String entityLinkStr =
          EntityUtil.buildEntityLink(Entity.TABLE, entityInterface.getFullyQualifiedName());
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
      return TestCaseResourceContext.builder().entityLink(entityLink).build();
    }
    return TestCaseResourceContext.builder().build();
  }
}
