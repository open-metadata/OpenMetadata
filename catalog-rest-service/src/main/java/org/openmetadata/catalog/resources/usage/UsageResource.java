/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.usage;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.util.RestUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Date;
import java.util.Objects;

@Path("/v1/usage")
@Api(value = "Usage resource", tags = "Usage resource")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "usage")
public class UsageResource {
  private static final Logger LOG = LoggerFactory.getLogger(UserResource.class);
  private final UsageRepository dao;

  @Inject
  public UsageResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "UsageRepository must not be null");
    this.dao = new UsageRepository(dao);
  }

  @GET
  @Valid
  @Path("/{entity}/{id}")
  @Operation(summary = "Get usage", tags = "usage",
          description = "Get usage details for an entity identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Entity usage",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityUsage.class))),
                  @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
          })
  public EntityUsage get(
          @Context UriInfo uriInfo,
          @Parameter(description = "Entity type for which usage is requested",
                  required = true,
                  schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity") String entity,
          @Parameter(description = "Entity id",
                  required = true,
                  schema = @Schema(type = "string"))
          @PathParam("id") String id,
          @Parameter(description = "Usage for number of days going back from the given date " +
                  "(default=1, min=1, max=30)")
          @QueryParam("days") int days,
          @Parameter(description = "Usage for number of days going back from this date in ISO 8601 format. " +
                  "(default = currentDate)")
          @QueryParam("date") String date) throws IOException {
    // TODO add href
    int actualDays = Math.min(Math.max(days, 1), 30);
    String actualDate = date == null ? RestUtil.DATE_FORMAT.format(new Date()) : date;
    return addHref(uriInfo, dao.get(entity, id, actualDate, actualDays));
  }

  @GET
  @Valid
  @Path("/{entity}/name/{fqn}")
  @Operation(summary = "Get usage by name", tags = "usage",
          description = "Get usage details for an entity identified by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Entity usage",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityUsage.class))),
                  @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
          })
  public EntityUsage getByName(
          @Context UriInfo uriInfo,
          @Parameter(description = "Entity type for which usage is requested",
                  required = true,
                  schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity") String entity,
          @Parameter(description = "Fully qualified name of the entity that uniquely identifies an entity",
                  required = true,
                  schema = @Schema(type = "string"))
          @PathParam("fqn") String fqn,
          @Parameter(description = "Usage for number of days going back from the given date " +
                  "(default=1, min=1, max=30)")
          @QueryParam("days") int days,
          @Parameter(description = "Usage for number of days going back from this date in ISO 8601 format " +
                  "(default = currentDate)")
          @QueryParam("date") String date
  ) throws IOException {
    // TODO add href
    int actualDays = Math.min(Math.max(days, 1), 30);
    String actualDate = date == null ? RestUtil.DATE_FORMAT.format(new Date()) : date;
    return addHref(uriInfo, dao.getByName(entity, fqn, actualDate, actualDays));
  }

  @POST
  @Path("/{entity}/{id}")
  @Operation(summary = "Report usage", tags = "usage",
          description = "Report usage information for an entity on a given date. System stores last 30 days of usage " +
                  "information. Usage information older than 30 days is deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Usage information",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityUsage.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(
          @Context UriInfo uriInfo,
          @Parameter(description = "Entity type for which usage is reported",
                  required = true,
                  schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity") String entity,
          @Parameter(description = "Entity id",
                  required = true,
                  schema = @Schema(type = "string"))
          @PathParam("id") String id,
          @Parameter(description = "Usage information a given date")
          @Valid DailyCount usage
  ) throws IOException {
    dao.create(entity, id, usage);
    return Response.status(Response.Status.CREATED).build();
  }

  @POST
  @Path("/{entity}/name/{fqn}")
  @Operation(summary = "Report usage by name", tags = "usage",
          description = "Report usage information for an entity by name on a given date. System stores last 30 days " +
                  "of usage information. Usage information older than 30 days is deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Usage information",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = EntityUsage.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createByName(
          @Context UriInfo uriInfo,
          @Parameter(description = "Entity type for which usage is reported",
                  required = true,
                  schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity") String entity,
          @Parameter(description = "Fully qualified name of the entity that uniquely identifies an entity",
                  required = true,
                  schema = @Schema(type = "string"))
          @PathParam("fqn") String fullyQualifiedName,
          @Parameter(description = "Usage information a given date")
          @Valid DailyCount usage) throws IOException {
    dao.createByName(entity, fullyQualifiedName, usage);
    return Response.status(Response.Status.CREATED).build();
  }

  @POST
  @Path("/compute.percentile/{entity}/{date}")
  @Operation(summary = "Compute percentiles", tags = "usage",
          description = "Compute percentile ranking for an entity based on last 30 days of usage.",
          hidden = true,
          responses = {
                  @ApiResponse(responseCode = "201", description = "Percentiles computed"),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response computePercentile(
          @Context UriInfo uriInfo,
          @Parameter(description = "Entity name for which usage is requested",
                  schema = @Schema(type = "string", example = "table, report, metrics, or dashboard"))
          @PathParam("entity") String entity,
          @Parameter(description = "ISO 8601 format date to compute percentile on",
                  schema = @Schema(type = "string", example = "2021-01-28"))
          @PathParam("date") String date) {
    // TODO delete this?
    dao.computePercentile(entity, date);
    return Response.status(Response.Status.CREATED).build();
  }

  public static EntityUsage addHref(UriInfo uriInfo, EntityUsage entityUsage) {
    Entity.withHref(uriInfo, entityUsage.getEntity());
    return entityUsage;
  }
}