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

package org.openmetadata.catalog.resources.feeds;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.feed.CreateThread;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.jdbi3.FeedRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

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
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/feed")
@Api(value = "Feeds collection", tags = "Feeds collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "feeds", repositoryClass = "org.openmetadata.catalog.jdbi3.FeedRepository")
public class FeedResource {
  // TODO add /v1/feed?user=userid
  public static final String COLLECTION_PATH = "/v1/feed/";
  private final FeedRepository dao;

  public static List<Thread> addHref(UriInfo uriInfo, List<Thread> threads) {
    threads.forEach(t -> addHref(uriInfo, t));
    return threads;
  }

  public static Thread addHref(UriInfo uriInfo, Thread thread) {
    thread.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, thread.getId()));
    return thread;
  }

  @Inject
  public FeedResource(FeedRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "FeedRepository must not be null");
    this.dao = dao;
  }

  static class ThreadList extends ResultList<Thread> {
    @SuppressWarnings("unused") // Used for deserialization
    ThreadList() {}

    ThreadList(List<Thread> data) {
      super(data);
    }
  }

  @GET
  @Operation(summary = "List threads", tags = "feeds",
          description = "Get a list of threads, optionally filtered by `entityLink`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of threads",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = ThreadList.class)))
          })
  public ThreadList list(@Context UriInfo uriInfo,
                         @Parameter(description = "Filter threads by entity link",
                                 schema = @Schema(type = "string", example = "<E#/{entityType}/{entityId}>"))
                         @QueryParam("entity") String entityLink) throws IOException {
    return new ThreadList(addHref(uriInfo, dao.listThreads(entityLink)));
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a thread", tags = "feeds",
          description = "Get a thread by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thread",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Thread.class))),
                  @ApiResponse(responseCode = "404", description = "Thread for instance {id} is not found")
          })
  public Thread get(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    return addHref(uriInfo, dao.get(id));
  }

  @POST
  @Operation(summary = "Create a thread", tags = "feeds",
          description = "Create a new thread. A thread is created about a data asset when a user posts the first post.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thread",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateThread.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Valid CreateThread cr) throws IOException {
    Thread thread = new Thread().withId(UUID.randomUUID()).withThreadTs(new Date())
            .withAbout(cr.getAbout());
    // For now redundantly storing everything in json (that includes fromEntity, addressedTo entity)
    // TODO - This needs cleanup later if this information is too much or inconsistent in relationship table
    FeedUtil.addPost(thread, new Post().withMessage(cr.getMessage()).withFrom(cr.getFrom()));
    addHref(uriInfo, dao.create(thread));
    return Response.created(thread.getHref()).entity(thread).build();
  }

  @POST
  @Path("/{id}/posts")
  @Operation(summary = "Add post to a thread", tags = "feeds",
          description = "Add a post to an existing thread.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The post",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Post.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response addPost(@Context UriInfo uriInfo, @PathParam("id") String id,
                        @Valid Post post) throws IOException {
    Thread thread = addHref(uriInfo, dao.addPostToThread(id, post));
    return Response.created(thread.getHref()).entity(thread).build();
  }
}