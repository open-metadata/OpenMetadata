package org.openmetadata.service.resources.datainsight.system;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
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
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/analytics/dataInsights/system/charts")
@Tag(
    name = "Data Insights System Chats",
    description = "APIs related to Data Insights system charts.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "analytics")
public class DataInsightSystemChartResource
    extends EntityResource<DataInsightCustomChart, DataInsightSystemChartRepository> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/system/charts";

  public DataInsightSystemChartResource(Authorizer authorizer, Limits limit) {
    super(Entity.DATA_INSIGHT_CUSTOM_CHART, authorizer, limit);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<DataInsightCustomChart> diCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsight/custom/.*\\.json$");
    for (DataInsightCustomChart diChart : diCharts) {
      repository.initializeEntity(diChart);
    }
  }

  @GET
  @Path("/name/{fqn}/data")
  @Operation(
      operationId = "getDataInsightChartData",
      summary = "Get data insight chart data",
      description = "Get data insight chart data",
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
  public Response getDataByChartName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "FQN of Data Insight Chart",
              required = true,
              schema = @Schema(type = "String", example = "demo_chart"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Events starting from this unix timestamp in milliseconds",
              required = true,
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("start")
          long start,
      @Parameter(
              description = "Events ending from this unix timestamp in milliseconds",
              required = true,
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("end")
          long end,
      @Parameter(
              description = "Any additional filter to fetch the data",
              schema = @Schema(type = "string", example = "{\"query\":{...}}"))
          @QueryParam("filter")
          String filter)
      throws IOException {
    DataInsightCustomChart diChart = getByNameInternal(uriInfo, securityContext, fqn, null, null);
    DataInsightCustomChartResultList resultList =
        repository.getPreviewData(diChart, start, end, filter);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  @GET
  @Path("/listChartData")
  @Operation(
      operationId = "getDataInsightChartData",
      summary = "Get data insight chart data",
      description = "Get data insight chart data",
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
  public Response listChartData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "List of chart names separated by `,`",
              required = true,
              schema = @Schema(type = "String", example = "chart1,chart2"))
          @QueryParam("chartNames")
          String chartNames,
      @Parameter(
              description = "Events starting from this unix timestamp in milliseconds",
              required = true,
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("start")
          long start,
      @Parameter(
              description = "Events ending from this unix timestamp in milliseconds",
              required = true,
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("end")
          long end,
      @Parameter(
              description = "Any additional filter to fetch the data",
              schema = @Schema(type = "string", example = "{\"query\":{...}}"))
          @QueryParam("filter")
          String filter)
      throws IOException {
    Map<String, DataInsightCustomChartResultList> resultList =
        repository.listChartData(chartNames, start, end, filter);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  @GET
      @Path("/generateAPIRequest")
  @Operation(
      operationId = "generateAPIRequest",
      summary = "Generate API request",
      description = "Generate API request",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The API request",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataInsightChart.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response generateAPIRequest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "prompt for API request",
              required = true,
              schema = @Schema(type = "String", example = "chart1,chart2"))
          @QueryParam("prompt")
          String prompt)
      throws IOException {
    String result = repository.generateAPIRequest(prompt);
    return Response.status(Response.Status.OK).entity(result).build();
  }
}
