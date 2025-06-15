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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.SUGGESTION_CREATED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_REJECTED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_UPDATED;
import static org.openmetadata.service.util.RestUtil.CHANGE_CUSTOM_HEADER;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SuggestionFilter;
import org.openmetadata.service.jdbi3.SuggestionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PostResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/suggestions")
@Tag(
    name = "Suggestions",
    description =
        "Suggestions API supports ability to add suggestion for descriptions or tag labels for Entities.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "suggestions")
public class SuggestionsResource {
  public static final String COLLECTION_PATH = "/v1/suggestions/";
  private final SuggestionMapper mapper = new SuggestionMapper();
  private final SuggestionRepository dao;
  private final Authorizer authorizer;

  public static void addHref(UriInfo uriInfo, List<Suggestion> suggestions) {
    if (uriInfo != null) {
      suggestions.forEach(t -> addHref(uriInfo, t));
    }
  }

  public static Suggestion addHref(UriInfo uriInfo, Suggestion suggestion) {
    if (uriInfo != null) {
      suggestion.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, suggestion.getId()));
    }
    return suggestion;
  }

  public SuggestionsResource(Authorizer authorizer) {
    this.dao = Entity.getSuggestionRepository();
    this.authorizer = authorizer;
  }

  public static class SuggestionList extends ResultList<Suggestion> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listSuggestions",
      summary = "List Suggestions",
      description =
          "Get a list of suggestions, optionally filtered by `entityLink` or `entityFQN`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Suggestions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SuggestionList.class)))
      })
  public ResultList<Suggestion> list(
      @Context UriInfo uriInfo,
      @Parameter(
              description =
                  "Limit the number of suggestions returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(1)
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
      @Parameter(description = "Filter suggestions by entityFQN", schema = @Schema(type = "string"))
          @QueryParam("entityFQN")
          String entityFQN,
      @Parameter(
              description =
                  "Filter threads by user id or bot id. This filter requires a 'filterType' query param.",
              schema = @Schema(type = "string"))
          @QueryParam("userId")
          UUID userId,
      @Parameter(
              description =
                  "Filter threads by whether they are accepted or rejected. By default status is OPEN.")
          @DefaultValue("Open")
          @QueryParam("status")
          String status) {
    RestUtil.validateCursors(before, after);
    SuggestionFilter filter =
        SuggestionFilter.builder()
            .suggestionStatus(SuggestionStatus.valueOf(status))
            .entityFQN(entityFQN)
            .createdBy(userId)
            .paginationType(
                before != null
                    ? SuggestionRepository.PaginationType.BEFORE
                    : SuggestionRepository.PaginationType.AFTER)
            .before(before)
            .after(after)
            .build();
    ResultList<Suggestion> suggestions;
    if (before != null) {
      suggestions = dao.listBefore(filter, limitParam, before);
    } else {
      suggestions = dao.listAfter(filter, limitParam, after);
    }
    addHref(uriInfo, suggestions.getData());
    return suggestions;
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getSuggestionByID",
      summary = "Get a suggestion by Id",
      description = "Get a suggestion by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Suggestion",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Suggestion for instance {id} is not found")
      })
  public Suggestion get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Thread", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id) {
    return addHref(uriInfo, dao.get(id));
  }

  @PUT
  @Path("/{id}/accept")
  @Operation(
      operationId = "acceptSuggestion",
      summary = "Accept a Suggestion",
      description = "Accept a Suggestion and apply the changes to the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The suggestion.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response acceptSuggestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the suggestion", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id) {
    Suggestion suggestion = dao.get(id);
    dao.checkPermissionsForAcceptOrRejectSuggestion(
        suggestion, SuggestionStatus.Accepted, securityContext);
    return dao.acceptSuggestion(uriInfo, suggestion, securityContext, authorizer).toResponse();
  }

  @PUT
  @Path("/{id}/reject")
  @Operation(
      operationId = "rejectSuggestion",
      summary = "Reject a Suggestion",
      description = "Close a Suggestion without making any changes to the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Suggestion.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response rejectSuggestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the suggestion", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id) {
    Suggestion suggestion = dao.get(id);
    dao.checkPermissionsForAcceptOrRejectSuggestion(
        suggestion, SuggestionStatus.Rejected, securityContext);
    return dao.rejectSuggestion(uriInfo, suggestion, securityContext.getUserPrincipal().getName())
        .toResponse();
  }

  @PUT
  @Path("accept-all")
  @Operation(
      operationId = "acceptAllSuggestion",
      summary = "Accept all Suggestions from a user and an Entity",
      description = "Accept a Suggestion and apply the changes to the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The suggestion.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public RestUtil.PutResponse<List<Suggestion>> acceptAllSuggestions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "user id", schema = @Schema(type = "string")) @QueryParam("userId")
          UUID userId,
      @Parameter(description = "fullyQualifiedName of entity", schema = @Schema(type = "string"))
          @QueryParam("entityFQN")
          String entityFQN,
      @Parameter(description = "Suggestion type being accepted", schema = @Schema(type = "string"))
          @QueryParam("suggestionType")
          @DefaultValue("SuggestDescription")
          SuggestionType suggestionType) {
    SuggestionFilter filter =
        SuggestionFilter.builder()
            .suggestionStatus(SuggestionStatus.Open)
            .entityFQN(entityFQN)
            .createdBy(userId)
            .suggestionType(suggestionType)
            .build();
    List<Suggestion> suggestions = dao.listAll(filter);
    if (!nullOrEmpty(suggestions)) {
      // Validate the permissions for one suggestion
      Suggestion suggestion = dao.get(suggestions.get(0).getId());
      dao.checkPermissionsForAcceptOrRejectSuggestion(
          suggestion, SuggestionStatus.Rejected, securityContext);
      dao.checkPermissionsForEditEntity(suggestion, suggestionType, securityContext, authorizer);
      return dao.acceptSuggestionList(uriInfo, suggestions, securityContext, authorizer);
    } else {
      // No suggestions found
      return new RestUtil.PutResponse<>(
          Response.Status.BAD_REQUEST, List.of(), SUGGESTION_REJECTED);
    }
  }

  @PUT
  @Path("reject-all")
  @Operation(
      operationId = "rejectAllSuggestion",
      summary = "Reject all Suggestions from a user and an Entity",
      description = "Reject all Suggestions from a user and an Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The suggestion.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public RestUtil.PutResponse<List<Suggestion>> rejectAllSuggestions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "user id", schema = @Schema(type = "string")) @QueryParam("userId")
          UUID userId,
      @Parameter(description = "fullyQualifiedName of entity", schema = @Schema(type = "string"))
          @QueryParam("entityFQN")
          String entityFQN,
      @Parameter(description = "Suggestion type being rejected", schema = @Schema(type = "string"))
          @QueryParam("suggestionType")
          @DefaultValue("SuggestDescription")
          SuggestionType suggestionType) {
    SuggestionFilter filter =
        SuggestionFilter.builder()
            .suggestionStatus(SuggestionStatus.Open)
            .entityFQN(entityFQN)
            .createdBy(userId)
            .suggestionType(suggestionType)
            .build();
    List<Suggestion> suggestions = dao.listAll(filter);
    if (!nullOrEmpty(suggestions)) {
      // Validate the permissions for one suggestion
      Suggestion suggestion = dao.get(suggestions.get(0).getId());
      dao.checkPermissionsForAcceptOrRejectSuggestion(
          suggestion, SuggestionStatus.Rejected, securityContext);
      return dao.rejectSuggestionList(
          uriInfo, suggestions, securityContext.getUserPrincipal().getName());
    } else {
      // No suggestions found
      return new RestUtil.PutResponse<>(
          Response.Status.BAD_REQUEST, List.of(), SUGGESTION_REJECTED);
    }
  }

  @PUT
  @Path("/{id}")
  @Operation(
      operationId = "updateSuggestion",
      summary = "Update a suggestion by `Id`.",
      description = "Update an existing suggestion using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response updateSuggestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Suggestion", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id,
      @Valid Suggestion suggestion) {
    Suggestion origSuggestion = dao.get(id);
    dao.checkPermissionsForUpdateSuggestion(origSuggestion, securityContext);
    suggestion.setCreatedAt(origSuggestion.getCreatedAt());
    suggestion.setCreatedBy(origSuggestion.getCreatedBy());
    addHref(uriInfo, dao.update(suggestion, securityContext.getUserPrincipal().getName()));
    return Response.created(suggestion.getHref())
        .entity(suggestion)
        .header(CHANGE_CUSTOM_HEADER, SUGGESTION_UPDATED)
        .build();
  }

  @POST
  @Operation(
      operationId = "createSuggestion",
      summary = "Create a Suggestion",
      description =
          "Create a new Suggestion. A Suggestion is created about a data asset when a user suggests an update.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The thread",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggestion.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createSuggestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSuggestion create) {
    Suggestion suggestion =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, dao.create(suggestion));
    return Response.created(suggestion.getHref())
        .entity(suggestion)
        .header(CHANGE_CUSTOM_HEADER, SUGGESTION_CREATED)
        .build();
  }

  @DELETE
  @Path("/{suggestionId}")
  @Operation(
      operationId = "deleteSuggestion",
      summary = "Delete a Suggestion by Id",
      description = "Delete an existing Suggestion and all its relationships.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "thread with {threadId} is not found"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response deleteSuggestion(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ThreadId of the thread to be deleted",
              schema = @Schema(type = "string"))
          @PathParam("suggestionId")
          UUID suggestionId) {
    // validate and get the thread
    Suggestion suggestion = dao.get(suggestionId);
    // delete thread only if the admin/bot/author tries to delete it
    OperationContext operationContext =
        new OperationContext(Entity.SUGGESTION, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext =
        new PostResourceContext(suggestion.getCreatedBy().getName());
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.deleteSuggestion(suggestion, securityContext.getUserPrincipal().getName())
        .toResponse();
  }

  @DELETE
  @Path("/{entityType}/name/{entityFQN}")
  @Operation(
      operationId = "deleteSuggestions",
      summary = "Delete a Suggestions by entityFQN",
      description = "Delete an existing Suggestions and all its relationships.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "thread with {threadId} is not found"),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response deleteSuggestions(
      @Context SecurityContext securityContext,
      @Parameter(description = "entity type", schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType,
      @Parameter(description = "fullyQualifiedName of entity", schema = @Schema(type = "string"))
          @PathParam("entityFQN")
          String entityFQN) {
    // validate and get the thread
    EntityInterface entity =
        Entity.getEntityByName(entityType, entityFQN, "owners", Include.NON_DELETED);
    // delete thread only if the admin/bot/author tries to delete it
    OperationContext operationContext =
        new OperationContext(Entity.SUGGESTION, MetadataOperation.DELETE);
    ResourceContextInterface resourceContext =
        new PostResourceContext(entity.getOwners().get(0).getName());
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return dao.deleteSuggestionsForAnEntity(entity, securityContext.getUserPrincipal().getName())
        .toResponse();
  }
}
