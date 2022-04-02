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

package org.openmetadata.catalog.resources.topics;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;

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
import java.io.IOException;
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
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.TopicRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/topics")
@Api(value = "Topic data asset collection", tags = "Topic data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "topics")
public class TopicResource extends EntityResource<Topic, TopicRepository> {
  public static final String COLLECTION_PATH = "v1/topics/";

  @Override
  public Topic addHref(UriInfo uriInfo, Topic topic) {
    Entity.withHref(uriInfo, topic.getOwner());
    Entity.withHref(uriInfo, topic.getService());
    Entity.withHref(uriInfo, topic.getFollowers());
    return topic;
  }

  @Inject
  public TopicResource(CollectionDAO dao, Authorizer authorizer) {
    super(Topic.class, new TopicRepository(dao), authorizer);
  }

  public static class TopicList extends ResultList<Topic> {
    @SuppressWarnings("unused")
    public TopicList() {
      // Empty constructor needed for deserialization
    }

    public TopicList(List<Topic> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,followers,tags";

  @GET
  @Operation(
      summary = "List topics",
      tags = "topics",
      description =
          "Get a list of topics, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of topics",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TopicList.class)))
      })
  public ResultList<Topic> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter topics by service name",
              schema = @Schema(type = "string", example = "kafkaWestCoast"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number topics returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of topics before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of topics after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(uriInfo, null, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List topic versions",
      tags = "topics",
      description = "Get a list of all the versions of a topic identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of topic versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Topic Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a topic",
      tags = "topics",
      description = "Get a topic by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The topic",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Topic.class))),
        @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
      })
  public Topic get(
      @Context UriInfo uriInfo,
      @PathParam("id") String id,
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
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a topic by name",
      tags = "topics",
      description = "Get a topic by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The topic",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Topic.class))),
        @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
      })
  public Topic getByName(
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
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the topic",
      tags = "topics",
      description = "Get a version of the topic by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "topic",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Topic.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Topic for instance {id} and version {version} is " + "not found")
      })
  public Topic getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Topic Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Topic version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a topic",
      tags = "topics",
      description = "Create a topic under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The topic",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTopic.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTopic create)
      throws IOException {
    Topic topic = getTopic(securityContext, create);
    return create(uriInfo, securityContext, topic, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a topic",
      tags = "topics",
      description = "Update an existing topic using JsonPatch.",
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
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      summary = "Update topic",
      tags = "topics",
      description = "Create a topic, it it does not exist or update an existing topic.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated topic ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTopic.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTopic create)
      throws IOException {
    Topic topic = getTopic(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, topic, ADMIN | BOT | OWNER);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "topics",
      description = "Add a user identified by `userId` as followed of this topic",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the topic", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      tags = "topics",
      description = "Remove the user identified `userId` as a follower of the topic.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the topic", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      summary = "Delete a topic",
      tags = "topics",
      description = "Delete a topic by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Topic Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, ADMIN | BOT);
  }

  private Topic getTopic(SecurityContext securityContext, CreateTopic create) {
    return new Topic()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withPartitions(create.getPartitions())
        .withSchemaText(create.getSchemaText())
        .withSchemaType(create.getSchemaType())
        .withCleanupPolicies(create.getCleanupPolicies())
        .withMaximumMessageSize(create.getMaximumMessageSize())
        .withMinimumInSyncReplicas(create.getMinimumInSyncReplicas())
        .withRetentionSize(create.getRetentionSize())
        .withRetentionTime(create.getRetentionTime())
        .withReplicationFactor(create.getReplicationFactor())
        .withTopicConfig(create.getTopicConfig())
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
