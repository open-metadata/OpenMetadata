/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
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
import java.util.UUID;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AuditReportRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/auditReports")
@Tag(
    name = "AI Audit Reports",
    description =
        "Auto-generated audit packs (JSON/PDF evidence bundles) for AI governance. Submitted asynchronously and consumed by auditors and regulators.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "auditReports")
public class AuditReportResource extends EntityResource<AuditReport, AuditReportRepository> {
  public static final String COLLECTION_PATH = "/v1/auditReports/";
  private final AuditReportMapper mapper = new AuditReportMapper();
  static final String FIELDS = "owners,tags,extension,domains";

  public AuditReportResource(Authorizer authorizer, Limits limits) {
    super(Entity.AUDIT_REPORT, authorizer, limits);
  }

  public static class AuditReportList extends ResultList<AuditReport> {
    /* Required for serde */
  }

  @GET
  @Operation(operationId = "listAuditReports", summary = "List audit reports")
  public ResultList<AuditReport> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("limit") @DefaultValue("50") int limitParam,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @QueryParam("status") String statusFilter,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    ListFilter filter = new ListFilter(include);
    if (statusFilter != null && !statusFilter.isBlank()) {
      filter.addQueryParam("status", statusFilter);
    }

    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getAuditReportById", summary = "Get an audit report by id")
  public AuditReport get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getAuditReportByFqn", summary = "Get an audit report by FQN")
  public AuditReport getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, null);
  }

  @POST
  @Operation(operationId = "createAuditReport", summary = "Submit a new audit pack job")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAuditReport create) {
    AuditReport report =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    Response response = create(uriInfo, securityContext, report);
    if (report.getId() != null) {
      AuditPackGenerator.submit(report.getId());
    }
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateAuditReport",
      summary = "Create or update an audit report")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAuditReport create) {
    AuditReport report =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());

    return createOrUpdate(uriInfo, securityContext, report);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchAuditReport", summary = "Update an audit report")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteAuditReport", summary = "Delete an audit report")
  public Response deleteById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("recursive") @DefaultValue("false") boolean recursive,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @POST
  @Path("/{id}/cancel")
  @Operation(
      operationId = "cancelAuditReport",
      summary = "Cancel a queued or running audit report",
      description =
          "Flips a report to status=Cancelled. Has no effect on Completed/Failed/Cancelled reports.")
  public Response cancel(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    AuditReport report = repository.get(uriInfo, id, repository.getFields(FIELDS));
    AuditReportStatus current = report.getStatus();
    if (current == AuditReportStatus.Completed
        || current == AuditReportStatus.Failed
        || current == AuditReportStatus.Cancelled) {
      return Response.ok(report).build();
    }
    String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(report);
    report.setStatus(AuditReportStatus.Cancelled);
    report.setCompletedAt(System.currentTimeMillis());
    String updatedJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(report);
    jakarta.json.JsonPatch patch =
        org.openmetadata.schema.utils.JsonUtils.getJsonPatch(json, updatedJson);
    repository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);

    return Response.ok(report).build();
  }
}
