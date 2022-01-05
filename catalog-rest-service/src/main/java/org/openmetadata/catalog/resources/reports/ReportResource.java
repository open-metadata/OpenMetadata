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

package org.openmetadata.catalog.resources.reports;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
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
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ReportRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/reports")
@Api(value = "Reports collection", tags = "Reports collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "reports")
public class ReportResource {
  public static final String COLLECTION_PATH = "/v1/bots/";
  private final ReportRepository dao;

  @Inject
  public ReportResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "ReportRepository must not be null");
    this.dao = new ReportRepository(dao);
  }

  public static class ReportList extends ResultList<Report> {
    public ReportList(List<Report> data) {
      super(data);
    }
  }

  static final String FIELDS = "owner,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll("\\s", "").split(","));

  @GET
  @Operation(
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
      throws IOException, GeneralSecurityException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return dao.listAfter(uriInfo, fields, null, 10000, null);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a report",
      tags = "reports",
      description = "Get a report by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The report",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Report.class))),
        @ApiResponse(responseCode = "404", description = "Report for instance {id} is not found")
      })
  public Report get(
      @Context UriInfo uriInfo,
      @PathParam("id") String id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return dao.get(uriInfo, id, fields);
  }

  @POST
  @Operation(
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
    dao.create(uriInfo, report);
    return Response.created(report.getHref()).entity(report).build();
  }

  @PUT
  @Operation(
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
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid Report report)
      throws IOException, ParseException {
    addToReport(securityContext, report);
    PutResponse<Report> response = dao.createOrUpdate(uriInfo, report);
    return response.toResponse();
  }

  private void addToReport(SecurityContext securityContext, Report report) {
    report
        .withId(UUID.randomUUID())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(new Date());
  }
}
