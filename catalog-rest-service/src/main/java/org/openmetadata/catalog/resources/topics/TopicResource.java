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
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
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
import org.openmetadata.catalog.jdbi3.TopicRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/topics")
@Api(value = "Topic data asset collection", tags = "Topic data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "topics")
public class TopicResource {
  public static final String COLLECTION_PATH = "v1/topics/";
  private final TopicRepository dao;
  private final Authorizer authorizer;

  public static ResultList<Topic> addHref(UriInfo uriInfo, ResultList<Topic> topics) {
    Optional.ofNullable(topics.getData()).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return topics;
  }

  public static Topic addHref(UriInfo uriInfo, Topic topic) {
    Entity.withHref(uriInfo, topic.getOwner());
    Entity.withHref(uriInfo, topic.getService());
    Entity.withHref(uriInfo, topic.getFollowers());
    return topic;
  }

  @Inject
  public TopicResource(CollectionDAO dao, Authorizer authorizer) {
    this.dao = new TopicRepository(dao);
    this.authorizer = authorizer;
  }

  public static class TopicList extends ResultList<Topic> {
    @SuppressWarnings("unused")
    public TopicList() {
      // Empty constructor needed for deserialization
    }

    public TopicList(List<Topic> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,followers,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

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
          @Min(1)
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Topic> topics;
    if (before != null) { // Reverse paging
      topics = dao.listBefore(uriInfo, fields, serviceParam, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      topics = dao.listAfter(uriInfo, fields, serviceParam, limitParam, after, include);
    }
    return addHref(uriInfo, topics);
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
      throws IOException, ParseException {
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
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
  public Response getByName(
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
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Topic topic = dao.getByName(uriInfo, fqn, fields, include);
    addHref(uriInfo, topic);
    return Response.ok(topic).build();
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
      throws IOException, ParseException {
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
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Topic topic = getTopic(securityContext, create);

    topic = addHref(uriInfo, dao.create(uriInfo, topic));
    return Response.created(topic.getHref()).entity(topic).build();
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Topic topic = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(topic).getEntityReference(), patch);

    PatchResponse<Topic> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      summary = "Create or update topic",
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
      throws IOException, ParseException {

    Topic topic = getTopic(securityContext, create);
    PutResponse<Topic> response = dao.createOrUpdate(uriInfo, topic);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
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
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    dao.delete(UUID.fromString(id), false);
    return Response.ok().build();
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
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
