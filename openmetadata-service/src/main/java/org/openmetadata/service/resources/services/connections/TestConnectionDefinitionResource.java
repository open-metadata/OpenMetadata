package org.openmetadata.service.resources.services.connections;

import static org.openmetadata.service.services.connections.TestConnectionDefinitionService.FIELDS;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.connections.TestConnectionDefinitionService;

@Slf4j
@Path("/v1/services/testConnectionDefinitions")
@Tag(
    name = "Test Connection Definitions",
    description = "Test Connection Definitions collection operations")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestConnectionDefinitions")
public class TestConnectionDefinitionResource {
  public static final String COLLECTION_PATH = "/v1/services/testConnectionDefinitions";
  private final TestConnectionDefinitionService service;

  public TestConnectionDefinitionResource(TestConnectionDefinitionService service) {
    this.service = service;
  }

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
                        @Schema(
                            implementation =
                                TestConnectionDefinitionService.TestConnectionDefinitionList
                                    .class)))
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
              description =
                  "Limit the number test connection definitions returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
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
          Include include) {
    ListFilter filter = new ListFilter(include);
    return service.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
        @ApiResponse(
            responseCode = "404",
            description = "Test Connection Definition for instance {id} is not found")
      })
  public TestConnectionDefinition get(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Id of the test connection definition",
              schema = @Schema(type = "UUID"))
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
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
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
        @ApiResponse(
            responseCode = "404",
            description = "Test Connection Definition for instance {name} is not found")
      })
  public TestConnectionDefinition getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the test definition", schema = @Schema(type = "string"))
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
    return service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }
}
