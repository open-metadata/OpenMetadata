/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.reports;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ReportRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Path("/v1/reports")
@Tag(
    name = "Reports (beta)",
    description =
        "`Reports` are static information computed from data periodically that includes "
            + "data in text, table, and visual form.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "reports")
public class ReportResource extends EntityResource<Report, ReportRepository> {
  public static final String COLLECTION_PATH = "/v1/reports/";
  static final String FIELDS = "owners,usageSummary";

  public ReportResource(Authorizer authorizer, Limits limits) {
    super(Entity.REPORT, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public static class ReportList extends ResultList<Report> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listReports",
      summary = "List reports",
      description = "Get a list of reports. Use `fields` parameter to get only necessary fields.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of reports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ReportList.class)))
      })
  public ResultList<Report> list(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter();
    return repository.listAfter(uriInfo, fields, filter, 10000, null);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getReportByID",
      summary = "Get a report by Id",
      description = "Get a report by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "404", description = "Report for instance {id} is not found")
      })
  public Report get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the report", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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

  @Override
  @POST
  @Operation(
      operationId = "getReportByFQN",
      summary = "Create a report",
      description = "Create a new report.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Report report) {
    addToReport(securityContext, report);
    return super.create(uriInfo, securityContext, report);
  }

  @Override
  @PUT
  @Operation(
      operationId = "createOrUpdateReport",
      summary = "Create or update a report",
      description = "Create a new report, it it does not exist or update an existing report.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Report report) {
    addToReport(securityContext, report);
    return super.createOrUpdate(uriInfo, securityContext, report);
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  private void addToReport(SecurityContext securityContext, Report report) {
    report
        .withId(UUID.randomUUID())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
