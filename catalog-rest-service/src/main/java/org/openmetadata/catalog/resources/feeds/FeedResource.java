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

package org.openmetadata.catalog.resources.feeds;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
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
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
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
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.api.feed.CreatePost;
import org.openmetadata.catalog.api.feed.CreateThread;
import org.openmetadata.catalog.api.feed.ThreadCount;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.FeedRepository;
import org.openmetadata.catalog.jdbi3.FeedRepository.FilterType;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/feed")
@Api(value = "Feeds collection", tags = "Feeds collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "feeds")
public class FeedResource {
  public static final String COLLECTION_PATH = "/v1/feed/";
  public static final List<String> ALLOWED_FIELDS = getAllowedFields();

  private final FeedRepository dao;
  private final Authorizer authorizer;

  private static List<String> getAllowedFields() {
    JsonPropertyOrder propertyOrder = Thread.class.getAnnotation(JsonPropertyOrder.class);
    return new ArrayList<>(Arrays.asList(propertyOrder.value()));
  }

  public static List<Thread> addHref(UriInfo uriInfo, List<Thread> threads) {
    threads.forEach(t -> addHref(uriInfo, t));
    return threads;
  }

  public static Thread addHref(UriInfo uriInfo, Thread thread) {
    thread.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, thread.getId()));
    return thread;
  }

  public FeedResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "FeedRepository must not be null");
    this.dao = new FeedRepository(dao);
    this.authorizer = authorizer;
  }

  static class ThreadList extends ResultList<Thread> {
    @SuppressWarnings("unused") // Used for deserialization
    ThreadList() {}

    ThreadList(List<Thread> data) {
      super(data);
    }
  }

  public static class PostList extends ResultList<Post> {
    @SuppressWarnings("unused") /* Required for tests */
    public PostList() {}

    public PostList(List<Post> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }

    public PostList(List<Post> listPosts) {
      super(listPosts);
    }
  }

  @GET
  @Operation(
      summary = "List threads",
      tags = "feeds",
      description = "Get a list of threads, optionally filtered by `entityLink`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of threads",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ThreadList.class)))
      })
  public ThreadList list(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Limit the number of posts sorted by chronological order (1 to 1000000, default = 3)",
              schema = @Schema(type = "integer"))
          @Min(1)
          @Max(1000000)
          @DefaultValue("3")
          @QueryParam("limitPosts")
          int limitPosts,
      @Parameter(
              description = "Filter threads by entity link",
              schema = @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>"))
          @QueryParam("entityLink")
          String entityLink,
      @Parameter(
              description =
                  "Filter threads by user id. This filter requires a 'filterType' query param. The default filter type is 'OWNER'",
              schema = @Schema(type = "string"))
          @QueryParam("userId")
          String userId,
      @Parameter(
              description =
                  "Filter type definition for the user filter. It can take one of 'OWNER', 'FOLLOWS', 'MENTIONS'. This must be used with the 'user' query param",
              schema = @Schema(implementation = FilterType.class))
          @QueryParam("filterType")
          FilterType filterType)
      throws IOException {
    return new ThreadList(addHref(uriInfo, dao.listThreads(entityLink, limitPosts, userId, filterType)));
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a thread",
      tags = "feeds",
      description = "Get a thread by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The thread",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Thread.class))),
        @ApiResponse(responseCode = "404", description = "Thread for instance {id} is not found")
      })
  public Thread get(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    return addHref(uriInfo, dao.get(id));
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a thread by `id`.",
      tags = "feeds",
      description = "Update an existing thread using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateThread(
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
    PatchResponse<Thread> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    return response.toResponse();
  }

  @GET
  @Path("/count")
  @Operation(
      summary = "count of threads",
      tags = "feeds",
      description = "Get a count of threads, optionally filtered by `entityLink` for each of the entities.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Count of threads",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ThreadCount.class)))
      })
  public ThreadCount getThreadCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Filter threads by entity link",
              schema = @Schema(type = "string", example = "<E#/{entityType}/{entityFQN}/{fieldName}>"))
          @QueryParam("entityLink")
          String entityLink,
      @Parameter(description = "Filter threads by whether it is active or resolved", schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("isResolved")
          Boolean isResolved)
      throws IOException {
    return dao.getThreadsCount(entityLink, isResolved);
  }

  @POST
  @Operation(
      summary = "Create a thread",
      tags = "feeds",
      description = "Create a new thread. A thread is created about a data asset when a user posts the first post.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The thread",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateThread.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateThread create)
      throws IOException, ParseException {
    Thread thread = getThread(securityContext, create);
    addHref(uriInfo, dao.create(thread));
    return Response.created(thread.getHref()).entity(thread).build();
  }

  @POST
  @Path("/{id}/posts")
  @Operation(
      summary = "Add post to a thread",
      tags = "feeds",
      description = "Add a post to an existing thread.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The post",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreatePost.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response addPost(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @PathParam("id") String id,
      @Valid CreatePost createPost)
      throws IOException {
    Post post = getPost(createPost);
    Thread thread = addHref(uriInfo, dao.addPostToThread(id, post, securityContext.getUserPrincipal().getName()));
    return Response.created(thread.getHref()).entity(thread).build();
  }

  @DELETE
  @Path("/{threadId}/posts/{postId}")
  @Operation(
      summary = "Delete a post from its thread",
      tags = "feeds",
      description = "Delete a post from an existing thread.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "post with {postId} is not found"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response deletePost(
      @Context SecurityContext securityContext,
      @Parameter(description = "ThreadId of the post to be deleted", schema = @Schema(type = "string"))
          @PathParam("threadId")
          String threadId,
      @Parameter(description = "PostId of the post to be deleted", schema = @Schema(type = "string"))
          @PathParam("postId")
          String postId)
      throws IOException {
    // validate and get thread & post
    Thread thread = dao.get(threadId);
    Post post = dao.getPostById(thread, postId);
    // delete post only if the admin/bot/author tries to delete it
    SecurityUtil.checkAdminOrBotOrOwner(authorizer, securityContext, dao.getOwnerOfPost(post));
    return dao.deletePost(thread, post, securityContext.getUserPrincipal().getName()).toResponse();
  }

  @GET
  @Path("/{id}/posts")
  @Operation(
      summary = "Get all the posts of a thread",
      tags = "feeds",
      description = "Get all the posts of an existing thread.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The posts of the given thread.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = PostList.class))),
      })
  public PostList getPosts(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    return new PostList(dao.listPosts(id));
  }

  private Thread getThread(SecurityContext securityContext, CreateThread create) {
    return new Thread()
        .withId(UUID.randomUUID())
        .withThreadTs(System.currentTimeMillis())
        .withMessage(create.getMessage())
        .withCreatedBy(create.getFrom())
        .withAbout(create.getAbout())
        .withAddressedTo(create.getAddressedTo())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private Post getPost(CreatePost create) {
    return new Post()
        .withId(UUID.randomUUID())
        .withMessage(create.getMessage())
        .withFrom(create.getFrom())
        .withPostTs(System.currentTimeMillis());
  }
}
