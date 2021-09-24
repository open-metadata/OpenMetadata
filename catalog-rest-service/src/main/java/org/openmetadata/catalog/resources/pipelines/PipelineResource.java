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

package org.openmetadata.catalog.resources.pipelines;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Inject;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.jdbi3.PipelineRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.JsonUtils;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.security.CatalogAuthorizer;

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
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/pipelines")
@Api(value = "Pipelines collection", tags = "Pipelines collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelines", repositoryClass = "org.openmetadata.catalog.jdbi3.PipelineRepository")
public class PipelineResource {

  public static final String COLLECTION_PATH = "/v1/pipelines/";
  private final List<String> attributes = RestUtil.getAttributes(Pipeline.class);
  private final List<String> relationships = RestUtil.getAttributes(Pipeline.class);
  private final PipelineRepository dao;
  private final CatalogAuthorizer authorizer;

  private static List<Pipeline> addHref(UriInfo uriInfo, List<Pipeline> pipelines) {
    pipelines.forEach(p -> addHref(uriInfo, p));
    return pipelines;
  }
  private static Pipeline addHref(UriInfo uriInfo, Pipeline pipeline) {
    pipeline.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, pipeline.getId()));
    return pipeline;
  }

  @Inject
  public PipelineResource(PipelineRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "PipelineRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  static class PipelineList extends ResultList<Pipeline> {
    PipelineList(List<Pipeline> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List pipelines", tags = "pipelines",
          description = "Get a list of pipelines.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of pipelines",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = PipelineList.class)))
          })
  public PipelineList list(@Context UriInfo uriInfo, @QueryParam("name") String name) throws IOException {
    return new PipelineList(addHref(uriInfo, dao.list(name)));
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a pipeline", tags = "pipelines",
          description = "Get a pipeline by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The pipeline",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
          })
  public Pipeline get(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    return addHref(uriInfo, dao.get(id));
  }

  @POST
  @Operation(summary = "Create a pipeline", tags = "pipelines",
          description = "Create a new pipeline.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The pipeline",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Pipeline.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Pipeline create(@Context UriInfo uriInfo, @Valid Pipeline pipeline) throws JsonProcessingException {
    pipeline.setId(UUID.randomUUID());
    dao.create(JsonUtils.pojoToJson(pipeline));
    return addHref(uriInfo, pipeline);
  }
}

