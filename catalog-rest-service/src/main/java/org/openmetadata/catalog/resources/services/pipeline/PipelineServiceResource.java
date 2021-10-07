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

package org.openmetadata.catalog.resources.services.pipeline;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.services.UpdatePipelineService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
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
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/services/pipelineServices")
@Api(value = "Pipeline service collection", tags = "Services -> Pipeline service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelineServices", repositoryClass = "org.openmetadata.catalog.jdbi3.PipelineServiceRepository")
public class PipelineServiceResource {
  private final PipelineServiceRepository dao;
  private final CatalogAuthorizer authorizer;

  public static EntityReference addHref(UriInfo uriInfo, EntityReference service) {
    return service.withHref(RestUtil.getHref(uriInfo, "v1/services/pipelineServices/", service.getId()));
  }

  private static List<PipelineService> addHref(UriInfo uriInfo, List<PipelineService> instances) {
    instances.forEach(i -> addHref(uriInfo, i));
    return instances;
  }

  private static PipelineService addHref(UriInfo uriInfo, PipelineService pipelineService) {
    pipelineService.setHref(RestUtil.getHref(uriInfo, "v1/services/pipelineServices/",
            pipelineService.getId()));
    return pipelineService;
  }

  @Inject
  public PipelineServiceResource(PipelineServiceRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "PipelineServiceRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  static class PipelineServiceList extends ResultList<PipelineService> {
    PipelineServiceList(List<PipelineService> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List pipeline services", tags = "services",
          description = "Get a list of pipeline services.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of pipeline service instances",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = PipelineServiceList.class)))
          })
  public PipelineServiceList list(@Context UriInfo uriInfo, @QueryParam("name") String name) throws IOException {
    return new PipelineServiceList(addHref(uriInfo, dao.list(name)));
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a pipeline service", tags = "services",
          description = "Get a pipeline service by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Pipeline service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = PipelineService.class))),
                  @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} is not found")
          })
  public  PipelineService get(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("id") String id) throws IOException {
    return addHref(uriInfo, dao.get(id));
  }

  @GET
  @Path("/name/{name}")
  @Operation(summary = "Get pipeline service by name", tags = "services",
          description = "Get a pipeline service by the service `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Pipeline service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = PipelineService.class))),
                  @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} is not found")
          })
  public PipelineService getByName(@Context UriInfo uriInfo,
                             @Context SecurityContext securityContext,
                             @PathParam("name") String name) throws IOException {
    return addHref(uriInfo, dao.getByName(name));
  }

  @POST
  @Operation(summary = "Create a pipeline service", tags = "services",
          description = "Create a new pipeline service.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Pipeline service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreatePipelineService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreatePipelineService create) throws JsonProcessingException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    PipelineService service = new PipelineService().withId(UUID.randomUUID())
            .withName(create.getName()).withDescription(create.getDescription())
            .withServiceType(create.getServiceType())
            .withPipelineUrl(create.getPipelineUrl())
            .withIngestionSchedule(create.getIngestionSchedule());
    addHref(uriInfo, dao.create(service));
    return Response.created(service.getHref()).entity(service).build();
  }

  @PUT
  @Path("/{id}")
  @Operation(summary = "Update a pipeline service", tags = "services",
          description = "Update an existing pipeline service identified by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "Pipeline service instance",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreatePipelineService.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response update(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "string"))
                         @PathParam("id") String id,
                         @Valid UpdatePipelineService update) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    PipelineService service = addHref(uriInfo,
            dao.update(id, update.getDescription(), update.getPipelineUrl(), update.getIngestionSchedule()));
    return Response.ok(service).build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a pipeline service", tags = "services",
          description = "Delete a pipeline services. If pipelines (and tasks) belong to the service, it can't be " +
                  "deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Pipeline service for instance {id} " +
                          "is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the pipeline service", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(id);
    return Response.ok().build();
  }
}
