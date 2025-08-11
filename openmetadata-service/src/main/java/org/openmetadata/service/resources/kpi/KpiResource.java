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
import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
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
  private final KpiMapper mapper = new KpiMapper();
  static final String FIELDS = "owners,dataInsightChart,kpiResult";

  @Override
  public Kpi addHref(UriInfo uriInfo, Kpi kpi) {
    super.addHref(uriInfo, kpi);
    Entity.withHref(uriInfo, kpi.getDataInsightChart());
    return kpi;
  }

  public KpiResource(Authorizer authorizer, Limits limits) {
    super(Entity.KPI, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("dataInsightChart,kpiResult", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class KpiList extends ResultList<Kpi> {
    /* Required for serde */
  }

  public static class KpiResultList extends ResultList<KpiResult> {
    /* Required for serde */
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KpiList.class)))
      })
  public ResultList<Kpi> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of KIPs returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of tests before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of tests after this cursor",
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
      operationId = "listAllKpiVersion",
      summary = "List KPI versions",
      description = "Get a list of all the versions of a KPI identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KPI versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "404", description = "KPI for instance {id} is not found")
      })
  public Kpi get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Path("/name/{name}")
  @Operation(
      operationId = "getKpiByName",
      summary = "Get a KPI by name",
      description = "Get a KPI by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The KPI",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "404", description = "Kpi for instance {name} is not found")
      })
  public Kpi getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string"))
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KPI for instance {id} and version {version} is not found")
      })
  public Kpi getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "KPI version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateKpiRequest create) {
    Kpi kpi = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
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
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchKpi(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
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
      operationId = "patchKpi",
      summary = "Update a KPI by name.",
      description = "Update an existing KPI using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchKpi(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string"))
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
      operationId = "createOrUpdateKpi",
      summary = "Update KPI",
      description = "Create a KPI, it it does not exist or update an existing KPI.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated KPI Objective ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateKpiRequest create) {
    Kpi kpi = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
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
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
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
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteKpiAsync",
      summary = "Asynchronously delete a KPI by Id",
      description = "Asynchronously delete a KPI by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KPI for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the KPI", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Kpi.class)))
      })
  public Response restoreKpi(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
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
  public DataInsightCustomChartResultList listKpiResults(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Filter KPI results after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter KPI results before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(description = "Order the result ", schema = @Schema(type = "string"))
          @Valid
          @QueryParam("orderBy")
          @DefaultValue("DESC")
          OrderBy orderBy)
      throws IOException {
    return repository.getKpiResults(name, startTs, endTs, orderBy);
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
      @Parameter(description = "Name of the KPI", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return repository.getKpiResult(name);
  }
}
