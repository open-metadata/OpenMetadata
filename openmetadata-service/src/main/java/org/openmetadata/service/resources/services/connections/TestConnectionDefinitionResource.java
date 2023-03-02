package org.openmetadata.service.resources.services.connections;

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
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.services.connections.CreateTestConnectionDefinition;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestConnectionDefinitionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/testConnectionDefinition")
@Api(value = "Test Connection Definitions collection", tags = "Test Connection Definitions collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestConnectionDefinitions")
public class TestConnectionDefinitionResource
    extends EntityResource<TestConnectionDefinition, TestConnectionDefinitionRepository> {
  public static final String COLLECTION_PATH = "/v1/services/testConnectionDefinition";
  static final String FIELDS = "owner";

  @Override
  public TestConnectionDefinition addHref(UriInfo uriInfo, TestConnectionDefinition testConnectionDefinition) {
    testConnectionDefinition.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, testConnectionDefinition.getId()));
    Entity.withHref(uriInfo, testConnectionDefinition.getOwner());
    return testConnectionDefinition;
  }

  @Inject
  public TestConnectionDefinitionResource(CollectionDAO dao, Authorizer authorizer) {
    super(TestConnectionDefinition.class, new TestConnectionDefinitionRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<TestConnectionDefinition> testConnectionDefinitions =
        dao.getEntitiesFromSeedData(".*json/data/testConnections/.*\\.json$");
    for (TestConnectionDefinition testConnectionDefinition : testConnectionDefinitions) {
      dao.initializeEntity(testConnectionDefinition);
    }
  }

  public static class TestConnectionDefinitionList extends ResultList<TestConnectionDefinition> {
    @SuppressWarnings("unused")
    public TestConnectionDefinitionList() {
      // Empty constructor needed for deserialization
    }
  }

  @GET
  @Operation(
      operationId = "listTestConnectionDefinitions",
      summary = "List test connection definitions",
      tags = "testConnectionDefinitions",
      description =
          "Get a list of test connection definitions. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test connection definitions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(implementation = TestConnectionDefinitionResource.TestConnectionDefinitionList.class)))
      })
  public ResultList<TestConnectionDefinition> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number test connection definitions returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of test connection definitions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of test connection definitions after this cursor",
              schema = @Schema(type = "string"))
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
      operationId = "listAllTestConnectionDefinitionVersion",
      summary = "List test connection definition versions",
      tags = "testConnectionDefinitions",
      description = "Get a list of all the versions of a test connection definition identified by `Id`",
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
      summary = "Get a test connection definition by Id",
      tags = "testConnectionDefinitions",
      description = "Get a Test Connection Definition by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Test Connection definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Test Connection Definition for instance {id} is not found")
      })
  public TestConnectionDefinition get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the test connection definition", schema = @Schema(type = "UUID")) @PathParam("id")
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getTestConnectionDefinitionByName",
      summary = "Get a test connection definition by name",
      tags = "testConnectionDefinitions",
      description = "Get a test connection definition by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test connection definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Test Connection Definition for instance {name} is not found")
      })
  public TestConnectionDefinition getByName(
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
      operationId = "getSpecificTestConnectionDefinitionVersion",
      summary = "Get a version of the test connection definition",
      tags = "testConnectionDefinitions",
      description = "Get a version of the test connection definition by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "TestConnectionDefinition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Test Connection Definition for instance {id} and version {version} is " + "not found")
      })
  public TestConnectionDefinition getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test connection definition", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Test Connection Definition version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTestConnectionDefinition",
      summary = "Create a test connection definition",
      tags = "testConnectionDefinitions",
      description = "Create a Test Connection Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The test connection definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestConnectionDefinition create)
      throws IOException {
    TestConnectionDefinition testConnectionDefinition =
        getTestConnectionDefinition(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, testConnectionDefinition);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTestConnectionDefinition",
      summary = "Update a test connection definition",
      tags = "testConnectionDefinitions",
      description = "Update an existing Test Connection Definition using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the test connection definition", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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
      operationId = "createOrUpdateTestConnectionDefinition",
      summary = "Update test connection definition",
      tags = "testConnectionDefinitions",
      description =
          "Create a Test Connection Definition, if it does not exist, or update an existing Test Connection Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated test connection definition ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTestConnectionDefinition create)
      throws IOException {
    TestConnectionDefinition testConnectionDefinition =
        getTestConnectionDefinition(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, testConnectionDefinition);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTestConnectionDefinition",
      summary = "Delete a test connection definition",
      tags = "testConnectionDefinitions",
      description = "Delete a test connection definition by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test connection definition for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the test connection definition", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTestConnectionDefinitionByName",
      summary = "Delete a test connection definition",
      tags = "testConnectionDefinitions",
      description = "Delete a test connection definition by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Test connection definition for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the test connection definition", schema = @Schema(type = "string"))
          @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted test connection definition",
      tags = "testConnectionDefinitions",
      description = "Restore a soft deleted Test Connection Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Test Connection Definition. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestConnectionDefinition.class)))
      })
  public Response restoreTestConnectionDefinition(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private TestConnectionDefinition getTestConnectionDefinition(CreateTestConnectionDefinition create, String user)
      throws IOException {
    return copy(new TestConnectionDefinition(), create, user)
        .withDescription(create.getDescription())
        .withSteps(create.getSteps())
        .withDisplayName(create.getDisplayName())
        .withName(create.getName());
  }
}
