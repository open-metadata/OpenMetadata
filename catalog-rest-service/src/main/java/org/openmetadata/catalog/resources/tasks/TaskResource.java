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

package org.openmetadata.catalog.resources.tasks;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.data.CreateTask;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.jdbi3.TaskRepositoryHelper;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/tasks")
@Api(value = "tasks data asset collection", tags = "Task data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
//@Collection(name = "tasks", repositoryClass = "org.openmetadata.catalog.jdbi3.TaskRepositoryHelper")
public class TaskResource {
  private static final Logger LOG = LoggerFactory.getLogger(TaskResource.class);
  private static final String TASK_COLLECTION_PATH = "v1/tasks/";
  private final TaskRepositoryHelper dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, TASK_COLLECTION_PATH, ref.getId()));
  }

  public static List<Task> addHref(UriInfo uriInfo, List<Task> tasks) {
    Optional.ofNullable(tasks).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return tasks;
  }

  public static Task addHref(UriInfo uriInfo, Task task) {
    task.setHref(RestUtil.getHref(uriInfo, TASK_COLLECTION_PATH, task.getId()));
    EntityUtil.addHref(uriInfo, task.getOwner());
    EntityUtil.addHref(uriInfo, task.getService());

    return task;
  }

  @Inject
  public TaskResource(TaskRepositoryHelper dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "TaskRepositoryHelper must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  public static class TaskList extends ResultList<Task> {
    @SuppressWarnings("unused")
    TaskList() {
      // Empty constructor needed for deserialization
    }

    public TaskList(List<Task> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "downstreamTasks,taskConfig,owner,service,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Operation(summary = "List tasks", tags = "tasks",
          description = "Get a list of tasks, optionally filtered by `service` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of tasks",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = TaskList.class)))
          })
  public ResultList<Task> list(@Context UriInfo uriInfo,
                               @Context SecurityContext securityContext,
                               @Parameter(description = "Fields requested in the returned resource",
                                schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam,
                               @Parameter(description = "Filter tasks by service name",
                                schema = @Schema(type = "string", example = "superset"))
                        @QueryParam("service") String serviceParam,
                               @Parameter(description = "Limit the number tasks returned. (1 to 1000000, default = 10)")
                        @DefaultValue("10")
                               @QueryParam("limit") @Min(1) @Max(1000000) int limitParam,
                               @Parameter(description = "Returns list of tasks before this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("before") String before,
                               @Parameter(description = "Returns list of tasks after this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Task> tasks;
    if (before != null) { // Reverse paging
      tasks = dao.listBefore(fields, serviceParam, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      tasks = dao.listAfter(fields, serviceParam, limitParam, after);
    }
    addHref(uriInfo, tasks.getData());
    return tasks;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a Task", tags = "tasks",
          description = "Get a task by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The Task",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Task.class))),
                  @ApiResponse(responseCode = "404", description = "Task for instance {id} is not found")
          })
  public Task get(@Context UriInfo uriInfo, @PathParam("id") String id,
                  @Context SecurityContext securityContext,
                  @Parameter(description = "Fields requested in the returned resource",
                              schema = @Schema(type = "string", example = FIELDS))
                  @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a task by name", tags = "tasks",
          description = "Get a task by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The task",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Task.class))),
                  @ApiResponse(responseCode = "404", description = "Task for instance {id} is not found")
          })
  public Response getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Task task = dao.getByName(fqn, fields);
    addHref(uriInfo, task);
    return Response.ok(task).build();
  }

  @POST
  @Operation(summary = "Create a task", tags = "tasks",
          description = "Create a task under an existing `service`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The task",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = CreateTask.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateTask create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Task task =
            new Task().withId(UUID.randomUUID()).withName(create.getName()).withDisplayName(create.getDisplayName())
                    .withDescription(create.getDescription())
                    .withService(create.getService())
                    .withStartDate(create.getStartDate())
                    .withEndDate(create.getEndDate())
                    .withTaskType(create.getTaskType())
                    .withTaskSQL(create.getTaskSQL())
                    .withTaskUrl(create.getTaskUrl())
                    .withTags(create.getTags())
                    .withOwner(create.getOwner())
                    .withUpdatedBy(securityContext.getUserPrincipal().getName())
                    .withUpdatedAt(new Date());
    task = addHref(uriInfo, dao.create(task));
    return Response.created(task.getHref()).entity(task).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a Task", tags = "task",
          description = "Update an existing task using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Task updateDescription(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @PathParam("id") String id,
                                 @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Task task = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            EntityUtil.getEntityReference(task));
    task = dao.patch(id, securityContext.getUserPrincipal().getName(), patch);
    return addHref(uriInfo, task);
  }

  @PUT
  @Operation(summary = "Create or update task", tags = "tasks",
          description = "Create a task, it it does not exist or update an existing task.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The updated task ",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = CreateTask.class)))
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateTask create) throws IOException {

    Task task =
            new Task().withId(UUID.randomUUID()).withName(create.getName()).withDisplayName(create.getDisplayName())
                    .withDescription(create.getDescription())
                    .withService(create.getService())
                    .withTaskUrl(create.getTaskUrl())
                    .withDownstreamTasks(create.getDownstreamTasks())
                    .withStartDate(create.getStartDate())
                    .withEndDate(create.getEndDate())
                    .withTaskType(create.getTaskType())
                    .withTaskSQL(create.getTaskSQL())
                    .withTags(create.getTags())
                    .withOwner(create.getOwner())
                    .withUpdatedBy(securityContext.getUserPrincipal().getName())
                    .withUpdatedAt(new Date());
    PutResponse<Task> response = dao.createOrUpdate(task);
    task = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(task).build();
  }


  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Task", tags = "tasks",
          description = "Delete a task by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "task for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(id);
    return Response.ok().build();
  }
}
