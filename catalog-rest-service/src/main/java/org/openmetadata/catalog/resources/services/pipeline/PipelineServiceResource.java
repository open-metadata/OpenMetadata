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

package org.openmetadata.catalog.resources.services.pipeline;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/services/pipelineServices")
@Api(value = "Pipeline service collection", tags = "Services -> Pipeline service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelineServices")
public class PipelineServiceResource {
  public static final String COLLECTION_PATH = "v1/services/pipelineServices/";
  private final PipelineServiceRepository dao;
  private final Authorizer authorizer;

  static final String FIELDS = "owner";
  public static final List<String> ALLOWED_FIELDS = Entity.getEntityFields(PipelineService.class);

  public static ResultList<PipelineService> addHref(UriInfo uriInfo, ResultList<PipelineService> services) {
    Optional.ofNullable(services.getData()).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return services;
  }

  public static PipelineService addHref(UriInfo uriInfo, PipelineService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    return service;
  }

  public PipelineServiceResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "PipelineServiceRepository must not be null");
    this.dao = new PipelineServiceRepository(dao);
    this.authorizer = authorizer;
  }

  public static class PipelineServiceList extends ResultList<PipelineService> {
    @SuppressWarnings("unused") /* Required for tests */
    public PipelineServiceList() {}

    public PipelineServiceList(List<PipelineService> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @GET
  @Operation(
      summary = "List pipeline services",
      tags = "services",
      description =
          "Get a list of pipeline services. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline services",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineServiceList.class)))
      })
  public ResultList<PipelineService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit number services returned. (1 to 1000000, " + "default 10)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of services before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of services after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    ResultList<PipelineService> services;
    if (before != null) { // Reverse paging
      services = dao.listBefore(uriInfo, fields, null, limitParam, before, include);
    } else {
      // Forward paging or first page
      services = dao.listAfter(uriInfo, fields, null, limitParam, after, include);
    }
    return addHref(uriInfo, services);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a pipeline service",
      tags = "services",
      description = "Get a pipeline service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} is not found")
      })
  public PipelineService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
      throws IOException, ParseException {
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      summary = "Get pipeline service by name",
      tags = "services",
      description = "Get a pipeline service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} is not found")
      })
  public PipelineService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
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
      throws IOException, ParseException {
    EntityUtil.Fields fields = new EntityUtil.Fields(ALLOWED_FIELDS, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, name, fields, include));
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List pipeline service versions",
      tags = "services",
      description = "Get a list of all the versions of a pipeline service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "pipeline service Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the pipeline service",
      tags = "services",
      description = "Get a version of the pipeline service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "pipeline service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Pipeline service for instance {id} and version " + "{version} is not found")
      })
  public PipelineService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "pipeline service Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "pipeline service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a pipeline service",
      tags = "services",
      description = "Create a new pipeline service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreatePipelineService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipelineService create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    PipelineService service = getService(create, securityContext);
    service = addHref(uriInfo, dao.create(uriInfo, service));
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Operation(
      summary = "Update a pipeline service",
      tags = "services",
      description = "Create a new pipeline service or update an existing pipeline service identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreatePipelineService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response update(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipelineService update)
      throws IOException, ParseException {
    PipelineService service = getService(update, securityContext);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOriginalOwner(service));
    PutResponse<PipelineService> response = dao.createOrUpdate(uriInfo, service, true);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a pipeline service",
      tags = "services",
      description =
          "Delete a pipeline services. If pipelines (and tasks) belong to the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "string")) @PathParam("id")
          String id)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DeleteResponse<PipelineService> response = dao.delete(securityContext.getUserPrincipal().getName(), id, recursive);
    return response.toResponse();
  }

  private PipelineService getService(CreatePipelineService create, SecurityContext securityContext) {
    return new PipelineService()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withServiceType(create.getServiceType())
        .withPipelineUrl(create.getPipelineUrl())
        .withIngestionSchedule(create.getIngestionSchedule())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
