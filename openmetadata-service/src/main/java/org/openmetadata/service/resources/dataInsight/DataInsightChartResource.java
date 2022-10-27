package org.openmetadata.service.resources.dataInsight;

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
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.datatInsight.DataInsightChart;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataInsight")
@Api(value = "Data Insight collection", tags = "Data Insight collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dataInsight")
public class DataInsightChartResource extends EntityResource<DataInsightChart, DataInsightChartRepository> {
  public static final String COLLECTION_PATH = DataInsightChartRepository.COLLECTION_PATH;
  public static final String FIELDS = "owner";

  @Override
  public DataInsightChart addHref(UriInfo uriInfo, DataInsightChart entity) {
    entity.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, entity.getId()));
    Entity.withHref(uriInfo, entity.getOwner());
    return entity;
  }

  @Inject
  public DataInsightChartResource(CollectionDAO dao, Authorizer authorizer) {
    super(DataInsightChart.class, new DataInsightChartRepository(dao), authorizer);
  }

  public static class DataInsightChartList extends ResultList<DataInsightChart> {
    @SuppressWarnings("unused")
    public DataInsightChartList() {
      // Empty constructor needed for deserialization
    }

    public DataInsightChartList(List<DataInsightChart> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      operationId = "listDataInsightChart",
      summary = "List data charts",
      tags = "DataInsight",
      description = "Get a list of data insight charts",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data insight charts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChartResource.DataInsightChartList.class)))
      })
  public ResultList<DataInsightChart> list(
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
      operationId = "listDataInsightChartVersion",
      summary = "List data insight chart versions",
      tags = "DataInsight",
      description = "Get a list of all the versions of a data insight chart identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data insight chart versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data Inisght chart Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a Data Insight Chart",
      tags = "DataInsigth",
      description = "Get a Data Insight Chart by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Data Insight Chart",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = TestDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Data Insight Chart for instance {id} is not found")
      })
  public DataInsightChart get(
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
      operationId = "getDataInsightChartByName",
      summary = "Get a data insight chart by name",
      tags = "DataInsight",
      description = "Get a data insight chart by  name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data insight chart",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(responseCode = "404", description = "Data Insight Chart for instance {name} is not found")
      })
  public DataInsightChart getByName(
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
      operationId = "getSpecificDataInsightChartVersion",
      summary = "Get a version of the TestDefinition",
      tags = "DataInsight",
      description = "Get a version of the data insight by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "DataInsight",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data Insight Chart for instance {id} and version {version} is " + "not found")
      })
  public DataInsightChart getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data Insight Chart Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "Data Insight Chart version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataInsightChart",
      summary = "Create a Data Insight Chart",
      tags = "DataInsight",
      description = "Create a Data Insight Chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data insight chart",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataInsightChart create)
      throws IOException {
    DataInsightChart dataInsightChart = getDataInsightChart(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataInsightChart);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataInsightChart",
      summary = "Update a data insight chart",
      tags = "DataInsight",
      description = "Update an existing data insight chart using JsonPatch.",
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
      operationId = "createOrUpdateDataInsightChart",
      summary = "Update test definition",
      tags = "TestDefinitions",
      description = "Create a data insight chart, if it does not exist or update an existing data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated data insight chart ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = DataInsightChart.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataInsightChart create)
      throws IOException {
    DataInsightChart dataInsightChart = getDataInsightChart(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataInsightChart);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataInsightChart",
      summary = "Delete a data insight chart",
      tags = "DataInsight",
      description = "Delete a data insight chart by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Data insight chart for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Data Insight Chart Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  //  @GET
  //  @Path()
  private DataInsightChart getDataInsightChart(CreateDataInsightChart create, String user) throws IOException {
    return copy(new DataInsightChart(), create, user)
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withDataIndexType(create.getDataIndexType())
        .withDimensions(create.getDimensions())
        .withMetrics(create.getMetrics())
        .withDisplayName(create.getDisplayName());
  }
}
