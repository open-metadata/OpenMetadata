package org.openmetadata.service.resources.services.connections;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
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
@Path("/v1/services/testConnectionDefinitions")
@Api(value = "Test Connection Definitions collection", tags = "Test Connection Definitions collection")
@Tag(name = "Test Connection Definitions")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestConnectionDefinitions")
public class TestConnectionDefinitionResource
    extends EntityResource<TestConnectionDefinition, TestConnectionDefinitionRepository> {
  public static final String COLLECTION_PATH = "/v1/services/testConnectionDefinitions";
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

  // TODO remove the list method?
  @GET
  @Operation(
      operationId = "listTestConnectionDefinitions",
      summary = "List test connection definitions",
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
  @Path("/{id}")
  @Operation(
      summary = "Get a test connection definition by Id",
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
}
