package org.openmetadata.catalog.resources.dqtests;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.tests.CreateTestCase;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.TestCaseRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.tests.TestCase;
import org.openmetadata.catalog.tests.type.TestCaseResult;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
@Path("/v1/testCase")
@Api(value = "TestCase collection", tags = "TestCase collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCases")
public class TestCaseResource extends EntityResource<TestCase, TestCaseRepository> {
  public static final String COLLECTION_PATH = "/v1/testCase";

  static final String FIELDS = "owner,testSuite,entityLink,testDefinition";

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

    public TestCaseList(List<TestCase> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public static class TestCaseResultList extends ResultList<TestCaseResult> {
    @SuppressWarnings("unused")
    public TestCaseResultList() {
      /* Required for serde */
    }

    public TestCaseResultList(List<TestCaseResult> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      operationId = "listTestCases",
      summary = "List testCases",
      tags = "TestCases",
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
    if (entityLink != null) {
      MessageParser.EntityLink entityLinkParsed = MessageParser.EntityLink.parse(entityLink);
      filter.addQueryParam("entityFQN", entityLinkParsed.getFullyQualifiedFieldValue());
    }
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTestCaseVersion",
      summary = "List testCase versions",
      tags = "TestCases",
      description = "Get a list of all the versions of a testCases identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Test Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a TestCase",
      tags = "TestCases",
      description = "Get a TestCase by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The TestCases",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(responseCode = "404", description = "Test for instance {id} is not found")
      })
  public TestCase get(
      @Context UriInfo uriInfo,
      @PathParam("id") UUID id,
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
      operationId = "getTestCaseByName",
      summary = "Get a testCase by name",
      tags = "TestCases",
      description = "Get a testCase by  name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The TestCase",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class))),
        @ApiResponse(responseCode = "404", description = "Test for instance {id} is not found")
      })
  public TestCase getByName(
      @Context UriInfo uriInfo,
      @PathParam("name") String name,
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
      operationId = "getSpecificTestCaseVersion",
      summary = "Get a version of the TestCase",
      tags = "TestCases",
      description = "Get a version of the TestCase by given `id`",
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
      @Parameter(description = "Test Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "Test version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      operationId = "createTestCase",
      summary = "Create a TestCase",
      tags = "TestCases",
      description = "Create a TestCase",
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
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, test, true);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTest",
      summary = "Update a testCase",
      tags = "TestCases",
      description = "Update an existing test using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
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
      operationId = "createOrUpdateTest",
      summary = "Update testCase",
      tags = "TestCases",
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
    TestCase test = getTestCase(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, test, true);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestCase",
      summary = "Delete a testCase",
      tags = "TestCases",
      description = "Delete a testCase by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "TestCase for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Topic Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, true);
  }

  @PUT
  @Path("/{id}/testCaseResult")
  @Operation(
      operationId = "addTestCaseResult",
      summary = "Add test case result data",
      tags = "TestCases",
      description = "Add test case result data to the testCase.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the TestCase. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public TestCase addTestCaseResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the testCase", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid TestCaseResult testCaseResult)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, true);
    TestCase testCase = dao.addTestCaseResult(UUID.fromString(id), testCaseResult);
    return addHref(uriInfo, testCase);
  }

  @GET
  @Path("/{id}/testCaseResult")
  @Operation(
      operationId = "listTestCaseResults",
      summary = "List of testCase results",
      tags = "TestCases",
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
      @Parameter(description = "Id of the testCase", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Filter testCase results after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter testCase results before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Limit the number of testCase results returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of testCase results before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of testCase results after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException {
    RestUtil.validateCursors(before, after);

    ListFilter filter =
        new ListFilter(Include.ALL)
            .addQueryParam("entityId", id.toString())
            .addQueryParam("extension", TestCaseRepository.TESTCASE_RESULT_EXTENSION);

    if (startTs != null) {
      filter.addQueryParam("startTs", String.valueOf(startTs));
    }
    if (endTs != null) {
      filter.addQueryParam("endTs", String.valueOf(endTs));
    }
    return dao.getTestCaseResults(filter, before, after, limitParam);
  }

  @DELETE
  @Path("/{id}/testCaseResult/{timestamp}")
  @Operation(
      operationId = "DeleteTestCaseResult",
      summary = "Delete testCase result.",
      tags = "tables",
      description = "Delete testCase result for a testCase.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the TestCaseResult",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestCase.class)))
      })
  public TestCase deleteTestCaseResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the testCase", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Timestamp of the testCase result", schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, true);
    TestCase testCase = dao.deleteTestCaseResult(id, timestamp);
    return addHref(uriInfo, testCase);
  }

  private TestCase getTestCase(CreateTestCase create, String user) throws IOException {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(create.getEntityLink());
    return copy(new TestCase(), create, user)
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withParameterValues(create.getParameterValues())
        .withEntityLink(create.getEntityLink())
        .withEntityFQN(entityLink.getFullyQualifiedFieldValue())
        .withTestSuite(create.getTestSuite())
        .withTestDefinition(create.getTestDefinition());
  }
}
