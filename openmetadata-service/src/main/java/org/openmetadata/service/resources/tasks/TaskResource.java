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

package org.openmetadata.service.resources.tasks;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.tasks.BulkTaskOperation;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.CreateTaskComment;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.tasks.TaskCount;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.BulkTaskOperationParams;
import org.openmetadata.schema.type.BulkTaskOperationResult;
import org.openmetadata.schema.type.BulkTaskOperationResultItem;
import org.openmetadata.schema.type.BulkTaskOperationType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
@Path("/v1/tasks")
@Tag(name = "Tasks", description = "Tasks for data governance workflows")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "tasks", order = 8)
public class TaskResource extends EntityResource<Task, TaskRepository> {

  public static final String COLLECTION_PATH = "v1/tasks/";
  static final String FIELDS =
      "assignees,reviewers,watchers,about,domains,comments,createdBy,payload";
  private static final String COUNT_VIEW_ALL = "all";
  private static final String COUNT_VIEW_VISIBLE = "visible";
  private static final String COUNT_VIEW_ASSIGNED = "assigned";
  private static final String COUNT_VIEW_OWNED = "owned";
  private static final String COUNT_VIEW_CREATED = "created";
  private static final String COUNT_VIEW_MENTIONED = "mentioned";
  private static final String COUNT_VIEW_ENTITY = "entity";

  public TaskResource(Authorizer authorizer, Limits limits) {
    super(Entity.TASK, authorizer, limits);
  }

