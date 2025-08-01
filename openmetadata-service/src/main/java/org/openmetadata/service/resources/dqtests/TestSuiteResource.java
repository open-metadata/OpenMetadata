package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
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
import jakarta.json.JsonPatch;
import jakarta.servlet.http.HttpServletResponse;
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
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
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
  private final TestSuiteMapper mapper = new TestSuiteMapper();
  public static final String BASIC_TEST_SUITE_DELETION_ERROR =
      "Cannot delete logical test suite. To delete logical test suite, use DELETE /v1/dataQuality/testSuites/<...>";
  public static final String NON_BASIC_TEST_SUITE_DELETION_ERROR =
      "Cannot delete executable test suite. To delete executable test suite, use DELETE /v1/dataQuality/testSuites/basic/<...>";
  public static final String BASIC_TEST_SUITE_WITHOUT_REF_ERROR =
      "Cannot create a basic test suite without the BasicEntityReference field informed.";

  static final String FIELDS = "owners,tests,summary";
  static final String SEARCH_FIELDS_EXCLUDE = "table,database,databaseSchema,service";

  public TestSuiteResource(Authorizer authorizer, Limits limits) {
    super(Entity.TEST_SUITE, authorizer, limits);
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
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description =
                  "Returns executable or logical test suites. If omitted, returns all test suites.",
              schema = @Schema(type = "string", example = "basic"))
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

    List<AuthRequest> authRequests = getAuthRequestsForListOps();
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/search/list")
  @Operation(
      operationId = "listTestSuiteFromSearchService",
      summary = "List test suite using search service",
      description =
          "Get a list of test suite using the search service. Use `fields` "
              + "parameter to get only necessary fields. Use offset/limit pagination to limit the number "
              + "entries in the list using `limit` and `offset` query params."
              + "Use the `tests` field to get the test cases linked to the test suite "
              + "and/or use the `summary` field to get a summary of test case executions.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test suites",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuiteList.class)))
      })
  public ResultList<TestSuite> listFromSearch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number test suite returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limit,
      @Parameter(
              description = "Returns list of test suite after this offset (default = 0)",
              schema = @Schema(type = "string"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int offset,
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
      @Parameter(description = "Filter a test suite by domain.", schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domain,
      @Parameter(
              description = "Filter a test suite by fully qualified name.",
              schema = @Schema(type = "string"))
          @QueryParam("fullyQualifiedName")
          String fullyQualifiedName,
      @Parameter(description = "Filter test suites by owner.", schema = @Schema(type = "string"))
          @QueryParam("owner")
          String owner,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description = "Field used to sort the test cases listing",
              schema = @Schema(type = "string"))
          @QueryParam("sortField")
          String sortField,
      @Parameter(
              description =
                  "Set this field if your mapping is nested and you want to sort on a nested field",
              schema = @Schema(type = "string"))
          @QueryParam("sortNestedPath")
          String sortNestedPath,
      @Parameter(
              description =
                  "Set this field if your mapping is nested and you want to sort on a nested field",
              schema = @Schema(type = "string", example = "min,max,avg,sum,median"))
          @QueryParam("sortNestedMode")
          String sortNestedMode,
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
              description = "search query term to use in list",
              schema = @Schema(type = "string"))
          @QueryParam("q")
          String q,
      @Parameter(
              description = "raw elasticsearch query to use in list",
              schema = @Schema(type = "string"))
          @QueryParam("queryString")
          String queryString)
      throws IOException {
    SearchSortFilter searchSortFilter =
        new SearchSortFilter(sortField, sortType, sortNestedPath, sortNestedMode);
    SearchListFilter searchListFilter = new SearchListFilter(include);
    searchListFilter.addQueryParam("testSuiteType", testSuiteType);
    searchListFilter.addQueryParam("includeEmptyTestSuites", includeEmptyTestSuites);
    searchListFilter.addQueryParam("fullyQualifiedName", fullyQualifiedName);
    searchListFilter.addQueryParam("excludeFields", SEARCH_FIELDS_EXCLUDE);
    searchListFilter.addQueryParam("domains", domain);
    if (!nullOrEmpty(owner)) {
      EntityInterface entity;
      try {
        entity = Entity.getEntityByName(Entity.USER, owner, "", ALL);
      } catch (Exception e) {
        // If the owner is not a user, then we'll try to get a team
        entity = Entity.getEntityByName(Entity.TEAM, owner, "", ALL);
      }
      searchListFilter.addQueryParam("owners", entity.getId().toString());
    }

    EntityUtil.Fields fields = getFields(fieldsParam);

    List<AuthRequest> authRequests = getAuthRequestsForListOps();
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);
    return repository.listFromSearchWithOffset(
        uriInfo, fields, searchListFilter, limit, offset, searchSortFilter, q, queryString);
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
      @Context HttpServletResponse response,
      @Parameter(
              description = "get summary for a specific test suite",
              schema = @Schema(type = "String", format = "uuid"))
          @QueryParam("testSuiteId")
          UUID testSuiteId) {
    List<AuthRequest> authRequests = getAuthRequestsForListOps();
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);
    // Set the deprecation header based on draft specification from IETF
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header-02
    response.setHeader("Deprecation", "Monday, October 30, 2024");
    response.setHeader(
        "Link", "api/v1/dataQuality/testSuites/dataQualityReport; rel=\"alternate\"");
    return repository.getTestSummary(testSuiteId);
  }

  @GET
  @Path("/dataQualityReport")
  @Operation(
      operationId = "getDataQualityReport",
      summary = "Get Data Quality Report",
      description =
          """
            Use the search service to perform data quality aggregation. You can use the `q` parameter to filter the results.
            the `aggregationQuery` is of the form `bucketName=<bucketName>:aggType=<aggType>:field=<field>`. You can sperate aggregation
            query with a comma `,` to perform nested aggregations.
            For example, `bucketName=table:aggType=terms:field=databaseName,bucketName=<bucketName>:aggType=<aggType>:field=<field>`
            """,
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Data Quality Report Results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityReport.class)))
      })
  public DataQualityReport getDataQualityReport(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Search query to filter the aggregation results",
              schema = @Schema(type = "String"))
          @QueryParam("q")
          String query,
      @Parameter(
              description = "Aggregation query to perform aggregation on the search results",
              schema = @Schema(type = "String"))
          @QueryParam("aggregationQuery")
          String aggregationQuery,
      @Parameter(
              description = "Index to perform the aggregation against",
              schema = @Schema(type = "String"))
          @QueryParam("index")
          String index)
      throws IOException {
    List<AuthRequest> authRequests = getAuthRequestsForListOps();
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);
    if (nullOrEmpty(aggregationQuery) || nullOrEmpty(index)) {
      throw new IllegalArgumentException("aggregationQuery and index are required parameters");
    }
    return repository.getDataQualityReport(query, aggregationQuery, index);
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
        create.withBasicEntityReference(
            null); // entity reference is not applicable for logical test suites
    TestSuite testSuite =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    testSuite.setBasic(false);
    List<AuthRequest> authRequests = getAuthRequestsForPost(testSuite);
    return create(uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, testSuite);
  }

  @POST
  @Path("/basic")
  @Operation(
      operationId = "createBasicTestSuite",
      summary = "Create a basic test suite",
      description = "Create a basic test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Basic test suite",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createBasic(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Context HttpServletResponse response,
      @Valid CreateTestSuite create) {
    TestSuite testSuite =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    if (testSuite.getBasicEntityReference() == null) {
      throw new IllegalArgumentException(BASIC_TEST_SUITE_WITHOUT_REF_ERROR);
    }
    testSuite.setBasic(true);
    List<AuthRequest> authRequests = getAuthRequestsForPost(testSuite);
    return create(uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, testSuite);
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
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, id, "", ALL);
    List<AuthRequest> authRequests =
        getAuthRequestsForUpdate(testSuite, ResourceContextInterface.Operation.PATCH, patch);
    return patchInternal(uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, id, patch);
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
        create.withBasicEntityReference(
            null); // entity reference is not applicable for logical test suites
    TestSuite testSuite =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    testSuite.setBasic(false);
    List<AuthRequest> authRequests =
        new java.util.ArrayList<>(
            getAuthRequestsForUpdate(testSuite, ResourceContextInterface.Operation.PUT, null));
    authRequests.addAll(getAuthRequestsForPost(testSuite));
    return createOrUpdate(
        uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, testSuite);
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
      @Context HttpServletResponse response,
      @Valid CreateTestSuite create) {
    TestSuite testSuite =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    testSuite.setBasic(true);
    // Set the deprecation header based on draft specification from IETF
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header-02
    response.setHeader("Deprecation", "Monday, March 24, 2025");
    response.setHeader("Link", "api/v1/dataQuality/testSuites/basic; rel=\"alternate\"");
    List<AuthRequest> authRequests =
        new java.util.ArrayList<>(
            getAuthRequestsForUpdate(testSuite, ResourceContextInterface.Operation.PUT, null));
    authRequests.addAll(getAuthRequestsForPost(testSuite));
    return createOrUpdate(
        uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, testSuite);
  }

  @PUT
  @Path("/basic")
  @Operation(
      operationId = "createOrUpdateBasicTestSuite",
      summary = "Create or Update Basic test suite",
      description = "Create a Basic TestSuite if it does not exist or update an existing one.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestSuite.class)))
      })
  public Response createOrUpdateBasic(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTestSuite create) {
    TestSuite testSuite =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    testSuite.setBasic(true);
    List<AuthRequest> authRequests =
        new java.util.ArrayList<>(
            getAuthRequestsForUpdate(testSuite, ResourceContextInterface.Operation.PUT, null));
    authRequests.addAll(getAuthRequestsForPost(testSuite));
    return createOrUpdate(
        uriInfo, securityContext, authRequests, AuthorizationLogic.ANY, testSuite);
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
    OperationContext operationContext =
        new OperationContext(Entity.TEST_SUITE, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, id, "*", ALL);
    if (Boolean.TRUE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(NON_BASIC_TEST_SUITE_DELETION_ERROR);
    }
    RestUtil.DeleteResponse<TestSuite> response =
        repository.deleteLogicalTestSuite(securityContext, testSuite, hardDelete);
    repository.deleteFromSearch(response.entity(), hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteLogicalTestSuiteAsync",
      summary = "Delete a logical test suite asynchronously",
      description = "Delete a logical test suite by `id` asynchronously.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Logical test suite for instance {id} is not found")
      })
  public Response deleteAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the logical entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the logical test suite", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.TEST_SUITE, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, id, "*", ALL);
    if (Boolean.TRUE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(NON_BASIC_TEST_SUITE_DELETION_ERROR);
    }
    return repository.deleteLogicalTestSuiteAsync(securityContext, testSuite, hardDelete);
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
    OperationContext operationContext =
        new OperationContext(Entity.TEST_SUITE, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    TestSuite testSuite = Entity.getEntityByName(Entity.TEST_SUITE, name, "*", ALL);
    if (Boolean.TRUE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(NON_BASIC_TEST_SUITE_DELETION_ERROR);
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
      @Context HttpServletResponse response,
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
    if (Boolean.FALSE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(BASIC_TEST_SUITE_DELETION_ERROR);
    }
    // Set the deprecation header based on draft specification from IETF
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header-02
    response.setHeader("Deprecation", "Monday, March 24, 2025");
    response.setHeader("Link", "api/v1/dataQuality/testSuites/basic; rel=\"alternate\"");
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @DELETE
  @Path("/basic/name/{name}")
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
  public Response deleteBasic(
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
    if (Boolean.FALSE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(BASIC_TEST_SUITE_DELETION_ERROR);
    }
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
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
      @Context HttpServletResponse response,
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
    if (Boolean.FALSE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(BASIC_TEST_SUITE_DELETION_ERROR);
    }
    // Set the deprecation header based on draft specification from IETF
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-deprecation-header-02
    response.setHeader("Deprecation", "Monday, March 24, 2025");
    response.setHeader("Link", "api/v1/dataQuality/testSuites/basic; rel=\"alternate\"");
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/basic/{id}")
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
  public Response deleteBasic(
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
    if (Boolean.FALSE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException(BASIC_TEST_SUITE_DELETION_ERROR);
    }
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
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

  private List<AuthRequest> getAuthRequestsForListOps() {
    ResourceContext<?> entityResourceContext = new ResourceContext<>(Entity.TABLE);
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);
    ResourceContext<?> testSuiteResourceContext = getResourceContext();
    OperationContext testSuiteOperationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    ResourceContext<?> testCaseResourceContext = new ResourceContext<>(Entity.TEST_CASE);
    OperationContext testCaseOperationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_ALL);

    return List.of(
        new AuthRequest(entityOperationContext, entityResourceContext),
        new AuthRequest(testSuiteOperationContext, testSuiteResourceContext),
        new AuthRequest(testCaseOperationContext, testCaseResourceContext));
  }

  private List<AuthRequest> getAuthRequestsForPost(TestSuite testSuite) {
    ResourceContext<?> entityResourceContext;
    EntityReference entityReference = testSuite.getBasicEntityReference();
    if (entityReference != null) {
      entityResourceContext = new ResourceContext<>(Entity.TABLE, entityReference.getId(), null);
    } else {
      entityResourceContext = new ResourceContext<>(Entity.TABLE);
    }
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    ResourceContext<?> testSuiteResourceContext = getResourceContext();
    OperationContext testSuiteOperationContext =
        new OperationContext(entityType, MetadataOperation.CREATE);

    return List.of(
        new AuthRequest(entityOperationContext, entityResourceContext),
        new AuthRequest(testSuiteOperationContext, testSuiteResourceContext));
  }

  private List<AuthRequest> getAuthRequestsForUpdate(
      TestSuite testSuite, ResourceContextInterface.Operation operation, JsonPatch patch) {
    EntityReference entityReference = testSuite.getBasicEntityReference();
    ResourceContext<?> entityResourceContext;
    OperationContext testSuiteOperationContext;
    if (entityReference != null) {
      entityResourceContext = new ResourceContext<>(Entity.TABLE, entityReference.getId(), null);
    } else {
      entityResourceContext = new ResourceContext<>(Entity.TABLE);
    }
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS);
    ResourceContext<?> testSuiteResourceContext =
        getResourceContextByName(FullyQualifiedName.quoteName(testSuite.getName()), operation);
    if (patch != null) {
      testSuiteOperationContext = new OperationContext(entityType, patch);
    } else {
      testSuiteOperationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    }

    return List.of(
        new AuthRequest(entityOperationContext, entityResourceContext),
        new AuthRequest(testSuiteOperationContext, testSuiteResourceContext));
  }
}
