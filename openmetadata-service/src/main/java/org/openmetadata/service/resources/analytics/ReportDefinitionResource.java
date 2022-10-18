package org.openmetadata.service.resources.analytics;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

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
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.analytics.ReportDefinition;
import org.openmetadata.schema.analytics.type.ReportResult;
import org.openmetadata.schema.api.tests.CreateReportDefinition;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ReportDefinitionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/analytics/report")
@Api(value = "AnalyticsReport collection", tags = "AnalyticsReport collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "AnalyticsReport")
public class ReportDefinitionResource extends EntityResource<ReportDefinition, ReportDefinitionRepository> {
  public static final String COLLECTION_PATH = ReportDefinitionRepository.COLLECTION_PATH;
  static final String FIELDS = "owner";
  private final ReportDefinitionRepository daoReportDefinition;

  @Override
  public ReportDefinition addHref(UriInfo uriInfo, ReportDefinition reportDefinition) {
    reportDefinition.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, reportDefinition.getId()));
    Entity.withHref(uriInfo, reportDefinition.getOwner());
    return reportDefinition;
  }

  @Inject
  public ReportDefinitionResource(CollectionDAO dao, Authorizer authorizer) {
    super(ReportDefinition.class, new ReportDefinitionRepository(dao), authorizer);
    this.daoReportDefinition = new ReportDefinitionRepository(dao);
  }

  @SuppressWarnings("unused") // Method used for reflection of reportDefinitions
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing reportDefinition and them from json files
    List<String> reportDefinitionFiles = EntityUtil.getJsonDataResources(".*json/data/analytics/.*\\.json$");
    reportDefinitionFiles.forEach(
        reportDefinitionFile -> {
          try {
            String reportDefinitionJson =
                CommonUtil.getResourceAsStream(getClass().getClassLoader(), reportDefinitionFile);
            reportDefinitionJson = reportDefinitionJson.replace("<separator>", Entity.SEPARATOR);
            ReportDefinition reportDefinition = JsonUtils.readValue(reportDefinitionJson, ReportDefinition.class);
            long currentTimestamp = System.currentTimeMillis();
            reportDefinition.withId(UUID.randomUUID()).withUpdatedBy(ADMIN_USER_NAME).withUpdatedAt(currentTimestamp);
            daoReportDefinition.initSeedData(reportDefinition);
          } catch (Exception e) {
            LOG.warn("Failed to initialized report definition files {}", reportDefinitionFile, e);
          }
        });
  }

  public static class ReportDefinitionList extends ResultList<ReportDefinition> {
    @SuppressWarnings("unused")
    public ReportDefinitionList() {
      // Empty constructor needed for deserialization
    }

    public ReportDefinitionList(List<ReportDefinition> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public static class ReportResultList extends ResultList<ReportResult> {
    @SuppressWarnings("unused")
    public ReportResultList() {
      // Empty constructor needed for deserialization
    }

    public ReportResultList(List<ReportResult> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      operationId = "listReportDefinition",
      summary = "List report definitions",
      tags = "ReportDefinition",
      description =
          "Get a list of test definitions. You can filter by report name and "
              + "Use field parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of report definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ReportDefinitionResource.ReportDefinitionList.class)))
      })
  public ResultList<ReportDefinition> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number report Definition returned. (1 to 1000000, default = " + "10)")
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
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @POST
  @Operation(
      operationId = "createReportDefinition",
      summary = "Create a report definition",
      tags = "ReportDefinition",
      description = "Create report definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create a report definition",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateReportDefinition create)
      throws IOException {
    ReportDefinition reportDefinition = getReportDefinition(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, reportDefinition, true);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateReportDefinition",
      summary = "Update report definition",
      tags = "ReportDefinition",
      description = "Update report definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated report definition",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateReportDefinition create)
      throws IOException {
    ReportDefinition reportDefinition = getReportDefinition(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, reportDefinition, true);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getReportDefinitionById",
      summary = "Get a report Definition by id",
      tags = "ReportDefinition",
      description = "Get a report definition by `ID`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A report definition",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Report Definition for instance {id} is not found")
      })
  public ReportDefinition get(
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

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patcheReportDefinition",
      summary = "Update a report definition",
      tags = "ReportDefinition",
      description = "Update a report definition.",
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteReportDefinition",
      summary = "delete a report definition",
      tags = "ReportDefinition",
      description = "Delete a report definition by id.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Report definition for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Report Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, true);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getReportDefinitionByName",
      summary = "Get a report definition by Name",
      tags = "ReportDefinition",
      description = "Get a report definition by Name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A report definition",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class))),
        @ApiResponse(responseCode = "404", description = "Report Definition for instance {id} is not found")
      })
  public ReportDefinition getByName(
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllReportDefinitionVersion",
      summary = "List Report definition versions",
      tags = "ReportDefinition",
      description = "Get a list of all the version of a report definition by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List all report definition versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Report Definition Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificReportDefinitionVersion",
      summary = "Get a version of the report definition",
      tags = "ReportDefinition",
      description = "Get a version of the report definition by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ReportDefinition",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Report Definition for instance {id} and version {version} is " + "not found")
      })
  public ReportDefinition getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Report Definition Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "Report Definition version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/{fqn}/result")
  @Operation(
      operationId = "addReportResults",
      summary = "Add results to a report",
      tags = "ReportDefinition",
      description = "Add results to a report definition",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully added a report result",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ReportDefinition.class)))
      })
  public Response addReportResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "fqn of a reportDefinition", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn,
      @Valid ReportResult reportResult)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, true);
    return dao.addReportResult(uriInfo, fqn, reportResult);
  }

  private ReportDefinition getReportDefinition(CreateReportDefinition create, String user) throws IOException {
    return copy(new ReportDefinition(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withParamsDefinition(create.getParamsDefinition());
  }

  @GET
  @Path("/{fqn}/result")
  @Operation(
      operationId = "getReportResults",
      summary = "Retrieve report result",
      tags = "ReportDefinition",
      description = "Retrieve report result.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of report results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ReportDefinitionResource.ReportResultList.class)))
      })
  public ResultList<ReportResult> listReportResults(
      @Context SecurityContext securityContext,
      @Parameter(description = "fqn of the reportDefinition", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter report results after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter report results before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    return dao.getReportResults(fqn, startTs, endTs);
  }
}
