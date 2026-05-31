/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.feeds;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import java.io.IOException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/taskFormSchemas")
@Tag(name = "Task Form Schemas", description = "Form schemas for task types")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "taskFormSchemas", order = 8)
public class TaskFormSchemaResource
    extends EntityResource<TaskFormSchema, TaskFormSchemaRepository> {

  public static final String COLLECTION_PATH = "v1/taskFormSchemas/";
  static final String FIELDS = "";

  public TaskFormSchemaResource(Authorizer authorizer, Limits limits) {
    super(Entity.TASK_FORM_SCHEMA, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    repository.initSeedDataFromResources();
  }

  public static class TaskFormSchemaList extends ResultList<TaskFormSchema> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listTaskFormSchemas",
      summary = "List task form schemas",
      description = "Get a list of task form schemas with optional filters.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of task form schemas",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskFormSchemaList.class)))
      })
  public ResultList<TaskFormSchema> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task type") @QueryParam("taskType") String taskType,
      @Parameter(description = "Filter by task category") @QueryParam("taskCategory")
          String taskCategory,
      @Parameter(description = "Limit the number results")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list after this cursor") @QueryParam("after") String after,
      @Parameter(description = "Include deleted schemas")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    if (taskType != null) {
      filter.addQueryParam("taskFormType", taskType);
    }
    if (taskCategory != null) {
      filter.addQueryParam("taskFormCategory", taskCategory);
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTaskFormSchemaById",
      summary = "Get a task form schema by ID",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task form schema",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskFormSchema.class)))
      })
  public TaskFormSchema get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getTaskFormSchemaByFQN",
      summary = "Get a task form schema by name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task form schema",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskFormSchema.class)))
      })
  public TaskFormSchema getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listTaskFormSchemaVersions",
      summary = "List task form schema versions",
      responses = {@ApiResponse(responseCode = "200", description = "List of versions")})
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getTaskFormSchemaVersion",
      summary = "Get a specific version of a task form schema")
  public TaskFormSchema getVersion(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("version") String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTaskFormSchema",
      summary = "Create a task form schema",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created task form schema",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskFormSchema.class)))
      })
  public Response createTaskFormSchema(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, TaskFormSchema schema) {
    schema.withId(UUID.randomUUID());
    schema.withUpdatedBy(securityContext.getUserPrincipal().getName());
    schema.withUpdatedAt(System.currentTimeMillis());
    return super.create(uriInfo, securityContext, schema);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTaskFormSchema",
      summary = "Create or update a task form schema",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task form schema",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskFormSchema.class)))
      })
  public Response createOrUpdateTaskFormSchema(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, TaskFormSchema schema) {
    schema.withUpdatedBy(securityContext.getUserPrincipal().getName());
    schema.withUpdatedAt(System.currentTimeMillis());
    return super.createOrUpdate(uriInfo, securityContext, schema);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTaskFormSchema",
      summary = "Update a task form schema",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTaskFormSchema",
      summary = "Delete a task form schema",
      responses = {@ApiResponse(responseCode = "200", description = "Task form schema deleted")})
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreTaskFormSchema",
      summary = "Restore a soft deleted task form schema")
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
