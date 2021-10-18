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

package org.openmetadata.catalog.resources.metrics;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.jdbi3.MetricsRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

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
import java.io.IOException;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/metrics")
@Api(value = "Metrics collection", tags = "Metrics collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metrics", repositoryClass = "org.openmetadata.catalog.jdbi3.MetricsRepository")
public class MetricsResource {
  public static final String COLLECTION_PATH = "/v1/metrics/";
  private final MetricsRepository dao;

  private static List<Metrics> addHref(UriInfo uriInfo, List<Metrics> metrics) {
    metrics.forEach(m -> addHref(uriInfo, m));
    return metrics;
  }

  private static Metrics addHref(UriInfo uriInfo, Metrics metrics) {
    metrics.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, metrics.getId()));
    return metrics;
  }

  @Inject
  public MetricsResource(MetricsRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "MetricsRepository must not be null");
    this.dao = dao;
  }

  static class MetricsList extends ResultList<Metrics> {
    MetricsList(List<Metrics> data) {
      super(data);
    }
  }

  static final String FIELDS ="owner,service,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Operation(summary = "List metrics", tags = "metrics",
          description = "Get a list of metrics. Use `fields` parameter to get only necessary fields.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of metrics",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = MetricsList.class)))
          })
  public MetricsList list(@Context UriInfo uriInfo,
                          @Parameter(description = "Fields requested in the returned resource",
                                  schema = @Schema(type = "string", example = FIELDS))
                          @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return new MetricsList(addHref(uriInfo, dao.list(fields)));
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a metric", tags = "metrics",
          description = "Get a metric by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The metrics",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Metrics.class))),
                  @ApiResponse(responseCode = "404", description = "Metrics for instance {id} is not found")
          })
  public Metrics get(@Context UriInfo uriInfo,
                     @PathParam("id") String id,
                     @Parameter(description = "Fields requested in the returned resource",
                             schema = @Schema(type = "string", example = FIELDS))
                       @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @POST
  @Operation(summary = "Create a metric", tags = "metrics",
          description = "Create a new metric.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The metric",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Metrics.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid Metrics metrics) throws IOException {
    metrics.withId(UUID.randomUUID()).withUpdatedBy(securityContext.getUserPrincipal().getName()).withUpdatedAt(new Date());
    addHref(uriInfo, dao.create(metrics));
    return Response.created(metrics.getHref()).entity(metrics).build();
  }

  @PUT
  @Operation(summary = "Create or update a metric", tags = "metrics",
          description = "Create a new metric, if it does not exist or update an existing metric.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The metric",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Metrics.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid Metrics metrics) throws IOException {
    metrics.withId(UUID.randomUUID()).withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());
    PutResponse<Metrics> response = dao.createOrUpdate(metrics);
    addHref(uriInfo, metrics);
    return Response.status(response.getStatus()).entity(metrics).build();
  }
}
