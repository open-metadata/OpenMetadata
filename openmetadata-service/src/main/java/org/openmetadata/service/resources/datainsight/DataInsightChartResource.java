package org.openmetadata.service.resources.datainsight;

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
import jakarta.json.JsonPatch;
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
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/analytics/dataInsights/charts")
@Tag(name = "Data Insights", description = "APIs related to Data Insights data and charts.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "analytics")
public class DataInsightChartResource
    extends EntityResource<DataInsightChart, DataInsightChartRepository> {

  private final DataInsightChartMapper mapper = new DataInsightChartMapper();
  public static final String COLLECTION_PATH = DataInsightChartRepository.COLLECTION_PATH;
  public static final String FIELDS = "owners";
  private final SearchRepository searchRepository;

  public DataInsightChartResource(Authorizer authorizer, Limits limits) {
    super(Entity.DATA_INSIGHT_CHART, authorizer, limits);
    searchRepository = Entity.getSearchRepository();
  }

  public static class DataInsightChartList extends ResultList<DataInsightChart> {
    /* Required for serde */
  }

  public static class DataInsightChartResultList extends ResultList<DataInsightChartResult> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing webAnalyticEventTypes and add them from json files
    List<DataInsightChart> dataInsightCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsight/.*\\.json$");
    for (DataInsightChart dataInsightChart : dataInsightCharts) {
      repository.initializeEntity(dataInsightChart);
    }
  }

  @GET
  @Operation(
      operationId = "listDataInsightChart",
      summary = "List data insight charts",
      description = "Get a list of data insight charts",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data insight charts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation = DataInsightChartResource.DataInsightChartList.class)))
      })
  public ResultList<DataInsightChart> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number data insight chart returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of data insight chart before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of data insight chart after this cursor",
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
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listDataInsightChartVersion",
      summary = "List data insight chart versions",
      description = "Get a list of all the versions of a data insight chart identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data insight chart versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "listDataInsightChartId",
      summary = "Get a data insight chart by Id",
      description = "Get a Data Insight Chart by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Data Insight Chart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data Insight Chart for instance {id} is not found")
      })
  public DataInsightChart get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
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
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDataInsightChartByName",
      summary = "Get a data insight chart by fully qualified name",
      description = "Get a data insight chart by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data insight chart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data Insight Chart for instance {fqn} is not found")
      })
  public DataInsightChart getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the data insight chart",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDataInsightChartVersion",
      summary = "Get a version of the data insight chart",
      description = "Get a version of the data insight by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "DataInsight",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data Insight Chart for instance {id} and version {version} is not found")
      })
  public DataInsightChart getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Data Insight Chart version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataInsightChart",
      summary = "Create a data insight chart",
      description = "Create a data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data insight chart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataInsightChart create) {
    DataInsightChart dataInsightChart =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataInsightChart);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataInsightChart",
      summary = "Update a data insight chart",
      description = "Update an existing data insight chart using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
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
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchDataInsightChart",
      summary = "Update a data insight chart by name.",
      description = "Update an existing data insight chart using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data insight chart", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataInsightChart",
      summary = "Update data insight chart",
      description =
          "Create a data insight chart, if it does not exist or update an existing data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated data insight chart ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataInsightChart create) {
    DataInsightChart dataInsightChart =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataInsightChart);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataInsightChart",
      summary = "Delete a data insight chart by Id",
      description = "Delete a data insight chart by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data insight chart for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDataInsightChartAsync",
      summary = "Asynchronously delete a data insight chart by Id",
      description = "Asynchronously delete a data insight chart by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data insight chart for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the data insight chart", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDataInsightChartByName",
      summary = "Delete a data insight chart by fully qualified name",
      description = "Delete a data insight chart by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data insight chart for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the data insight chart",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted data insight chart",
      description = "Restore a soft deleted data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the DataInsightChart. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class)))
      })
  public Response restoreDataInsightChart(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/aggregate")
  @Operation(
      operationId = "getDataInsightChartResults",
      summary = "Get aggregated data for a data insight chart",
      description = "Get aggregated data for a data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Data Insight Chart Results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                DataInsightChartResource.DataInsightChartResultList.class)))
      })
  public Response listDataInsightChartResult(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Get aggregated data for a specific chart name",
              schema = @Schema(implementation = DataInsightChartResult.DataInsightChartType.class))
          @NonNull
          @QueryParam("dataInsightChartName")
          DataInsightChartResult.DataInsightChartType dataInsightChartName,
      @Parameter(description = "Query filter for the aggregation") @QueryParam("queryFilter")
          String queryFilter,
      @Parameter(description = "Limit the number of results returned.")
          @DefaultValue("10")
          @QueryParam("size")
          Integer size,
      @Parameter(description = "Offset the results returned. (default = 0)")
          @DefaultValue("0")
          @QueryParam("from")
          Integer from,
      @Parameter(
              description = "Specify the elasticsearch index to fetch data from",
              schema = @Schema(implementation = DataReportIndex.class))
          @NonNull
          @QueryParam("dataReportIndex")
          String dataReportIndex,
      @Parameter(
              description = "Tier filter. The value will be used to filter results",
              schema =
                  @Schema(
                      type = "string",
                      example = "Tier.Tier1,Tier.Tier2,Tier.Tier3,Tier.Tier4,Tier.Tier5"))
          @QueryParam("tier")
          String tier,
      @Parameter(
              description = "Team filter. The value will be used to filter results",
              schema = @Schema(type = "string"))
          @QueryParam("team")
          String team,
      @Parameter(
              description = "Organization filter. The value will be used to filter results",
              schema = @Schema(type = "string"))
          @QueryParam("organization")
          String organization,
      @Parameter(
              description = "Filter after the given start timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter before the given end timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(Entity.DATA_INSIGHT_CHART, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    return searchRepository.listDataInsightChartResult(
        startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
  }
}
