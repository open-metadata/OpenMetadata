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

package org.openmetadata.catalog.resources.lineage;

import static javax.ws.rs.core.Response.Status.NOT_FOUND;

import io.dropwizard.jersey.errors.ErrorMessage;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.NonNull;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.lineage.AddLineage;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.LineageRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityLineage;
import org.openmetadata.catalog.type.MetadataOperation;

@Path("/v1/lineage")
@Api(value = "Lineage resource", tags = "Lineage resource")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "lineage")
public class LineageResource {
  private final LineageRepository dao;
  private final Authorizer authorizer;

  public LineageResource(@NonNull CollectionDAO dao, Authorizer authorizer) {
    this.dao = new LineageRepository(dao);
    this.authorizer = authorizer;
  }

  @GET
  @Valid
  @Path("/{entity}/{id}")
  @Operation(
      summary = "Get lineage",
      tags = "lineage",
      description = "Get lineage details for an entity identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity lineage",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityLineage.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public EntityLineage get(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Entity type for which lineage is requested",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string")) @PathParam("id")
          String id,
      @Parameter(description = "Upstream depth of lineage (default=1, min=0, max=3)") @QueryParam("upstreamDepth")
          int upstreamDepth,
      @Parameter(description = "Downstream depth of lineage (default=1, min=0, max=3)") @QueryParam("downstreamDepth")
          int downStreamDepth)
      throws IOException {
    upstreamDepth = Math.min(Math.max(upstreamDepth, 0), 3);
    downStreamDepth = Math.min(Math.max(downStreamDepth, 0), 3);
    return addHref(uriInfo, dao.get(entity, id, upstreamDepth, downStreamDepth));
  }

  @GET
  @Valid
  @Path("/{entity}/name/{fqn}")
  @Operation(
      summary = "Get lineage by name",
      tags = "lineage",
      description = "Get lineage details for an entity identified by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity lineage",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityLineage.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public EntityLineage getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Entity type for which lineage is requested",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(
              description = "Fully qualified name of the entity that uniquely identifies an entity",
              required = true,
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Upstream depth of lineage (default=1, min=0, max=3)")
          @DefaultValue("1")
          @Min(0)
          @Max(3)
          @QueryParam("upstreamDepth")
          int upstreamDepth,
      @Parameter(description = "Upstream depth of lineage (default=1, min=0, max=3)")
          @DefaultValue("1")
          @Min(0)
          @Max(3)
          @QueryParam("downstreamDepth")
          int downStreamDepth)
      throws IOException {
    return addHref(uriInfo, dao.getByName(entity, fqn, upstreamDepth, downStreamDepth));
  }

  @PUT
  @Operation(
      summary = "Add a lineage edge",
      tags = "lineage",
      description = "Add a lineage edge with from entity as upstream node and to entity as downstream node.",
      responses = {
        @ApiResponse(responseCode = "200"),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response addLineage(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid AddLineage addLineage)
      throws IOException {
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, null, MetadataOperation.UpdateLineage);

    dao.addLineage(addLineage);
    return Response.status(Status.OK).build();
  }

  @DELETE
  @Path("/{fromEntity}/{fromId}/{toEntity}/{toId}")
  @Operation(
      summary = "Delete a lineage edge",
      tags = "lineage",
      description = "Delete a lineage edge with from entity as upstream node and to entity as downstream node.",
      responses = {
        @ApiResponse(responseCode = "200"),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteLineage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type of upstream entity of the edge",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("fromEntity")
          String fromEntity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string")) @PathParam("fromId")
          String fromId,
      @Parameter(
              description = "Entity type for downstream entity of the edge",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("toEntity")
          String toEntity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string")) @PathParam("toId")
          String toId)
      throws IOException {
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, null, MetadataOperation.UpdateLineage);

    boolean deleted = dao.deleteLineage(fromEntity, fromId, toEntity, toId);
    if (!deleted) {
      return Response.status(NOT_FOUND)
          .entity(new ErrorMessage(NOT_FOUND.getStatusCode(), "Lineage edge not " + "found"))
          .build();
    }
    return Response.status(Status.OK).build();
  }

  private EntityLineage addHref(UriInfo uriInfo, EntityLineage lineage) {
    Entity.withHref(uriInfo, lineage.getEntity());
    Entity.withHref(uriInfo, lineage.getNodes());
    return lineage;
  }
}
