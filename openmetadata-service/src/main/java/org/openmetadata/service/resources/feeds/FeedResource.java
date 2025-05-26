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

package org.openmetadata.service.resources.feeds;

import static org.openmetadata.schema.type.EventType.POST_CREATED;
import static org.openmetadata.schema.type.EventType.THREAD_CREATED;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;
import static org.openmetadata.service.util.RestUtil.CHANGE_CUSTOM_HEADER;

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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.feed.ThreadCount;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FeedFilter;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.jdbi3.FeedRepository.FilterType;
import org.openmetadata.service.jdbi3.FeedRepository.PaginationType;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PostResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.security.policyevaluator.ThreadResourceContext;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.ResultList;

@Path("/v1/feed")
@Tag(
    name = "Feeds",
    description = "Feeds API supports `Activity Feeds` and `Conversation Threads`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "feeds")
public class FeedResource {
  public static final String COLLECTION_PATH = "/v1/feed/";
  private final FeedMapper mapper = new FeedMapper();
  private final PostMapper postMapper = new PostMapper();
  private final FeedRepository dao;
  private final Authorizer authorizer;

  public static void addHref(UriInfo uriInfo, List<Thread> threads) {
    if (uriInfo != null) {
      threads.forEach(t -> addHref(uriInfo, t));
    }
  }

  public static Thread addHref(UriInfo uriInfo, Thread thread) {
    if (uriInfo != null) {
      thread.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, thread.getId()));
    }
    return thread;
  }

  public FeedResource(Authorizer authorizer) {
    this.dao = Entity.getFeedRepository();
    this.authorizer = authorizer;
  }

  public static class ThreadList extends ResultList<Thread> {
    /* Required for serde */
  }

  public static class PostList extends ResultList<Post> {
    /* Required for serde */
  }

  public static class ThreadCountList extends ResultList<ThreadCount> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listThreads",
      summary = "List threads",
      description = "Get a list of threads, optionally filtered by `entityLink`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of threads",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ThreadList.class)))
      })
  public ResultList<Thread> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Limit the number of posts sorted by chronological order (1 to 1000000, default = 3)",
              schema = @Schema(type = "integer"))
          @DefaultValue("3")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limitPosts")
          int limitPosts,
      @Parameter(description = "Limit the number of threads returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of threads before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of threads after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description =
                  "Filter threads by entity link of entity about which this thread is created",
              schema =
                  @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>"))
          @QueryParam("entityLink")
          String entityLink,
      @Parameter(
              description =
                  "Filter threads by user id. This filter requires a 'filterType' query param. The default filter type is 'OWNER'. This filter cannot be combined with the entityLink filter.",
              schema = @Schema(type = "string"))
          @QueryParam("userId")
          UUID userId,
      @Parameter(
              description =
                  "Filter type definition for the user filter. It can take one of 'OWNER', 'FOLLOWS', 'MENTIONS'. This must be used with the 'user' query param",
              schema = @Schema(implementation = FilterType.class))
          @QueryParam("filterType")
          FilterType filterType,
      @Parameter(
              description =
                  "Filter threads by whether they are resolved or not. By default resolved is false")
          @DefaultValue("false")
          @QueryParam("resolved")
          boolean resolved,
      @Parameter(
              description =
                  "The type of thread to filter the results. It can take one of 'Conversation', 'Task', 'Announcement'",
              schema = @Schema(implementation = ThreadType.class))
          @QueryParam("type")
          ThreadType threadType,
      @Parameter(
              description =
                  "The status of tasks to filter the results. It can take one of 'Open', 'Closed'. This filter will take effect only when type is set to Task",
              schema = @Schema(implementation = TaskStatus.class))
          @QueryParam("taskStatus")
          TaskStatus taskStatus,
      @Parameter(
              description =
                  "Whether to filter results by announcements that are currently active. This filter will take effect only when type is set to Announcement",
              schema = @Schema(type = "boolean"))
          @QueryParam("activeAnnouncement")
          Boolean activeAnnouncement) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    RestUtil.validateCursors(before, after);
    FeedFilter filter =
        FeedFilter.builder()
            .threadType(threadType)
            .taskStatus(taskStatus)
            .activeAnnouncement(activeAnnouncement)
            .resolved(resolved)
            .filterType(filterType)
            .paginationType(before != null ? PaginationType.BEFORE : PaginationType.AFTER)
            .before(before)
            .after(after)
            .applyDomainFilter(
                !subjectContext.isAdmin() && subjectContext.hasAnyRole(DOMAIN_ONLY_ACCESS_ROLE))
            .domains(
                getSubjectContext(securityContext).getUserDomains().stream()
                    .map(EntityReference::getId)
                    .toList())
            .build();

    ResultList<Thread> threads = dao.list(filter, entityLink, limitPosts, userId, limitParam);
    addHref(uriInfo, threads.getData());
    return threads;
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getThreadByID",
      summary = "Get a thread by Id",
      description = "Get a thread by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The thread",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "404", description = "Thread for instance {id} is not found")
      })
  public Thread get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Thread", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Type of the Entity", schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType) {
    return addHref(uriInfo, dao.get(id));
  }

  @GET
  @Path("/tasks/{id}")
  @Operation(
      operationId = "getTaskByID",
      summary = "Get a task thread by task Id",
      description = "Get a task thread by `task Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task thread",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "404", description = "Task for instance {id} is not found")
      })
  public Thread getTask(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the task thread", schema = @Schema(type = "string"))
          @PathParam("id")
          String id) {
    return addHref(uriInfo, dao.getTask(Integer.parseInt(id)));
  }

  @PUT
  @Path("/tasks/{id}/resolve")
  @Operation(
      operationId = "resolveTask",
      summary = "Resolve a task",
      description = "Resolve a task.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task thread",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response resolveTask(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the task thread", schema = @Schema(type = "string"))
          @PathParam("id")
          String id,
      @Valid ResolveTask resolveTask) {
    Thread task = dao.getTask(Integer.parseInt(id));
    dao.checkPermissionsForResolveTask(authorizer, task, false, securityContext);
    return dao.resolveTask(uriInfo, task, securityContext.getUserPrincipal().getName(), resolveTask)
        .toResponse();
  }

  @PUT
  @Path("/tasks/{id}/close")
  @Operation(
      operationId = "closeTask",
      summary = "Close a task",
      description = "Close a task without making any changes to the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The task thread.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response closeTask(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the task thread", schema = @Schema(type = "string"))
          @PathParam("id")
          String id,
      @Valid CloseTask closeTask) {
    Thread task = dao.getTask(Integer.parseInt(id));
    dao.checkPermissionsForResolveTask(authorizer, task, true, securityContext);
    return dao.closeTask(uriInfo, task, securityContext.getUserPrincipal().getName(), closeTask)
        .toResponse();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchThread",
      summary = "Update a thread by `Id`.",
      description = "Update an existing thread using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateThread(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the thread", schema = @Schema(type = "string"))
          @PathParam("id")
          String id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    PatchResponse<Thread> response =
        dao.patchThread(
            uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    return response.toResponse();
  }

  @GET
  @Path("/count")
  @Operation(
      operationId = "countThreads",
      summary = "Count of threads",
      description =
          "Get a count of threads, optionally filtered by `entityLink` for each of the entities.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Count of threads",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ThreadCountList.class)))
      })
  public ResultList<ThreadCount> getThreadCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Filter threads by entity link",
              schema =
                  @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>"))
          @QueryParam("entityLink")
          String entityLink) {
    return new ResultList<>(dao.getThreadsCount(entityLink));
  }

  @POST
  @Operation(
      operationId = "createThread",
      summary = "Create a thread",
      description =
          "Create a new thread. A thread is created about a data asset when a user posts the first post.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The thread",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createThread(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateThread create) {
    Thread thread = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, dao.create(thread));
    return Response.created(thread.getHref())
        .entity(thread)
        .header(CHANGE_CUSTOM_HEADER, THREAD_CREATED)
        .build();
  }

  @POST
  @Path("/{id}/posts")
  @Operation(
      operationId = "addPostToThread",
      summary = "Add post to a thread",
      description = "Add a post to an existing thread.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The post",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response addPost(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the thread", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Valid CreatePost createPost) {
    Post post = postMapper.createToEntity(createPost, securityContext.getUserPrincipal().getName());
    Thread thread =
        addHref(
            uriInfo, dao.addPostToThread(id, post, securityContext.getUserPrincipal().getName()));
    return Response.created(thread.getHref())
        .header(CHANGE_CUSTOM_HEADER, POST_CREATED)
        .entity(thread)
        .build();
  }

  @PATCH
  @Path("/{threadId}/posts/{postId}")
  @Operation(
      operationId = "patchPostOfThread",
      summary = "Update post of a thread by `Id`.",
      description = "Update a post of an existing thread using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"),
      responses = {
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "post with {postId} is not found")
      })
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchPost(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the thread", schema = @Schema(type = "string"))
          @PathParam("threadId")
          UUID threadId,
      @Parameter(description = "Id of the post", schema = @Schema(type = "string"))
          @PathParam("postId")
          UUID postId,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    // validate and get thread & post
    Thread thread = dao.get(threadId);
    Post post = dao.getPostById(thread, postId);

    PatchResponse<Post> response =
        dao.patchPost(thread, post, securityContext.getUserPrincipal().getName(), patch);
    return response.toResponse();
  }

  @DELETE
  @Path("/{threadId}")
  @Operation(
      operationId = "deleteThread",
      summary = "Delete a thread by Id",
      description = "Delete an existing thread and all its relationships.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "thread with {threadId} is not found"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response deleteThread(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ThreadId of the thread to be deleted",
              schema = @Schema(type = "string"))
          @PathParam("threadId")
          UUID threadId) {
    // validate and get the thread
    Thread thread = dao.get(threadId);
    // delete thread only if the admin/bot/author tries to delete it
    OperationContext operationContext =
        new OperationContext(Entity.THREAD, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = new ThreadResourceContext(thread.getCreatedBy());
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.deleteThread(thread, securityContext.getUserPrincipal().getName()).toResponse();
  }

  @DELETE
  @Path("/{threadId}/posts/{postId}")
  @Operation(
      operationId = "deletePostFromThread",
      summary = "Delete a post from its thread",
      description = "Delete a post from an existing thread.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "post with {postId} is not found"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response deletePost(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ThreadId of the post to be deleted",
              schema = @Schema(type = "string"))
          @PathParam("threadId")
          UUID threadId,
      @Parameter(
              description = "PostId of the post to be deleted",
              schema = @Schema(type = "string"))
          @PathParam("postId")
          UUID postId) {
    // validate and get thread & post
    Thread thread = dao.get(threadId);
    Post post = dao.getPostById(thread, postId);
    // delete post only if the admin/bot/author tries to delete it
    OperationContext operationContext =
        new OperationContext(Entity.THREAD, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext = new PostResourceContext(post.getFrom());
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.deletePost(thread, post, securityContext.getUserPrincipal().getName()).toResponse();
  }

  @GET
  @Path("/{id}/posts")
  @Operation(
      operationId = "getAllPostOfThread",
      summary = "Get all the posts of a thread",
      description = "Get all the posts of an existing thread.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The posts of the given thread.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PostList.class))),
      })
  public ResultList<Post> getPosts(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the thread", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id) {
    return new ResultList<>(dao.listPosts(id));
  }
}
