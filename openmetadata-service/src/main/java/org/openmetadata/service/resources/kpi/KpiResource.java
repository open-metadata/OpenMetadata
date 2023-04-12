package org.openmetadata.service.resources.kpi;

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
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/kpi")
@Tag(name = "KPIs", description = "A `KPI` defines a metric and a target.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "kpi")
public class KpiResource extends EntityResource<Kpi, KpiRepository> {
  public static final String COLLECTION_PATH = "/v1/kpi";

  static final String FIELDS = "owner,dataInsightChart,kpiResult";

  @Override
  public Kpi addHref(UriInfo uriInfo, Kpi kpi) {
    kpi.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, kpi.getId()));
    Entity.withHref(uriInfo, kpi.getOwner());
    Entity.withHref(uriInfo, kpi.getDataInsightChart());
    return kpi;
  }

  public KpiResource(CollectionDAO dao, Authorizer authorizer) {
    super(Kpi.class, new KpiRepository(dao), authorizer);
  }

  public static class KpiList extends ResultList<Kpi> {
    @SuppressWarnings("unused")
    public KpiList() {
      // Empty constructor needed for deserialization
    }
  }

  public static class KpiResultList extends ResultList<KpiResult> {
    @SuppressWarnings("unused")
    public KpiResultList() {
      /* Required for serde */
    }
  }

  @GET
  @Operation(
      operationId = "listKpis",
      summary = "List KPIs",
      description =
          "Get a list of KPIs. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KPIs",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = KpiList.class)))
      })
  public ResultList<Kpi> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of KIPs returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tests before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tests after this cursor", schema = @Schema(type = "string"))
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
      operationId = "listAllKpiVersion",
      summary = "List KPI versions",
      description = "Get a list of all the versions of a KPI identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KPI versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a KPI by Id",
      description = "Get a KPI by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KPI",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "404", description = "KPI for instance {id} is not found")
      })
  public Kpi get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getKpiByName",
      summary = "Get a KPI by name",
      description = "Get a KPI by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KPI",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "404", description = "Kpi for instance {name} is not found")
      })
  public Kpi getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name,
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
      operationId = "getSpecificKpiVersion",
      summary = "Get a version of the KPI",
      description = "Get a version of the KPI by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KPI",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KPI for instance {id} and version {version} is " + "not found")
      })
  public Kpi getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "KPI version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createKpi",
      summary = "Create a KPI",
      description = "Create a KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KPI",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKpiRequest create)
      throws IOException {
    Kpi kpi = getKpi(create, securityContext.getUserPrincipal().getName());
    // TODO fix this
    //    dao.validateDataInsightChartOneToOneMapping(kpi.getDataInsightChart().getId());
    return create(uriInfo, securityContext, kpi);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchKpi",
      summary = "Update a KPI",
      description = "Update an existing KPI using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchKpi(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "createOrUpdateKpi",
      summary = "Update KPI",
      description = "Create a KPI, it it does not exist or update an existing KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated KPI Objective ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKpiRequest create)
      throws IOException {
    Kpi kpi = getKpi(create, securityContext.getUserPrincipal().getName());
    // Check if this kpi exist
    try {
      // if a kpi exits it is an update call
      dao.getByName(null, kpi.getName(), dao.getFields("id,name"));
    } catch (EntityNotFoundException ex) {
      // if the kpi doesn't exist , then it can get created so need to ensure one to one validation
      // TODO fix this
      // dao.validateDataInsightChartOneToOneMapping(kpi.getDataInsightChart().getId());
    }
    return createOrUpdate(uriInfo, securityContext, kpi);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteKpiByName",
      summary = "Delete a KPI by name",
      description = "Delete a KPI by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KPI for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteKpi",
      summary = "Delete a KPI by Id",
      description = "Delete a KPI by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KPI for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted KPI",
      description = "Restore a soft deleted KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the KPI. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class)))
      })
  public Response restoreKpi(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{name}/kpiResult")
  @Operation(
      operationId = "addKpiResult",
      summary = "Add KPI result data",
      description = "Add KPI Result data to the KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the KPI. ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class)))
      })
  public Response addKpiResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name,
      @Valid KpiResult kpiResult)
      throws IOException {
    return dao.addKpiResult(uriInfo, name, kpiResult).toResponse();
  }

  @GET
  @Path("/{name}/kpiResult")
  @Operation(
      operationId = "listKpiResults",
      summary = "List of KPI results",
      description =
          "Get a list of all the KPI results for the given KPI id, optionally filtered by  `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KPI results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KpiResource.KpiResultList.class)))
      })
  public ResultList<KpiResult> listKpiResults(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name,
      @Parameter(description = "Filter KPI results after the given start timestamp", schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(description = "Filter KPI results before the given end timestamp", schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Order the result ", schema = @Schema(type = "string"))
          @Valid
          @QueryParam("orderBy")
          @DefaultValue("DESC")
          CollectionDAO.EntityExtensionTimeSeriesDAO.OrderBy orderBy)
      throws IOException {
    return dao.getKpiResults(name, startTs, endTs, orderBy);
  }

  @GET
  @Path("/{name}/latestKpiResult")
  @Operation(
      operationId = "getLatestKpiResults",
      summary = "Get a latest KPI Result",
      description = "Get Latest KPI Result for the given KPI",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Latest KPI Result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KpiResource.KpiResultList.class)))
      })
  public KpiResult listKpiResults(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return dao.getKpiResult(name);
  }

  @DELETE
  @Path("/{name}/kpiResult/{timestamp}")
  @Operation(
      operationId = "deleteKpiResult",
      summary = "Delete KPI result",
      description = "Delete KPI result for a KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted the KpiResult",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Kpi.class)))
      })
  public Response deleteKpiResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string")) @PathParam("name") String name,
      @Parameter(description = "Timestamp of the KPI result", schema = @Schema(type = "long")) @PathParam("timestamp")
          Long timestamp)
      throws IOException {
    return dao.deleteKpiResult(name, timestamp).toResponse();
  }

  private Kpi getKpi(CreateKpiRequest create, String user) throws IOException {
    return copy(new Kpi(), create, user)
        .withStartDate(create.getStartDate())
        .withEndDate(create.getEndDate())
        .withTargetDefinition(create.getTargetDefinition())
        .withDataInsightChart(getEntityReference(Entity.DATA_INSIGHT_CHART, create.getDataInsightChart()))
        .withMetricType(create.getMetricType());
  }
}
