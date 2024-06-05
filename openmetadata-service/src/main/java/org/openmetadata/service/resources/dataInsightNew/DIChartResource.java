package org.openmetadata.service.resources.dataInsightNew;

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
import org.openmetadata.schema.api.dataInsightNew.CreateDIChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsightNew.DIChart;
import org.openmetadata.schema.dataInsightNew.DIChartResultList;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DIChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/analytics/dataInsights_new/charts")
@Tag(name = "Data Insights NEW", description = "APIs related to Data Insights data and charts.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "analytics")
public class DIChartResource extends EntityResource<DIChart, DIChartRepository> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights_new/charts";
  static final String FIELDS = "owner";

  public DIChartResource(Authorizer authorizer) {
    super(Entity.DI_CHART, authorizer);
  }

  public static class DIChartList extends ResultList<DIChart> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing webAnalyticEventTypes and add them from json files
    List<DIChart> diCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsightNew/.*\\.json$");
    for (DIChart diChart : diCharts) {
      repository.initializeEntity(diChart);
    }
  }

  @GET
  @Operation(
      operationId = "listDICharts",
      summary = "List di charts",
      description =
          "Get a list of data insight charts."
              + "Use field parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data insight charts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChartResource.DIChartList.class)))
      })
  public ResultList<DIChart> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number report Definition returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of report definitions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of report definitions after this cursor",
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

  @POST
  @Operation(
      operationId = "createDIChart",
      summary = "Create a data insight chart",
      description = "Create a web data insight chart",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create a data insight chart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDIChart create) {
    DIChart diChart = getDIChart(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, diChart);
  }

  @GET
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
      @Valid CreateDIChart create)
      throws IOException {
    //        DIChart diChart = getDIChart(create, securityContext.getUserPrincipal().getName());
    //        return repository.ge
    DIChartResultList resultList = repository.getPreviewData(create, start, end);
    return Response.status(Response.Status.OK).entity(resultList).build();
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDIChart",
      summary = "Update a data insight chart",
      description = "Update data insight chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated data insight chart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDIChart create) {
    DIChart diChart = getDIChart(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, diChart);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDIChartById",
      summary = "Get a data insight chart type by Id",
      description = "Get a data insight chart by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic Event for instance {id} is not found")
      })
  public DIChart get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
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

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWebAnalyticEventTypeById",
      summary = "Update a web analytic event type by Id",
      description = "Update a web analytic event type.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
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
      operationId = "patchWebAnalyticEventTypeByName",
      summary = "Update a web analytic event type by fully qualified name",
      description = "Update a web analytic event type by `fullyQualifiedName`.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the web analytic event", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeById",
      summary = "Delete a web analytic event type by Id",
      description = "Delete a web analytic event type by Id.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeByName",
      summary = "Delete a web analytic event type by fully qualified name",
      description = "Delete a web analytic event type by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the web analytic event",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted web analytic event",
      description = "Restore a soft deleted web analytic event.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the DIChart. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class)))
      })
  public Response restoreWebAnalyticEvent(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getWebAnalyticEventTypeByName",
      summary = "Get a web analytic event type by fully qualified name",
      description = "Get a web analytic event type by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event type for instance {fqn} is not found")
      })
  public DIChart getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the web analytic event",
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWebAnalyticEventTypeVersion",
      summary = "List web analytic event type versions",
      description = "Get a list of all the version of a web analytic event type by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List all web analytic event type versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWebAnalyticEventTypeVersion",
      summary = "Get a version of the report definition",
      description = "Get a version of the web analytic event type by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "DIChart",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DIChart.class))),
        @ApiResponse(
            responseCode = "404",
            description =
                "Web Analytic event type for instance {id} and version {version} is not found")
      })
  public DIChart getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Web Analytic Event type version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  private DIChart getDIChart(CreateDIChart create, String user) {
    return repository
        .copy(new DIChart(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription());
    //        .withEsRequest(create.getEsRequest());
  }
}
