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

package org.openmetadata.service.resources.domains;

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
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityHierarchyList;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Path("/v1/domains")
@Tag(
    name = "Domains",
    description =
        "A `Domain` is a bounded context that is aligned with a Business Unit or a function within an organization.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "domains", order = 4) // initialize after user resource
public class DomainResource extends EntityResource<Domain, DomainRepository> {
  public static final String COLLECTION_PATH = "/v1/domains/";
  private final DomainMapper mapper = new DomainMapper();
  static final String FIELDS =
      "tags,children,childrenCount,owners,experts,extension,followers,votes,certification";

  public DomainResource(Authorizer authorizer, Limits limits) {
    super(Entity.DOMAIN, authorizer, limits);
  }

  @Override
  public Domain addHref(UriInfo uriInfo, Domain domain) {
    super.addHref(uriInfo, domain);
    Entity.withHref(uriInfo, domain.getParent());
    return domain;
  }

  public static class DomainList extends ResultList<Domain> {
    @SuppressWarnings("unused")
    public DomainList() {
      /* Required for serde */
    }
  }

  @GET
  @Operation(
      operationId = "listDomains",
      summary = "List domains",
      description = "Get a list of Domains.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Domains",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DomainList.class)))
      })
  public ResultList<Domain> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of Domain before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of Domain after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(null), limitParam, before, after);
  }

  @GET
  @Path("/{fqn}/tasks")
  @Operation(
      operationId = "listDomainTasks",
      summary = "List tasks for a domain",
      description = "Get a list of tasks belonging to the given domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tasks in the domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Task.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {fqn} is not found")
      })
  public ResultList<Task> listTasksByDomain(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the domain") @PathParam("fqn") String fqn,
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
      @Parameter(description = "Filter by priority") @QueryParam("priority") TaskPriority priority,
      @Parameter(description = "Filter by assignee (user or team FQN)") @QueryParam("assignee")
          String assignee,
      @Parameter(description = "Filter by creator FQN") @QueryParam("createdBy") String createdBy,
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
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Fields taskFields = taskRepository.getFields(fieldsParam);

    ListFilter filter = new ListFilter(include);
    taskRepository.addDomainFilter(filter, fqn);

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
    if (priority != null) {
      filter.addQueryParam("taskPriority", priority.value());
    }
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

    RestUtil.validateCursors(before, after);
    OperationContext listOperationContext =
        new OperationContext(Entity.TASK, getViewOperations(taskFields));
    authorizer.authorize(
        securityContext, listOperationContext, filter.getResourceContext(Entity.TASK));
    EntityUtil.addDomainQueryParam(securityContext, filter, Entity.TASK);

    return before != null
        ? taskRepository.listBefore(uriInfo, taskFields, filter, limitParam, before)
        : taskRepository.listAfter(uriInfo, taskFields, filter, limitParam, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDomainByID",
      summary = "Get a domain by Id",
      description = "Get a domain by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Domain get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, null);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDomainByFQN",
      summary = "Get a domain by name",
      description = "Get a domain by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Domain getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, null);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDomainVersion",
      summary = "List domain versions",
      description = "Get a list of all the versions of a domain identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of domain versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(description = "Limit the number of versions returned")
          @QueryParam("limit")
          @DefaultValue("0")
          @Min(0)
          @Max(1000)
          int limit,
      @Parameter(description = "Offset of the versions to return")
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset,
      @Parameter(
              description =
                  "Filter versions by field changes. Returns only versions where the specified field was added, updated, or deleted")
          @QueryParam("fieldChanged")
          String fieldChanged) {
    return super.listVersionsInternal(securityContext, id, limit, offset, fieldChanged);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "listSpecificDomainVersion",
      summary = "Get a version of the domain",
      description = "Get a version of the domain by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Domain for instance {id} and version {version} is not found")
      })
  public Domain getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Domain version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDomain",
      summary = "Create a domain",
      description = "Create a new domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDomain request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDomain.class)))
          @Valid
          CreateDomain create) {
    Domain domain = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, domain);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDomain",
      summary = "Create or update a domain",
      description =
          "Create a domain. if it does not exist. If a domain already exists, update the domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDomain request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDomain.class)))
          @Valid
          CreateDomain create) {
    Domain domain = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, domain);
  }

  @PUT
  @Path("/{name}/assets/add")
  @Operation(
      operationId = "bulkAddAssets",
      summary = "Bulk Add Assets",
      description = "Bulk Add Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkAddAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.ok()
        .entity(
            repository.bulkAddAssets(name, request, securityContext.getUserPrincipal().getName()))
        .build();
  }

  @PUT
  @Path("/{name}/assets/remove")
  @Operation(
      operationId = "bulkRemoveAssets",
      summary = "Bulk Remove Assets",
      description = "Bulk Remove Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkRemoveGlossaryFromAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.ok()
        .entity(
            repository.bulkRemoveAssets(
                name, request, securityContext.getUserPrincipal().getName()))
        .build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDomain",
      summary = "Update a domain",
      description = "Update an existing domain using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchDomain",
      summary = "Update a domain by name.",
      description = "Update an existing domain using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for an Entity",
      description = "Update vote for an Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid org.openmetadata.schema.api.VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDomain",
      summary = "Delete a domain by Id",
      description = "Delete a domain by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDomainAsync",
      summary = "Asynchronously delete a domain by Id",
      description = "Asynchronously delete a domain by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDomainByFQN",
      summary = "Delete a domain by name",
      description = "Delete a domain by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, true, true);
  }

  @GET
  @Path("/hierarchy")
  @Operation(
      operationId = "listDomainsHierarchy",
      summary = "List domains in hierarchical order",
      description = "Get a list of Domains in hierarchical order.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Domains in hierarchical order",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHierarchyList.class)))
      })
  public ResultList<EntityHierarchy> listHierarchy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description =
                  "List domains filtered to retrieve the first level/immediate children of the domain `directChildrenOf` parameter. "
                      + "If not specified, returns only root domains (domains with no parent).",
              schema = @Schema(type = "string"))
          @QueryParam("directChildrenOf")
          String directChildrenOf,
      @Parameter(
              description =
                  "Offset from which to start returning results (for offset-based pagination)",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offset) {

    return repository.buildHierarchy(fieldsParam, limitParam, directChildrenOf, offset);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDomain",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this Domain",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response addFollower(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollowerFromDomain",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  @GET
  @Path("/{id}/assets")
  @Operation(
      operationId = "getDomainAssets",
      summary = "Get assets for a domain",
      description = "Get paginated list of assets belonging to a domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response getAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(repository.getDomainAssets(id, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/assets")
  @Operation(
      operationId = "getDomainAssetsByName",
      summary = "Get assets for a domain by name",
      description = "Get paginated list of assets belonging to a domain by domain name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Response getAssetsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(repository.getDomainAssetsByName(fqn, limit, offset)).build();
  }

  @GET
  @Path("/assets/counts")
  @Operation(
      operationId = "getAllDomainsWithAssetsCount",
      summary = "Get all domains with their asset counts",
      description =
          "Get a map of domain fully qualified names to their asset counts using search aggregation.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of domain FQN to asset count",
            content = @Content(mediaType = "application/json"))
      })
  public Response getAllDomainsWithAssetsCount(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    java.util.Map<String, Integer> result = repository.getAllDomainsWithAssetsCount();
    return Response.ok(result).build();
  }
}
