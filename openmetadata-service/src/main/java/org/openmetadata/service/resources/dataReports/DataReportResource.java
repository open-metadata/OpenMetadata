package org.openmetadata.service.resources.dataReports;

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
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.api.data.CreateDataReport;
import org.openmetadata.schema.entity.data.DataReport;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataReportRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ElasticSearchClientUtils;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.quartz.SchedulerException;

@Slf4j
@Path("/v1/dataReport")
@Api(value = "Reports collection", tags = "Data Reports collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dataReport")
public class DataReportResource extends EntityResource<DataReport, DataReportRepository> {

  public static final String COLLECTION_PATH = "v1/dataReport/";
  public static final String DATA_INSIGHT_EMAIL_JOB = "dataInsightEmailJob";
  public static final String EMAIL_REPORT = "emailReport";
  public static final String CRON_TRIGGER = "dataInsightEmailTrigger";
  public static final String JOB_CONTEXT_CHART_REPO = "dataInsightChartRepository";
  public static final String ES_REST_CLIENT = "esRestClient";
  private final CollectionDAO.DataReportDAO dataReportDAO;
  private RestHighLevelClient client;

  @Override
  public DataReport addHref(UriInfo uriInfo, DataReport entity) {
    return entity;
  }

  private static class DataReportConfigList extends ResultList<DataReport> {

    @SuppressWarnings("unused")
    public DataReportConfigList() {}
  }

  public DataReportResource(CollectionDAO dao, Authorizer authorizer) {
    super(DataReport.class, new DataReportRepository(dao), authorizer);
    dataReportDAO = dao.dataReportDAO();
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    if (config.getElasticSearchConfiguration() != null) {
      this.client = ElasticSearchClientUtils.createElasticSearchClient(config.getElasticSearchConfiguration());
    }
    try {
      List<String> listAllDataReportConfigs = dataReportDAO.listAllDataReportConfig();
      List<DataReport> dataReportList = JsonUtils.readObjects(listAllDataReportConfigs, DataReport.class);
      for (DataReport dataReport : dataReportList) {
        dao.addDataReportConfig(dataReport, client);
      }
    } catch (Exception ex) {
      LOG.warn("Exception during initialization", ex);
    }
  }

  @GET
  @Operation(
      operationId = "listDataReportConfig",
      summary = "List data report config",
      tags = "dataReport",
      description = "Get a list of data report config",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data reports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataReportConfigList.class))),
      })
  public ResultList<DataReport> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Filter dataReport by type",
              schema = @Schema(type = "string", example = "dataInsight, testSuite"))
          @QueryParam("dataReportType")
          String typeParam,
      @Parameter(description = "Limit the number data cart configs returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of data cart configs before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of data cart configs after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(Include.ALL).addQueryParam("dataReportType", typeParam);
    return listInternal(uriInfo, securityContext, "", filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "getDataReportById",
      summary = "Get a data report config",
      tags = "dataReport",
      description = "Get a data report config by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity Events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataReport.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public DataReport get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "dataReport Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDataReportByFQN",
      summary = "Get a data report by name",
      tags = "dataReport",
      description = "Get a data report by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "data report",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataReport.class))),
        @ApiResponse(responseCode = "404", description = "DataReport for instance {id} is not found")
      })
  public DataReport getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data chart", schema = @Schema(type = "string")) @PathParam("name")
          String name,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, "", include);
  }

  @POST
  @Operation(
      operationId = "createDataReportConfig",
      summary = "data report config",
      tags = "dataReport",
      description = "data report config",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dataReport",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataReport.class))),
      })
  public Response createDataReportConfig(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataReport create)
      throws IOException, SchedulerException {
    DataReport dataReport = getDataReport(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, dataReport);
    dao.addDataReportConfig(dataReport, client);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataReport",
      summary = "Updated an existing or create a new dataReport",
      tags = "dataReport",
      description = "Updated an existing or create a new dataReport",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dataReport",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataReport.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response updateDataReport(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataReport create)
      throws IOException, SchedulerException {
    DataReport dataReport = getDataReport(create, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, dataReport);
    dao.updateDataReportConfig((DataReport) response.getEntity(), client);
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataReport",
      summary = "Update a dataReport",
      tags = "dataReport",
      description = "Update an existing dataReport using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
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
      throws IOException, SchedulerException {
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    dao.updateDataReportConfig((DataReport) response.getEntity(), client);
    return response;
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "deleteDataReport",
      summary = "Delete a dataReport",
      tags = "dataReport",
      description = "Get a dataReport by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataReport.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteDataReport(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "dataReport Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException, SchedulerException {
    Response response = delete(uriInfo, securityContext, id, false, true);
    dao.deleteDataReportConfig((DataReport) response.getEntity(), client);
    return response;
  }

  public DataReport getDataReport(CreateDataReport create, String user) throws IOException {
    return copy(new DataReport(), create, user)
        .withDataReportType(create.getDataReportType())
        .withScheduleConfig(create.getScheduleConfig())
        .withEndpointConfiguration(create.getEndpointConfiguration())
        .withEndpointType(create.getEndpointType());
  }
}
