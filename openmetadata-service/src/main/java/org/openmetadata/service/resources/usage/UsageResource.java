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

package org.openmetadata.service.resources.usage;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
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
import java.time.LocalDate;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UsageRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Path("/v1/usage")
@Tag(name = "Usage", description = "APIs related usage of data assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "usage")
public class UsageResource {
  private final UsageRepository dao;
  private final Authorizer authorizer;

  public UsageResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.dao = Entity.getUsageRepository();
  }

  @GET
  @Valid
  @Path("/{entity}/{id}")
  @Operation(
      operationId = "getEntityUsageByID",
      summary = "Get usage by id",
      description = "Get usage details for an entity identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity usage",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public EntityUsage get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is requested",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description =
                  "Usage for number of days going back from the given date (default=1, min=1, max=30)")
          @QueryParam("days")
          int days,
      @Parameter(
              description =
                  "Usage for number of days going back from this date in ISO 8601 format. (default = currentDate)")
          @QueryParam("date")
          String date) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.VIEW_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    int actualDays = Math.min(Math.max(days, 1), 30);
    String actualDate = date == null ? RestUtil.DATE_FORMAT.format(LocalDate.now()) : date;
    return addHref(uriInfo, dao.get(entity, id, actualDate, actualDays));
  }

  @GET
  @Valid
  @Path("/{entity}/name/{fqn}")
  @Operation(
      operationId = "getEntityUsageByFQN",
      summary = "Get usage by fully qualified name",
      description = "Get usage details for an entity identified by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity usage",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {fqn} is not found")
      })
  public EntityUsage getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is requested",
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
      @Parameter(
              description =
                  "Usage for number of days going back from the given date (default=1, min=1, max=30)")
          @QueryParam("days")
          int days,
      @Parameter(
              description =
                  "Usage for number of days going back from this date in ISO 8601 format (default = currentDate)")
          @QueryParam("date")
          String date) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.VIEW_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext<>(entity, null, fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    int actualDays = Math.min(Math.max(days, 1), 30);
    String actualDate = date == null ? RestUtil.DATE_FORMAT.format(LocalDate.now()) : date;
    return addHref(uriInfo, dao.getByName(entity, fqn, actualDate, actualDays));
  }

  @POST
  @Path("/{entity}/{id}")
  @Operation(
      operationId = "reportEntityUsageWithID",
      summary = "Report usage",
      description =
          "Report usage information for an entity on a given date. System stores last 30 days of usage "
              + "information. Usage information older than 30 days is deleted.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Usage information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is reported",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Usage information a given date") @Valid DailyCount usage) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.EDIT_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.create(entity, id, usage).toResponse();
  }

  @PUT
  @Path("/{entity}/{id}")
  @Operation(
      operationId = "reportEntityUsageWithID",
      summary = "Report usage",
      description =
          "Report usage information for an entity on a given date. System stores last 30 days of usage "
              + "information. Usage information older than 30 days is deleted.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Usage information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is reported",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(description = "Entity id", required = true, schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Usage information a given date") @Valid DailyCount usage) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.EDIT_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.createOrUpdate(entity, id, usage).toResponse();
  }

  @POST
  @Path("/{entity}/name/{fqn}")
  @Operation(
      operationId = "reportEntityUsageWithFQN",
      summary = "Report usage by fully qualified name",
      description =
          "Report usage information for an entity by name on a given date. System stores last 30 days "
              + "of usage information. Usage information older than 30 days is deleted.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Usage information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is reported",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(
              description = "Fully qualified name of the entity that uniquely identifies an entity",
              required = true,
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fullyQualifiedName,
      @Parameter(description = "Usage information a given date") @Valid DailyCount usage) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.EDIT_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity, null, fullyQualifiedName);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.createByName(entity, fullyQualifiedName, usage).toResponse();
  }

  @PUT
  @Path("/{entity}/name/{fqn}")
  @Operation(
      operationId = "reportEntityUsageWithFQN",
      summary = "Report usage by fully qualified name",
      description =
          "Report usage information for an entity by name on a given date. System stores last 30 days "
              + "of usage information. Usage information older than 30 days is deleted.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Usage information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityUsage.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which usage is reported",
              required = true,
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(
              description = "Fully qualified name of the entity that uniquely identifies an entity",
              required = true,
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fullyQualifiedName,
      @Parameter(description = "Usage information a given date") @Valid DailyCount usage) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.EDIT_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity, null, fullyQualifiedName);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.createOrUpdateByName(entity, fullyQualifiedName, usage).toResponse();
  }

  @POST
  @Path("/compute.percentile/{entity}/{date}")
  @Operation(
      operationId = "computeEntityUsagePercentile",
      summary = "Compute percentiles",
      description = "Compute percentile ranking for an entity based on last 30 days of usage.",
      hidden = true,
      responses = {
        @ApiResponse(responseCode = "201", description = "Percentiles computed"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response computePercentile(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity name for which usage is requested",
              schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity")
          String entity,
      @Parameter(
              description = "ISO 8601 format date to compute percentile on",
              schema = @Schema(type = "string", example = "2021-01-28"))
          @PathParam("date")
          String date) {
    OperationContext operationContext = new OperationContext(entity, MetadataOperation.EDIT_USAGE);
    ResourceContext<?> resourceContext = new ResourceContext(entity);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    dao.computePercentile(entity, date);
    return Response.status(Response.Status.CREATED).build();
  }

  public static EntityUsage addHref(UriInfo uriInfo, EntityUsage entityUsage) {
    Entity.withHref(uriInfo, entityUsage.getEntity());
    return entityUsage;
  }
}
