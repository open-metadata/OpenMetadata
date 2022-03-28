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

package org.openmetadata.catalog.resources.pipelines;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
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
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.PipelineStatus;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.PipelineRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/pipelines")
@Api(value = "Pipelines collection", tags = "Pipelines collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "pipelines")
public class PipelineResource extends EntityResource<Pipeline, PipelineRepository> {
  public static final String COLLECTION_PATH = "v1/pipelines/";

  @Override
  public Pipeline addHref(UriInfo uriInfo, Pipeline pipeline) {
    pipeline.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, pipeline.getId()));
    Entity.withHref(uriInfo, pipeline.getOwner());
    Entity.withHref(uriInfo, pipeline.getService());
    Entity.withHref(uriInfo, pipeline.getFollowers());
    return pipeline;
  }

  public PipelineResource(CollectionDAO dao, Authorizer authorizer) {
    super(Pipeline.class, new PipelineRepository(dao), authorizer);
  }

  public static class PipelineList extends ResultList<Pipeline> {
    @SuppressWarnings("unused")
    PipelineList() {
      // Empty constructor needed for deserialization
    }

    public PipelineList(List<Pipeline> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,tasks,pipelineStatus,followers,tags";

  @GET
  @Valid
  @Operation(
      summary = "List Pipelines",
      tags = "pipelines",
      description =
          "Get a list of pipelines, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipelines",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = PipelineList.class)))
      })
  public ResultList<Pipeline> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter pipelines by service name",
              schema = @Schema(type = "string", example = "airflow"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number pipelines returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of pipelines before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of pipelines after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, GeneralSecurityException, ParseException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List pipeline versions",
      tags = "pipelines",
      description = "Get a list of all the versions of a pipeline identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "pipeline Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a pipeline",
      tags = "pipelines",
      description = "Get a pipeline by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Pipeline get(
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a pipeline by name",
      tags = "pipelines",
      description = "Get a pipeline by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Pipeline getByName(
      @Context UriInfo uriInfo,
      @PathParam("fqn") String fqn,
      @Context SecurityContext securityContext,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the pipeline",
      tags = "pipelines",
      description = "Get a version of the pipeline by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "pipeline",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Pipeline for instance {id} and version {version} is " + "not found")
      })
  public Pipeline getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Pipeline Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Pipeline version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a pipeline",
      tags = "pipelines",
      description = "Create a new pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreatePipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipeline create)
      throws IOException, ParseException {
    Pipeline pipeline = getPipeline(securityContext, create);
    return create(uriInfo, securityContext, pipeline, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a Pipeline",
      tags = "pipelines",
      description = "Update an existing pipeline using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException, ParseException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      summary = "Create or update a pipeline",
      tags = "pipelines",
      description = "Create a new pipeline, if it does not exist or update an existing pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreatePipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePipeline create)
      throws IOException, ParseException {
    Pipeline pipeline = getPipeline(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, pipeline, ADMIN | BOT | OWNER);
  }

  @PUT
  @Path("/{id}/status")
  @Operation(
      summary = "Add status data",
      tags = "pipelines",
      description = "Add status data to the pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pipeline with a the new status",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Pipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Pipeline addPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "string")) @PathParam("id") String id,
      PipelineStatus pipelineStatus)
      throws IOException, ParseException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    Pipeline pipeline = dao.addPipelineStatus(UUID.fromString(id), pipelineStatus);
    return addHref(uriInfo, pipeline);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "pipelines",
      description = "Add a user identified by `userId` as follower of this pipeline",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          String userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      tags = "pipelines",
      description = "Remove the user identified `userId` as a follower of the pipeline.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the pipeline", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Pipeline",
      tags = "pipelines",
      description = "Delete a pipeline by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Pipeline for instance {id} is not found")
      })
  public Response delete(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException, ParseException {
    return delete(uriInfo, securityContext, id, false, ADMIN | BOT);
  }

  private Pipeline getPipeline(SecurityContext securityContext, CreatePipeline create) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withTasks(create.getTasks())
        .withPipelineUrl(create.getPipelineUrl())
        .withTags(create.getTags())
        .withConcurrency(create.getConcurrency())
        .withStartDate(create.getStartDate())
        .withPipelineLocation(create.getPipelineLocation())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
