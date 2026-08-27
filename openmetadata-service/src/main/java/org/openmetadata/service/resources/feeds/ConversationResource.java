/*
 *  Copyright 2026 Collate
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

import io.swagger.v3.oas.annotations.Operation;
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
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.type.ConversationFilterType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ConversationRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;

@Path("/v1/conversations")
@Tag(name = "Conversations", description = "User conversations associated with metadata entities.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "conversations")
public class ConversationResource {
  private final ConversationRepository repository;
  private final Authorizer authorizer;

  public ConversationResource(Authorizer authorizer) {
    this.repository = Entity.getConversationRepository();
    this.authorizer = authorizer;
  }

  @GET
  @Operation(operationId = "listConversations", summary = "List conversations")
  public ResultList<Conversation> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("entityLink") String entityLink,
      @QueryParam("userId") UUID userId,
      @QueryParam("filterType") ConversationFilterType filterType,
      @DefaultValue("false") @QueryParam("resolved") Boolean resolved,
      @QueryParam("startTs") Long startTs,
      @QueryParam("endTs") Long endTs,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @DefaultValue("10") @Min(1) @Max(100) @QueryParam("limit") int limit) {
    return repository.list(
        uriInfo,
        securityContext,
        authorizer,
        entityLink,
        userId,
        filterType,
        resolved,
        startTs,
        endTs,
        before,
        after,
        limit);
  }

  @POST
  @Operation(operationId = "createConversation", summary = "Create a conversation")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateConversation request) {
    Conversation conversation = repository.create(uriInfo, securityContext, authorizer, request);
    return Response.created(conversation.getHref())
        .entity(conversation)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.THREAD_CREATED.value())
        .build();
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getConversation", summary = "Get a conversation")
  public Conversation get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    return repository.get(uriInfo, securityContext, authorizer, id);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchConversation", summary = "Update a conversation")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    Conversation conversation = repository.patch(uriInfo, securityContext, authorizer, id, patch);
    return Response.ok(conversation)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.THREAD_UPDATED.value())
        .build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteConversation", summary = "Delete a conversation")
  public Response delete(@Context SecurityContext securityContext, @PathParam("id") UUID id) {
    Conversation conversation = repository.delete(securityContext, authorizer, id);
    return Response.ok(conversation)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.THREAD_UPDATED.value())
        .build();
  }

  @PUT
  @Path("/{id}/reaction/{reactionType}")
  @Operation(operationId = "addConversationReaction", summary = "React to a conversation")
  public Response putReaction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("reactionType") ReactionType reactionType) {
    Conversation conversation =
        repository.putRootReaction(uriInfo, securityContext, authorizer, id, reactionType);
    return Response.ok(conversation)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.THREAD_UPDATED.value())
        .build();
  }

  @DELETE
  @Path("/{id}/reaction/{reactionType}")
  @Operation(operationId = "deleteConversationReaction", summary = "Remove a reaction")
  public Response deleteReaction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("reactionType") ReactionType reactionType) {
    Conversation conversation =
        repository.deleteRootReaction(uriInfo, securityContext, authorizer, id, reactionType);
    return Response.ok(conversation)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.THREAD_UPDATED.value())
        .build();
  }

  @GET
  @Path("/{id}/replies")
  @Operation(operationId = "listConversationReplies", summary = "List conversation replies")
  public ResultList<ConversationReply> listReplies(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @DefaultValue("20") @Min(1) @Max(100) @QueryParam("limit") int limit) {
    return repository.listReplies(securityContext, authorizer, id, before, after, limit);
  }

  @POST
  @Path("/{id}/replies")
  @Operation(operationId = "createConversationReply", summary = "Reply to a conversation")
  public Response addReply(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid CreatePost request) {
    ConversationReply reply = repository.addReply(securityContext, authorizer, id, request);
    return Response.status(Response.Status.CREATED)
        .entity(reply)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.POST_CREATED.value())
        .build();
  }

  @PATCH
  @Path("/{id}/replies/{replyId}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchConversationReply", summary = "Update a reply")
  public Response patchReply(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("replyId") UUID replyId,
      JsonPatch patch) {
    ConversationReply reply =
        repository.patchReply(securityContext, authorizer, id, replyId, patch);
    return Response.ok(reply)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.POST_UPDATED.value())
        .build();
  }

  @DELETE
  @Path("/{id}/replies/{replyId}")
  @Operation(operationId = "deleteConversationReply", summary = "Delete a reply")
  public Response deleteReply(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("replyId") UUID replyId) {
    ConversationReply reply = repository.deleteReply(securityContext, authorizer, id, replyId);
    return Response.ok(reply)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.POST_UPDATED.value())
        .build();
  }

  @PUT
  @Path("/{id}/replies/{replyId}/reaction/{reactionType}")
  @Operation(operationId = "addConversationReplyReaction", summary = "React to a reply")
  public Response putReplyReaction(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("replyId") UUID replyId,
      @PathParam("reactionType") ReactionType reactionType) {
    ConversationReply reply =
        repository.putReplyReaction(securityContext, authorizer, id, replyId, reactionType);
    return Response.ok(reply)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.POST_UPDATED.value())
        .build();
  }

  @DELETE
  @Path("/{id}/replies/{replyId}/reaction/{reactionType}")
  @Operation(operationId = "deleteConversationReplyReaction", summary = "Remove reply reaction")
  public Response deleteReplyReaction(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("replyId") UUID replyId,
      @PathParam("reactionType") ReactionType reactionType) {
    ConversationReply reply =
        repository.deleteReplyReaction(securityContext, authorizer, id, replyId, reactionType);
    return Response.ok(reply)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.POST_UPDATED.value())
        .build();
  }

  public static class ConversationList extends ResultList<Conversation> {
    /* Required for serde. */
  }

  public static class ConversationReplyList extends ResultList<ConversationReply> {
    /* Required for serde. */
  }
}
