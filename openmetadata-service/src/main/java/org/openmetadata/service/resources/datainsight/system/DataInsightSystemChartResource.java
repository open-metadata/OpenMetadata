package org.openmetadata.service.resources.datainsight.system;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
  private static final Logger LOG = LoggerFactory.getLogger(DataInsightSystemChartResource.class);

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
          String filter,
      @Parameter(
              description = "Use live index for chart",
              schema = @Schema(type = "boolean", example = "false"))
          @QueryParam("live")
          boolean live)
      throws IOException {
    Map<String, DataInsightCustomChartResultList> resultList =
        repository.listChartData(chartNames, start, end, filter, live);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  @POST
  @Path("/stream")
  @Operation(
      operationId = "startChartDataStreaming",
      summary = "Start streaming chart data via WebSocket",
      description =
          "Starts a WebSocket streaming session for chart data that lasts 10 minutes with updates every 2 seconds",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Streaming session started successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Map.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
      })
  public Response startChartDataStreaming(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "List of chart names separated by `,`",
              required = true,
              schema = @Schema(type = "String", example = "chart1,chart2"))
          @QueryParam("chartNames")
          String chartNames,
      @Parameter(
              description = "Service name for filtering",
              schema = @Schema(type = "String", example = "myService"))
          @QueryParam("serviceName")
          String serviceName,
      @Parameter(
              description = "Any additional filter to fetch the data",
              schema = @Schema(type = "string", example = "{\"query\":{...}}"))
          @QueryParam("filter")
          String filter,
      @Parameter(
              description = "Start time for data fetching (unix timestamp in milliseconds)",
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("startTime")
          Long startTime,
      @Parameter(
              description = "End time for data fetching (unix timestamp in milliseconds)",
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("endTime")
          Long endTime) {

    try {
      // Get the current user
      String username = securityContext.getUserPrincipal().getName();
      User user =
          Entity.getCollectionDAO()
              .userDAO()
              .findEntityByName(FullyQualifiedName.quoteName(username));

      // Call repository method to handle streaming
      Map<String, Object> response =
          repository.startChartDataStreaming(
              chartNames, serviceName, filter, user.getId(), startTime, endTime);

      // Check if there's an error in the response
      if (response.containsKey("error")) {
        return Response.status(Response.Status.BAD_REQUEST).entity(response).build();
      }

      return Response.status(Response.Status.OK).entity(response).build();

    } catch (Exception e) {
      LOG.error("Error starting chart data streaming", e);
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Failed to start streaming: " + e.getMessage());
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(errorResponse).build();
    }
  }
}
