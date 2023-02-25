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

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
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
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ReportRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Path("/v1/reports")
@Api(value = "Reports collection", tags = "Reports collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "reports")
public class ReportResource extends EntityResource<Report, ReportRepository> {
  public static final String COLLECTION_PATH = "/v1/bots/";

  public ReportResource(CollectionDAO dao, Authorizer authorizer) {
    super(Report.class, new ReportRepository(dao), authorizer);
  }

  @Override
  public Report addHref(UriInfo uriInfo, Report entity) {
    return entity;
  }

  public static class ReportList extends ResultList<Report> {
    public ReportList(List<Report> data) {
      super(data);
    }
  }

  static final String FIELDS = "owner,usageSummary";

  @GET
  @Operation(
      operationId = "listReports",
      summary = "List reports",
      tags = "reports",
      description = "Get a list of reports. Use `fields` parameter to get only necessary fields.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of reports",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ReportList.class)))
      })
  public ResultList<Report> list(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException {
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter();
    return dao.listAfter(uriInfo, fields, filter, 10000, null);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getReportByID",
      summary = "Get a report by Id",
      tags = "reports",
      description = "Get a report by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "404", description = "Report for instance {id} is not found")
      })
  public Report get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the report", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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

  @POST
  @Operation(
      operationId = "getReportByFQN",
      summary = "Create a report",
      tags = "reports",
      description = "Create a new report.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Report report)
      throws IOException {
    addToReport(securityContext, report);
    return super.create(uriInfo, securityContext, report);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateReport",
      summary = "Create or update a report",
      tags = "reports",
      description = "Create a new report, it it does not exist or update an existing report.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Report report) throws IOException {
    addToReport(securityContext, report);
    return super.createOrUpdate(uriInfo, securityContext, report);
  }

  private void addToReport(SecurityContext securityContext, Report report) {
    report
        .withId(UUID.randomUUID())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