  public static class TaskList extends ResultList<Task> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listTasks",
      summary = "List tasks",
      description =
          "Get a list of tasks with filters for status, category, type, domain, and assignee.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tasks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskList.class)))
      })
  public ResultList<Task> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task status") @QueryParam("status")
          TaskEntityStatus status,
      @Parameter(
              description =
                  "Filter by status group: 'open' for Open tasks, 'closed' for Approved/Rejected/Completed/Cancelled/Failed tasks")
          @QueryParam("statusGroup")
          String statusGroup,
      @Parameter(description = "Filter by task category") @QueryParam("category")
          TaskCategory category,
      @Parameter(description = "Filter by task type") @QueryParam("type") TaskEntityType type,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Filter by priority") @QueryParam("priority") TaskPriority priority,
      @Parameter(description = "Filter by assignee (user or team FQN)") @QueryParam("assignee")
          String assignee,
      @Parameter(description = "Filter by creator FQN") @QueryParam("createdBy") String createdBy,
      @Parameter(description = "Filter by creator user id") @QueryParam("createdById")
          UUID createdById,
      @Parameter(description = "Filter by entity FQN the task is about") @QueryParam("aboutEntity")
          String aboutEntity,
      @Parameter(description = "Filter by user FQN who was mentioned in task comments")
          @QueryParam("mentionedUser")
          String mentionedUser,
      @Parameter(description = "Limit the number results", schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tasks before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tasks after this cursor") @QueryParam("after")
          String after,
      @Parameter(description = "Include deleted tasks")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    if (statusGroup != null) {
      filter.addQueryParam("taskStatusGroup", statusGroup);
    } else if (status != null) {
      filter.addQueryParam("taskStatus", status.value());
    }
    if (category != null) {
      filter.addQueryParam("category", category.value());
    }
    if (type != null) {
      filter.addQueryParam("taskType", type.value());
    }
    repository.addDomainFilter(filter, domain);
    if (priority != null) {
      filter.addQueryParam("taskPriority", priority.value());
    }
    if (assignee != null) {
      filter.addQueryParam("assignee", assignee);
    }
    if (createdBy != null) {
      filter.addQueryParam("createdBy", createdBy);
    }
    if (createdById != null) {
      filter.addQueryParam("createdById", createdById.toString());
    }
    if (aboutEntity != null) {
      filter.addQueryParam("aboutEntity", aboutEntity);
    }
    if (mentionedUser != null) {
      filter.addQueryParam("mentionedUser", mentionedUser);
    }

    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/count")
  @Operation(
      operationId = "getTaskCount",
      summary = "Get task counts by status",
      description = "Get counts of tasks grouped by status with optional filters.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Task counts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskCount.class)))
      })
  public Response getTaskCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Filter by assignee FQN") @QueryParam("assignee") String assignee,
      @Parameter(description = "Filter by creator FQN") @QueryParam("createdBy") String createdBy,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(
              description =
                  "Count view: visible, assigned, owned, created, mentioned, entity, or all")
          @QueryParam("view")
          String view,
      @Parameter(description = "Filter by entity FQN the task is about") @QueryParam("aboutEntity")
          String aboutEntity,
      @Parameter(description = "Filter by user FQN who was mentioned in task comments")
          @QueryParam("mentionedUser")
          String mentionedUser) {
    ListFilter baseFilter =
        buildCountFilter(
            uriInfo,
            securityContext,
            assignee,
            createdBy,
            aboutEntity,
            mentionedUser,
            domain,
            view);
    repository.applyTaskDomainFilter(baseFilter);

    CollectionDAO.TaskDAO.TaskCountSummary countSummary =
        repository
            .getDaoCollection()
            .taskDAO()
            .getTaskCountSummary(baseFilter.getCondition(), baseFilter.getQueryParams());

    TaskCount response =
        new TaskCount()
            .withOpen(countSummary.getOpen())
            .withCompleted(countSummary.getCompleted())
            .withInProgress(countSummary.getInProgress())
            .withTotal(countSummary.getTotal());

    return Response.ok(response).build();
  }

  @GET
  @Path("/assigned")
  @Operation(
      operationId = "listMyAssignedTasks",
      summary = "List tasks assigned to the current user",
      description =
          "Get tasks assigned to the current user or their teams. "
              + "Includes tasks where the user is a direct assignee or a member of an assigned team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assigned tasks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskList.class)))
      })
  public ResultList<Task> listMyAssignedTasks(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task status") @QueryParam("status")
          TaskEntityStatus status,
      @Parameter(
              description =
                  "Filter by status group: 'open' for open tasks, 'closed' for terminal tasks")
          @QueryParam("statusGroup")
          String statusGroup,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Limit the number results", schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tasks before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tasks after this cursor") @QueryParam("after")
          String after,
      @Parameter(description = "Include deleted tasks")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = buildTaskListFilter(include, status, statusGroup, domain);
    filter.addQueryParam("assigneeIds", getCurrentUserAssigneeIds(securityContext));

    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/visible")
  @Operation(
      operationId = "listMyVisibleTasks",
      summary = "List tasks visible to the current user",
      description =
          "Get tasks visible to the current user. "
              + "This includes tasks assigned to the user or their teams, "
              + "and tasks about entities owned by the user or their teams.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of visible tasks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskList.class)))
      })
  public ResultList<Task> listMyVisibleTasks(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task status") @QueryParam("status")
          TaskEntityStatus status,
      @Parameter(
              description =
                  "Filter by status group: 'open' for open tasks, 'closed' for terminal tasks")
          @QueryParam("statusGroup")
          String statusGroup,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Limit the number results", schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tasks before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tasks after this cursor") @QueryParam("after")
          String after,
      @Parameter(description = "Include deleted tasks")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = buildTaskListFilter(include, status, statusGroup, domain);
    addCurrentUserVisibleFilters(filter, uriInfo, securityContext);

    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/owned")
  @Operation(
      operationId = "listMyOwnedTasks",
      summary = "List tasks for entities owned by the current user",
      description =
          "Get tasks for entities owned by the current user or their teams. "
              + "Includes tasks where the task target entity is owned by the user or their teams.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of owned tasks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskList.class)))
      })
  public ResultList<Task> listMyOwnedTasks(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task status") @QueryParam("status")
          TaskEntityStatus status,
      @Parameter(
              description =
                  "Filter by status group: 'open' for open tasks, 'closed' for terminal tasks")
          @QueryParam("statusGroup")
          String statusGroup,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Limit the number results", schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tasks before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tasks after this cursor") @QueryParam("after")
          String after,
      @Parameter(description = "Include deleted tasks")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    String userName = securityContext.getUserPrincipal().getName();
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User user = userRepository.getByName(uriInfo, userName, userRepository.getFields("email"));
    List<EntityReference> groupTeams =
        userRepository.getGroupTeams(uriInfo, securityContext, user.getEmail());

    List<String> ownerIds = new ArrayList<>();
    ownerIds.add("'" + user.getId() + "'");
    if (groupTeams != null) {
      ownerIds.addAll(groupTeams.stream().map(team -> "'" + team.getId() + "'").toList());
    }

    ListFilter filter = buildTaskListFilter(include, status, statusGroup, domain);
    filter.addQueryParam("ownedByIds", String.join(",", ownerIds));

    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/created")
  @Operation(
      operationId = "listMyCreatedTasks",
      summary = "List tasks created by the current user",
      description = "Get tasks created by the current user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of created tasks",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TaskList.class)))
      })
  public ResultList<Task> listMyCreatedTasks(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by task status") @QueryParam("status")
          TaskEntityStatus status,
      @Parameter(
              description =
                  "Filter by status group: 'open' for open tasks, 'closed' for terminal tasks")
          @QueryParam("statusGroup")
          String statusGroup,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Limit the number results", schema = @Schema(type = "integer"))
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of tasks before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tasks after this cursor") @QueryParam("after")
          String after,
      @Parameter(description = "Include deleted tasks")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);

    ListFilter filter = buildTaskListFilter(include, status, statusGroup, domain);
    filter.addQueryParam("createdById", user.getId().toString());

    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTaskById",
      summary = "Get a task by id",
      description = "Get a task by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task for instance {id} is not found")
      })
  public Task get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include deleted task")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{taskId}")
  @Operation(
      operationId = "getTaskByTaskId",
      summary = "Get a task by task ID",
      description = "Get a task by human-readable task ID (e.g., TASK-00001).",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task not found")
      })
  public Task getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task ID (e.g., TASK-00001)") @PathParam("taskId") String taskId,
      @Parameter(description = "Fields to include in response", schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include deleted task")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, taskId, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listTaskVersions",
      summary = "List task versions",
      description = "Get a list of all the versions of a task identified by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of task versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getTaskVersion",
      summary = "Get a specific version of the task",
      description = "Get a version of the task by given `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Task for instance {id} and version {version} is not found")
      })
  public Task getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Task version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTask",
      summary = "Create a task",
      description = "Create a new task for data governance workflows.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(
            responseCode = "403",
            description = "Domain-only user cannot create task on entity outside their domain")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTask create) {
    Task task = getTask(create, securityContext.getUserPrincipal().getName());
    enforceDomainOnlyPolicyForTask(securityContext, task);
    return create(uriInfo, securityContext, task);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTask",
      summary = "Create or update a task",
      description = "Create a task if it does not exist, otherwise update existing.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(
            responseCode = "403",
            description = "Domain-only user cannot create task on entity outside their domain")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTask create) {
    Task task = getTask(create, securityContext.getUserPrincipal().getName());
    enforceDomainOnlyPolicyForTask(securityContext, task);
    return createOrUpdate(uriInfo, securityContext, task);
  }

  /**
   * Enforce domain-only policy: Users with DOMAIN_ONLY_ACCESS_ROLE can only create tasks on entities
   * within their domains.
   */
  private void enforceDomainOnlyPolicyForTask(SecurityContext securityContext, Task task) {
    SubjectContext subjectContext = getSubjectContext(securityContext);

    if (subjectContext.isAdmin() || !subjectContext.hasDomainOnlyAccessRole()) {
      return;
    }

    EntityReference about = task.getAbout();
    if (about == null) {
      return;
    }

    List<EntityReference> targetDomains = getEntityDomains(about);
    if (nullOrEmpty(targetDomains)) {
      throw new AuthorizationException(
          String.format(
              "User with domain-only access cannot create task on entity '%s' with no domain",
              about.getFullyQualifiedName()));
    }

    List<EntityReference> userDomains = subjectContext.getUserDomains();
    if (nullOrEmpty(userDomains)) {
      throw new AuthorizationException(
          String.format(
              "User with domain-only access has no assigned domains and cannot create task on '%s'",
              about.getFullyQualifiedName()));
    }

    boolean hasMatchingDomain =
        targetDomains.stream().anyMatch(targetDomain -> isDomainAllowed(targetDomain, userDomains));

    if (!hasMatchingDomain) {
      throw new AuthorizationException(
          String.format(
              "User with domain-only access cannot create task on entity '%s' in domains [%s]",
              about.getFullyQualifiedName(),
              targetDomains.stream()
                  .map(EntityReference::getFullyQualifiedName)
                  .filter(name -> !nullOrEmpty(name))
                  .reduce((a, b) -> a + ", " + b)
                  .orElse("unknown")));
    }
  }

  private boolean isDomainAllowed(
      EntityReference targetDomain, List<EntityReference> allowedDomains) {
    return allowedDomains.stream().anyMatch(domain -> domain.getId().equals(targetDomain.getId()));
  }

  @SuppressWarnings("unchecked")
  private List<EntityReference> getEntityDomains(EntityReference entityRef) {
    try {
      EntityRepository<?> repo = Entity.getEntityRepository(entityRef.getType());
      Object entity = repo.get(null, entityRef.getId(), repo.getFields("domains"));

      java.lang.reflect.Method getDomainsMethod = entity.getClass().getMethod("getDomains");
      Object domains = getDomainsMethod.invoke(entity);
      if (domains instanceof List<?> domainList && !domainList.isEmpty()) {
        return domainList.stream()
            .filter(EntityReference.class::isInstance)
            .map(EntityReference.class::cast)
            .toList();
      }
    } catch (Exception e) {
      throw new AuthorizationException(
          String.format(
              "Could not evaluate domain policy for entity '%s': %s",
              entityRef.getId(), e.getMessage()));
    }
    return List.of();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTask",
      summary = "Update a task",
      description = "Update an existing task using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject(
                            "[{\"op\": \"add\", \"path\": \"/status\", \"value\": \"InProgress\"}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @POST
  @Path("/{id}/resolve")
  @Operation(
      operationId = "resolveTask",
      summary = "Resolve a task",
      description = "Resolve a task with approval, rejection, or completion.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The resolved task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task not found"),
        @ApiResponse(responseCode = "403", description = "User not authorized to resolve task")
      })
  public Response resolveTask(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid ResolveTask resolveTask) {
    String userName = securityContext.getUserPrincipal().getName();
    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    repository.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
    validateTaskCanBeResolved(task);

    // Use TaskWorkflowHandler to resolve the task and apply entity changes
    String transitionId =
        resolveTask.getTransitionId() != null
            ? resolveTask.getTransitionId()
            : TaskWorkflowLifecycleResolver.defaultTransitionId(
                task, resolveTask.getResolutionType());
    String newValue = resolveTask.getNewValue();
    Object resolvedPayload = resolveTask.getPayload();
    String comment = resolveTask.getComment();

    Task resolvedTask =
        repository.resolveTaskWithWorkflow(
            task,
            transitionId,
            resolveTask.getResolutionType(),
            newValue,
            resolvedPayload,
            comment,
            userName);
    return Response.ok(resolvedTask).build();
  }

  private ListFilter buildTaskListFilter(
      Include include, TaskEntityStatus status, String statusGroup, String domain) {
    ListFilter filter = new ListFilter(include);
    if (statusGroup != null) {
      filter.addQueryParam("taskStatusGroup", statusGroup);
    } else if (status != null) {
      filter.addQueryParam("taskStatus", status.value());
    }
    repository.addDomainFilter(filter, domain);

    return filter;
  }

  private ListFilter buildCountFilter(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String assignee,
      String createdBy,
      String aboutEntity,
      String mentionedUser,
      String domain,
      String view) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    repository.addDomainFilter(filter, domain);

    String normalizedView = view == null ? null : view.trim().toLowerCase(Locale.ROOT);

    if (nullOrEmpty(normalizedView)) {
      applyLegacyCountFilters(filter, assignee, createdBy, aboutEntity, mentionedUser);

      return filter;
    }

    switch (normalizedView) {
      case COUNT_VIEW_ALL, COUNT_VIEW_VISIBLE -> {
        boolean hasLegacyUserFilter =
            assignee != null || createdBy != null || mentionedUser != null;

        if (hasLegacyUserFilter) {
          applyLegacyCountFilters(filter, assignee, createdBy, aboutEntity, mentionedUser);
        } else {
          addCurrentUserVisibleFilters(filter, uriInfo, securityContext);
          if (aboutEntity != null) {
            filter.addQueryParam("aboutEntity", aboutEntity);
          }
        }
      }
      case COUNT_VIEW_ASSIGNED -> filter.addQueryParam(
          "assigneeIds", getCurrentUserAssigneeIds(securityContext));
      case COUNT_VIEW_OWNED -> filter.addQueryParam(
          "ownedByIds", getCurrentUserOwnedIds(uriInfo, securityContext));
      case COUNT_VIEW_CREATED -> filter.addQueryParam(
          "createdById", getCurrentUserId(securityContext));
      case COUNT_VIEW_MENTIONED -> filter.addQueryParam(
          "mentionedUser", getCurrentUserMentionedFqn(securityContext));
      case COUNT_VIEW_ENTITY -> {
        // aboutEntity is applied below when present.
      }
      default -> applyLegacyCountFilters(filter, assignee, createdBy, aboutEntity, mentionedUser);
    }

    if (aboutEntity != null) {
      filter.addQueryParam("aboutEntity", aboutEntity);
    }

    return filter;
  }

  private void applyLegacyCountFilters(
      ListFilter filter,
      String assignee,
      String createdBy,
      String aboutEntity,
      String mentionedUser) {
    if (assignee != null) {
      filter.addQueryParam("assignee", assignee);
    }
    if (createdBy != null) {
      filter.addQueryParam("createdBy", createdBy);
    }
    if (aboutEntity != null) {
      filter.addQueryParam("aboutEntity", aboutEntity);
    }
    if (mentionedUser != null) {
      filter.addQueryParam("mentionedUser", mentionedUser);
    }
  }

  private void addCurrentUserVisibleFilters(
      ListFilter filter, UriInfo uriInfo, SecurityContext securityContext) {
    filter.addQueryParam("visibleAssigneeIds", getCurrentUserAssigneeIds(securityContext));
    filter.addQueryParam("visibleOwnedByIds", getCurrentUserOwnedIds(uriInfo, securityContext));
  }

  private String getCurrentUserAssigneeIds(SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(Entity.USER, userName, "teams", Include.NON_DELETED);

    List<String> assigneeIds = new ArrayList<>();
    assigneeIds.add("'" + user.getId() + "'");
    if (user.getTeams() != null) {
      assigneeIds.addAll(user.getTeams().stream().map(team -> "'" + team.getId() + "'").toList());
    }

    return String.join(",", assigneeIds);
  }

  private String getCurrentUserOwnedIds(UriInfo uriInfo, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User user = userRepository.getByName(uriInfo, userName, userRepository.getFields("email"));
    List<EntityReference> groupTeams =
        userRepository.getGroupTeams(uriInfo, securityContext, user.getEmail());

    List<String> ownerIds = new ArrayList<>();
    ownerIds.add("'" + user.getId() + "'");
    if (groupTeams != null) {
      ownerIds.addAll(groupTeams.stream().map(team -> "'" + team.getId() + "'").toList());
    }

    return String.join(",", ownerIds);
  }

  private String getCurrentUserId(SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);

    return user.getId().toString();
  }

  private String getCurrentUserMentionedFqn(SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);

    return nullOrEmpty(user.getFullyQualifiedName())
        ? user.getName()
        : user.getFullyQualifiedName();
  }

  @POST
  @Path("/{id}/close")
  @Operation(
      operationId = "closeTask",
      summary = "Close a task without resolution",
      description =
          "Close a task without applying any changes. Only the creator or assignee can close.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The closed task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task not found"),
        @ApiResponse(responseCode = "403", description = "User not authorized to close task")
      })
  public Response closeTask(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Comment for closing the task") @QueryParam("comment")
          String comment) {
    String userName = securityContext.getUserPrincipal().getName();
    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    repository.checkPermissionsForResolveTask(authorizer, task, true, securityContext);

    Task closedTask = repository.closeTask(task, userName, comment);
    return Response.ok(closedTask).build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTask",
      summary = "Delete a task",
      description = "Delete a task by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Task not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the task")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  // ========================= Suggestion Endpoints =========================

  @PUT
  @Path("/{id}/suggestion/apply")
  @Operation(
      operationId = "applySuggestion",
      summary = "Apply a suggestion task",
      description =
          "Apply a suggestion task to its target entity. "
              + "This approves the suggestion and applies the suggested change to the entity. "
              + "Only works for tasks with type=Suggestion and SuggestionPayload.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The applied suggestion task",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "400", description = "Task is not a suggestion task"),
        @ApiResponse(responseCode = "404", description = "Task not found"),
        @ApiResponse(responseCode = "403", description = "User not authorized to apply suggestion")
      })
  public Response applySuggestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Comment for the approval") @QueryParam("comment") String comment) {
    String userName = securityContext.getUserPrincipal().getName();
    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    if (task.getType() != TaskEntityType.Suggestion) {
      throw new IllegalArgumentException("Task is not a suggestion task. Type: " + task.getType());
    }

    if (task.getPayload() == null) {
      throw new IllegalArgumentException("Task does not have a payload");
    }

    repository.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
    validateTaskCanBeResolved(task);

    Task resolvedTask =
        repository.resolveTaskWithWorkflow(
            task,
            TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Approved),
            TaskResolutionType.Approved,
            null,
            null,
            null,
            userName);
    return Response.ok(resolvedTask).build();
  }

  // ========================= Bulk Operations Endpoint =========================

  @POST
  @Path("/bulk")
  @Operation(
      operationId = "bulkTaskOperation",
      summary = "Perform bulk operations on tasks",
      description =
          "Perform bulk operations on multiple tasks. Supported operations: "
              + "Approve, Reject, Assign, UpdatePriority, Cancel. "
              + "For suggestion tasks, Approve will also apply the suggestion to the target entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Bulk operation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkTaskOperationResult.class))),
        @ApiResponse(responseCode = "400", description = "Invalid operation or parameters")
      })
  public Response bulkOperation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid BulkTaskOperation bulkOperation) {
    String userName = securityContext.getUserPrincipal().getName();

    List<BulkTaskOperationResultItem> results = new ArrayList<>();
    int successful = 0;
    int failed = 0;

    for (String taskIdStr : bulkOperation.getTaskIds()) {
      BulkTaskOperationResultItem result = new BulkTaskOperationResultItem();
      result.setTaskId(taskIdStr);

      try {
        if (taskIdStr == null || taskIdStr.isBlank()) {
          throw new IllegalArgumentException("Task ID must not be empty");
        }

        UUID taskId;
        try {
          taskId = UUID.fromString(taskIdStr);
        } catch (IllegalArgumentException e) {
          Task task =
              repository.getByName(
                  uriInfo, taskIdStr, getFields(FIELDS), Include.NON_DELETED, false);
          taskId = task.getId();
        }

        Fields fields = getFields(FIELDS);
        Task task = repository.get(uriInfo, taskId, fields);

        processBulkOperation(uriInfo, task, bulkOperation, userName, securityContext);

        result.setStatus(BulkTaskOperationResultItem.Status.SUCCESS);
        successful++;
      } catch (Exception e) {
        result.setStatus(BulkTaskOperationResultItem.Status.FAILED);
        String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        result.setError(errorMsg);
        failed++;
        LOG.warn("Bulk operation failed for task {}: {}", taskIdStr, errorMsg, e);
      }

      results.add(result);
    }

    BulkTaskOperationResult response = new BulkTaskOperationResult();
    response.setTotalRequested(bulkOperation.getTaskIds().size());
    response.setSuccessful(successful);
    response.setFailed(failed);
    response.setResults(results);

    return Response.ok(response).build();
  }

  private void processBulkOperation(
      UriInfo uriInfo,
      Task task,
      BulkTaskOperation bulkOperation,
      String userName,
      SecurityContext securityContext) {
    BulkTaskOperationType operation = bulkOperation.getOperation();
    BulkTaskOperationParams params = bulkOperation.getParams();
    String comment = params != null ? params.getComment() : null;

    switch (operation) {
      case Approve -> {
        repository.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
        validateTaskCanBeResolved(task);
        repository.resolveTaskWithWorkflow(
            task,
            TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Approved),
            TaskResolutionType.Approved,
            null,
            null,
            comment,
            userName);
      }
      case Reject -> {
        repository.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
        validateTaskCanBeResolved(task);
        repository.resolveTaskWithWorkflow(
            task,
            TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Rejected),
            TaskResolutionType.Rejected,
            null,
            null,
            comment,
            userName);
      }
      case Assign -> {
        if (params == null || params.getAssignees() == null || params.getAssignees().isEmpty()) {
          throw new IllegalArgumentException("Assignees required for Assign operation");
        }
        repository.checkPermissionsForOwnerOnlyAction(securityContext, task, "reassignTask");
        List<EntityReference> newAssignees =
            params.getAssignees().stream().map(this::resolveUserOrTeam).toList();
        task.setAssignees(newAssignees);
        task.setUpdatedBy(userName);
        task.setUpdatedAt(System.currentTimeMillis());
        repository.createOrUpdate(uriInfo, task, userName);
      }
      case UpdatePriority -> {
        if (params == null || params.getPriority() == null) {
          throw new IllegalArgumentException("Priority required for UpdatePriority operation");
        }
        repository.checkPermissionsForOwnerOnlyAction(securityContext, task, "changeTaskPriority");
        task.setPriority(params.getPriority());
        task.setUpdatedBy(userName);
        task.setUpdatedAt(System.currentTimeMillis());
        repository.createOrUpdate(uriInfo, task, userName);
      }
      case Cancel -> {
        repository.checkPermissionsForResolveTask(authorizer, task, true, securityContext);
        repository.closeTask(task, userName, comment);
      }
    }
  }

  private void validateTaskCanBeResolved(Task task) {
    TaskEntityStatus status = task.getStatus();
    if (status == TaskEntityStatus.Open
        || status == TaskEntityStatus.InProgress
        || status == TaskEntityStatus.Pending) {
      return;
    }

    throw BadRequestException.of(
        String.format("Task '%s' is already in status '%s'", task.getId(), status));
  }

  // ========================= Comment Endpoints =========================

  @POST
  @Path("/{id}/comments")
  @Operation(
      operationId = "addTaskComment",
      summary = "Add a comment to a task",
      description = "Add a comment to a task. Anyone who can view the task can add comments.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task with the new comment",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task not found")
      })
  public Response addComment(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid CreateTaskComment createComment) {
    String userName = securityContext.getUserPrincipal().getName();
    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    TaskComment comment =
        new TaskComment()
            .withId(UUID.randomUUID())
            .withMessage(createComment.getMessage())
            .withAuthor(Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED))
            .withCreatedAt(System.currentTimeMillis());

    Task updatedTask = repository.addComment(task, comment);
    return Response.ok(updatedTask).build();
  }

  @PATCH
  @Path("/{id}/comments/{commentId}")
  @Operation(
      operationId = "editTaskComment",
      summary = "Edit a task comment",
      description = "Edit a comment on a task. Only the comment author can edit their own comment.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task with the updated comment",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task or comment not found"),
        @ApiResponse(responseCode = "403", description = "User not authorized to edit this comment")
      })
  public Response editComment(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Comment Id", schema = @Schema(type = "UUID"))
          @PathParam("commentId")
          UUID commentId,
      @Valid CreateTaskComment updateComment) {
    String userName = securityContext.getUserPrincipal().getName();
    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    Task updatedTask =
        repository.editComment(task, commentId, updateComment.getMessage(), userName);
    return Response.ok(updatedTask).build();
  }

  @DELETE
  @Path("/{id}/comments/{commentId}")
  @Operation(
      operationId = "deleteTaskComment",
      summary = "Delete a task comment",
      description =
          "Delete a comment from a task. The comment author or an admin can delete a comment.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task with the comment removed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Task or comment not found"),
        @ApiResponse(
            responseCode = "403",
            description = "User not authorized to delete this comment")
      })
  public Response deleteComment(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Task Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Comment Id", schema = @Schema(type = "UUID"))
          @PathParam("commentId")
          UUID commentId) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);
    boolean isAdmin = Boolean.TRUE.equals(user.getIsAdmin());

    Fields fields = getFields(FIELDS);
    Task task = repository.get(uriInfo, id, fields);

    Task updatedTask = repository.deleteComment(task, commentId, userName, isAdmin);
    return Response.ok(updatedTask).build();
  }

  private Task getTask(CreateTask create, String user) {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withCategory(create.getCategory())
            .withType(create.getType())
            .withStatus(TaskEntityStatus.Open)
            .withPriority(create.getPriority() != null ? create.getPriority() : TaskPriority.Medium)
            .withPayload(create.getPayload())
            .withDueDate(create.getDueDate())
            .withExternalReference(create.getExternalReference())
            .withTags(create.getTags())
            .withCreatedBy(Entity.getEntityReferenceByName(Entity.USER, user, Include.NON_DELETED))
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());

    if (create.getAbout() != null && create.getAboutType() != null) {
      task.setAbout(
          Entity.getEntityReferenceByName(
              create.getAboutType(), create.getAbout(), Include.NON_DELETED));
    }

    // Note: domains are inherited from the target entity (about) automatically in
    // TaskRepository.prepare()
    // No need to set domains manually here

    if (create.getAssignees() != null) {
      task.setAssignees(create.getAssignees().stream().map(this::resolveUserOrTeam).toList());
    }

    if (create.getReviewers() != null) {
      task.setReviewers(create.getReviewers().stream().map(this::resolveUserOrTeam).toList());
    }

    return task;
  }

  private EntityReference resolveUserOrTeam(String fqn) {
    try {
      return Entity.getEntityReferenceByName(Entity.USER, fqn, Include.NON_DELETED);
    } catch (Exception e) {
      return Entity.getEntityReferenceByName(Entity.TEAM, fqn, Include.NON_DELETED);
    }
  }
}
