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
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.jdbi3.TopicRepository;
import org.openmetadata.catalog.resources.Collection;
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
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/topics")
@Api(value = "Topic data asset collection", tags = "Topic data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "topics", repositoryClass = "org.openmetadata.catalog.jdbi3.TopicRepository")
public class TopicResource {
  private static final Logger LOG = LoggerFactory.getLogger(TopicResource.class);
  private static final String TOPIC_COLLECTION_PATH = "v1/topics/";
  private final TopicRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, TOPIC_COLLECTION_PATH, ref.getId()));
  }

  public static List<Topic> addHref(UriInfo uriInfo, List<Topic> topics) {
    Optional.ofNullable(topics).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return topics;
  }

  public static Topic addHref(UriInfo uriInfo, Topic topic) {
    topic.setHref(RestUtil.getHref(uriInfo, TOPIC_COLLECTION_PATH, topic.getId()));
    EntityUtil.addHref(uriInfo, topic.getOwner());
    EntityUtil.addHref(uriInfo, topic.getService());
    EntityUtil.addHref(uriInfo, topic.getFollowers());
    return topic;
  }

  @Inject
  public TopicResource(TopicRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "TopicRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  static class TopicList extends ResultList<Topic> {
    @SuppressWarnings("unused")
    TopicList() {
      // Empty constructor needed for deserialization
    }

    TopicList(List<Topic> data, int limitParam, String beforeCursor,
              String afterCursor) throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, limitParam, beforeCursor, afterCursor);
    }
  }

  static final String FIELDS = "owner,service,followers,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Valid
  @Operation(summary = "List topics", tags = "topics",
          description = "Get a list of topics, optionally filtered by `service` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of topics",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = TopicList.class)))
          })
  public TopicList list(@Context UriInfo uriInfo,
                        @Context SecurityContext securityContext,
                        @Parameter(description = "Fields requested in the returned resource",
                                schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam,
                        @Parameter(description = "Filter topics by service name",
                                schema = @Schema(type = "string", example = "kafkaWestCoast"))
                        @QueryParam("service") String serviceParam,
                        @Parameter(description = "Limit the number topics returned. (1 to 1000000, default = 10)")
                        @DefaultValue("10")
                        @Min(1)
                        @Max(1000000)
                        @QueryParam("limit") int limitParam,
                        @Parameter(description = "Returns list of topics before this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("before") String before,
                        @Parameter(description = "Returns list of topics after this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    List<Topic> topics;
    String beforeCursor = null, afterCursor = null;

    // For calculating cursors, ask for one extra entry beyond limit. If the extra entry exists, then in forward
    // scrolling afterCursor is not null. Similarly, if the extra entry exists, then in reverse scrolling,
    // beforeCursor is not null. Remove the extra entry before returning results.
    if (before != null) { // Reverse paging
      topics = dao.listBefore(fields, serviceParam, limitParam + 1, before); // Ask for one extra entry
      if (topics.size() > limitParam) {
        topics.remove(0);
        beforeCursor = topics.get(0).getFullyQualifiedName();
      }
      afterCursor = topics.get(topics.size() - 1).getFullyQualifiedName();
    } else { // Forward paging or first page
      topics = dao.listAfter(fields, serviceParam, limitParam + 1, after);
      beforeCursor = after == null ? null : topics.get(0).getFullyQualifiedName();
      if (topics.size() > limitParam) {
        topics.remove(limitParam);
        afterCursor = topics.get(limitParam - 1).getFullyQualifiedName();
      }
    }
    addHref(uriInfo, topics);
    return new TopicList(topics, limitParam, beforeCursor, afterCursor);
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a topic", tags = "topics",
          description = "Get a topic by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The topic",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
          })
  public Topic get(@Context UriInfo uriInfo, @PathParam("id") String id,
                      @Context SecurityContext securityContext,
                      @Parameter(description = "Fields requested in the returned resource",
                              schema = @Schema(type = "string", example = FIELDS))
                      @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a topic by name", tags = "topics",
          description = "Get a topic by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The topic",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Dashboard.class))),
                  @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
          })
  public Response getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Topic topic = dao.getByName(fqn, fields);
    addHref(uriInfo, topic);
    return Response.ok(topic).build();
  }

  @POST
  @Operation(summary = "Create a topic", tags = "topics",
          description = "Create a topic under an existing `service`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The topic",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Topic.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateTopic create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Topic topic =
            new Topic().withId(UUID.randomUUID()).withName(create.getName()).withDescription(create.getDescription())
                    .withService(create.getService()).withPartitions(create.getPartitions())
                    .withSchemaText(create.getSchemaText()).withSchemaType(create.getSchemaType())
                    .withCleanupPolicies(create.getCleanupPolicies())
                    .withMaximumMessageSize(create.getMaximumMessageSize())
                    .withMinimumInSyncReplicas(create.getMinimumInSyncReplicas())
                    .withRetentionSize(create.getRetentionSize()).withRetentionTime(create.getRetentionTime())
                    .withTags(create.getTags());
    topic = addHref(uriInfo, dao.create(topic, create.getService(), create.getOwner()));
    return Response.created(topic.getHref()).entity(topic).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a topic", tags = "topics",
          description = "Update an existing topic using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Topic updateDescription(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @PathParam("id") String id,
                                 @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Topic topic = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            EntityUtil.getEntityReference(topic));
    topic = dao.patch(id, patch);
    return addHref(uriInfo, topic);
  }

  @PUT
  @Operation(summary = "Create or update topic", tags = "topics",
          description = "Create a topic, it it does not exist or update an existing topic.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The updated topic ",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Topic.class)))
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateTopic create) throws IOException {

    Topic topic =
            new Topic().withId(UUID.randomUUID()).withName(create.getName()).withDescription(create.getDescription())
                    .withService(create.getService()).withPartitions(create.getPartitions())
                    .withSchemaText(create.getSchemaText()).withSchemaType(create.getSchemaType())
                    .withCleanupPolicies(create.getCleanupPolicies())
                    .withMaximumMessageSize(create.getMaximumMessageSize())
                    .withMinimumInSyncReplicas(create.getMinimumInSyncReplicas())
                    .withRetentionSize(create.getRetentionSize()).withRetentionTime(create.getRetentionTime())
                    .withTags(create.getTags());
    PutResponse<Topic> response = dao.createOrUpdate(topic, create.getService(), create.getOwner());
    topic = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(topic).build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "topics",
          description = "Add a user identified by `userId` as followed of this topic",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the topic", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    Response.Status status = dao.addFollower(id, userId);
    Topic table = dao.get(id, fields);
    return Response.status(status).entity(table).build();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "topic",
          description = "Remove the user identified `userId` as a follower of the topic.")
  public Topic deleteFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the topic",
                                      schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user being removed as follower",
                                      schema = @Schema(type = "string"))
                              @PathParam("userId") String userId) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    dao.deleteFollower(id, userId);
    Topic topic = dao.get(id, fields);
    return addHref(uriInfo, topic);
  }


  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a topic", tags = "topics",
          description = "Delete a topic by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Topic for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(id);
    return Response.ok().build();
  }
}
