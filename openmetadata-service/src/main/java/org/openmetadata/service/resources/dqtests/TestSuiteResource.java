package org.openmetadata.service.resources.dqtests;

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
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/testSuite")
@Api(value = "Test Suite collection", tags = "Test Suite collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestSuites")
public class TestSuiteResource extends EntityResource<TestSuite, TestSuiteRepository> {
  public static final String COLLECTION_PATH = "/v1/testSuite";

  static final String FIELDS = "owner,tests";

  @Override
  public TestSuite addHref(UriInfo uriInfo, TestSuite testSuite) {
    testSuite.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, testSuite.getId()));
    Entity.withHref(uriInfo, testSuite.getOwner());
    return testSuite;
  }

  @Inject
  public TestSuiteResource(CollectionDAO dao, Authorizer authorizer) {
    super(TestSuite.class, new TestSuiteRepository(dao), authorizer);
  }

  public static class TestSuiteList extends ResultList<TestSuite> {
    @SuppressWarnings("unused")
    public TestSuiteList() {
      // Empty constructor needed for deserialization
    }
  }

  @GET
  @Operation(
      operationId = "listTestSuites",
      summary = "List test suites",
      tags = "testSuites",
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
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTestSuiteVersion",
      summary = "List test suite versions",
      tags = "testSuites",
      description = "Get a list of all the versions of a test suite identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test suite versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a test suite by Id",
      tags = "testSuites",
      description = "Get a Test Suite by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Test suite",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "404", description = "Test Suite for instance {id} is not found")
      })
  public TestSuite get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getTestSuiteByName",
      summary = "Get a test suite by name",
      tags = "testSuites",
      description = "Get a test suite by  name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test suite",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "404", description = "Test Suite for instance {name} is not found")
      })
  public TestSuite getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the test suite", schema = @Schema(type = "string")) @PathParam("name")
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
      operationId = "getSpecificTestSuiteVersion",
      summary = "Get a version of the test suite",
      tags = "testSuites",
      description = "Get a version of the test suite by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "TestSuite",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Suite for instance {id} and version {version} is " + "not found")
      })
  public TestSuite getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Test Suite version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTestSuite",
      summary = "Create a test suite",
      tags = "testSuites",
      description = "Create a test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test suite",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestSuite create)
      throws IOException {
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, testSuite);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTestSuite",
      summary = "Update a test suite",
      tags = "testSuites",
      description = "Update an existing testSuite using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "createOrUpdateTestSuite",
      summary = "Update test suite",
      tags = "testSuites",
      description = "Create a TestSuite, it it does not exist or update an existing test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test definition ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestSuite create)
      throws IOException {
    TestSuite testSuite = getTestSuite(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, testSuite);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTestSuiteByName",
      summary = "Delete a test suite",
      tags = "testSuites",
      description = "Delete a test suite by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test suite for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the test suite", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestSuite",
      summary = "Delete a test suite",
      tags = "testSuites",
      description = "Delete a test suite by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test suite for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the test suite", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted test suite",
      tags = "testSuites",
      description = "Restore a soft deleted test suite.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the TestSuite.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TestSuite.class)))
      })
  public Response restoreTestSuite(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private TestSuite getTestSuite(CreateTestSuite create, String user) throws IOException {
    return copy(new TestSuite(), create, user)
        .withDescription(create.getDescription())
        .withDisplayName(create.getDisplayName())
        .withName(create.getName());
  }
}
