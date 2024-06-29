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
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
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
import org.openmetadata.schema.api.dataInsight.custom.CreateDataInsightCustomChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
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

  public DataInsightSystemChartResource(Authorizer authorizer) {
    super(Entity.DATA_INSIGHT_CUSTOM_CHART, authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<DataInsightCustomChart> diCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsight/custom/.*\\.json$");
    for (DataInsightCustomChart diChart : diCharts) {
      repository.initializeEntity(diChart);
    }
  }

  // TODO: NEED TO DELETE THIS AFTER DEMO
  @POST
  @Path("/preview")
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
  public Response preview(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
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
      @Valid CreateDataInsightCustomChart create)
      throws IOException {
    DataInsightCustomChart diChart =
        getDataInsightCustomChart(create, securityContext.getUserPrincipal().getName());
    DataInsightCustomChartResultList resultList = repository.getPreviewData(diChart, start, end);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  @GET
  @Path("/name/{fqn}/preview")
  @Operation(
      operationId = "getDataInsightChartPreview",
      summary = "Get data insight chart preview",
      description = "Get data insight chart preview",
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
  public Response previewByName(
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
          long end)
      throws IOException {
    DataInsightCustomChart diChart = getByNameInternal(uriInfo, securityContext, fqn, null, null);
    DataInsightCustomChartResultList resultList = repository.getPreviewData(diChart, start, end);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  private DataInsightCustomChart getDataInsightCustomChart(
      CreateDataInsightCustomChart create, String user) {
    return repository
        .copy(new DataInsightCustomChart(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withChartDetails(create.getChartDetails())
        .withOwner(create.getOwner());
  }
}
