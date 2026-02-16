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

package org.openmetadata.service.resources.activity;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

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
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ActivityStreamRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Resource for the lightweight activity stream API.
 *
 * <p>This provides access to the activity_stream table for:
 * <ul>
 *   <li>Homepage activity feed</li>
 *   <li>Entity page activity</li>
 *   <li>User profile activity</li>
 *   <li>Reactions on activity events</li>
 * </ul>
 *
 * <p>Domain-based filtering is automatically applied for users with domain-only access.
 */
@Slf4j
@Path("/v1/activity")
@Tag(
    name = "Activity Stream",
    description = "Lightweight activity notifications for dashboards and feeds.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "activity")
public class ActivityResource {

  private final ActivityStreamRepository activityStreamRepository;
  private final Authorizer authorizer;

  public ActivityResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.activityStreamRepository = new ActivityStreamRepository();
  }

  @GET
  @Operation(
      operationId = "listActivityEvents",
      summary = "List activity events",
      description =
          "Get a list of recent activity events. Domain filtering is automatically applied "
              + "for users with domain-only access policies.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of activity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> listActivityEvents(
      @Context SecurityContext securityContext,
      @Parameter(description = "Filter by entity type") @QueryParam("entityType") String entityType,
      @Parameter(description = "Filter by entity ID") @QueryParam("entityId") UUID entityId,
      @Parameter(description = "Filter by actor (user) ID") @QueryParam("actorId") UUID actorId,
      @Parameter(description = "Filter by domain IDs (comma-separated)") @QueryParam("domains")
          String domainsParam,
      @Parameter(description = "Number of days to look back (default 7, max 30)")
          @DefaultValue("7")
          @Min(1)
          @Max(30)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    // Calculate timestamp for filtering
    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();

    // Get user's domain context for filtering
    List<UUID> domainIds = getEffectiveDomains(securityContext, domainsParam);

    List<ActivityEvent> events;

    if (entityType != null && entityId != null) {
      // Filter by specific entity
      events = activityStreamRepository.listByEntity(entityType, entityId, afterTimestamp, limit);
    } else if (actorId != null) {
      // Filter by actor
      events = activityStreamRepository.listByActor(actorId, afterTimestamp, limit);
    } else if (!nullOrEmpty(domainIds)) {
      // Filter by domains
      events = activityStreamRepository.listByDomains(domainIds, afterTimestamp, limit);
    } else {
      // Return all recent activity
      events = activityStreamRepository.list(afterTimestamp, limit);
    }

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/entity/{entityType}/{entityId}")
  @Operation(
      operationId = "getEntityActivityById",
      summary = "Get activity for a specific entity by ID",
      description = "Get recent activity events for a specific entity using its UUID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of activity events for the entity",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> getEntityActivityById(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type", required = true) @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity ID (UUID)", required = true) @PathParam("entityId")
          UUID entityId,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("30")
          @Min(1)
          @Max(90)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();
    List<ActivityEvent> events =
        activityStreamRepository.listByEntity(entityType, entityId, afterTimestamp, limit);

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/entity/{entityType}/name/{fqn}")
  @Operation(
      operationId = "getEntityActivityByFqn",
      summary = "Get activity for a specific entity by fully qualified name",
      description = "Get recent activity events for a specific entity using its FQN.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of activity events for the entity",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> getEntityActivityByFqn(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type", required = true) @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity fully qualified name", required = true) @PathParam("fqn")
          String fqn,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("30")
          @Min(1)
          @Max(90)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();

    // Resolve FQN to entity ID
    org.openmetadata.schema.EntityInterface entity =
        Entity.getEntityByName(entityType, fqn, "", null);
    UUID entityId = entity.getId();

    List<ActivityEvent> events =
        activityStreamRepository.listByEntity(entityType, entityId, afterTimestamp, limit);

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/my-feed")
  @Operation(
      operationId = "getMyActivityFeed",
      summary = "Get personalized activity feed for current user",
      description = "Get activity events for entities owned by the current user or their teams.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Personalized activity feed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> getMyFeed(
      @Context SecurityContext securityContext,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("7")
          @Min(1)
          @Max(30)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();

    String userName = securityContext.getUserPrincipal().getName();
    EntityReference userRef = Entity.getEntityReferenceByName(Entity.USER, userName, null);
    List<String> teamIds = getTeamIds(userName);

    List<ActivityEvent> events =
        activityStreamRepository.listByOwners(
            userRef.getId().toString(), teamIds, afterTimestamp, limit);

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/about")
  @Operation(
      operationId = "getActivityByEntityLink",
      summary = "Get activity for a specific entity or field",
      description =
          "Get activity events for a specific entity, column, or field using EntityLink format. "
              + "Example: <#E::table::db.schema.table::columns::col1::description>",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Activity events for the EntityLink",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> getActivityByEntityLink(
      @Context SecurityContext securityContext,
      @Parameter(description = "EntityLink string", required = true) @QueryParam("entityLink")
          String entityLink,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("30")
          @Min(1)
          @Max(90)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();
    List<ActivityEvent> events =
        activityStreamRepository.listByAbout(entityLink, afterTimestamp, limit);

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/user/{userId}")
  @Operation(
      operationId = "getUserActivity",
      summary = "Get activity by a specific user",
      description = "Get recent activity events performed by a specific user.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of activity events by the user",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEventList.class)))
      })
  public ResultList<ActivityEvent> getUserActivity(
      @Context SecurityContext securityContext,
      @Parameter(description = "User ID", required = true) @PathParam("userId") UUID userId,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("30")
          @Min(1)
          @Max(90)
          @QueryParam("days")
          int days,
      @Parameter(description = "Maximum number of events to return")
          @DefaultValue("50")
          @Min(1)
          @Max(200)
          @QueryParam("limit")
          int limit) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();
    List<ActivityEvent> events =
        activityStreamRepository.listByActor(userId, afterTimestamp, limit);

    return new ResultList<>(events, null, null, events.size());
  }

  @GET
  @Path("/count")
  @Operation(
      operationId = "getActivityCount",
      summary = "Get activity event count",
      description = "Get the count of activity events in a time period.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Count of activity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Integer.class)))
      })
  public int getActivityCount(
      @Context SecurityContext securityContext,
      @Parameter(description = "Number of days to look back")
          @DefaultValue("7")
          @Min(1)
          @Max(30)
          @QueryParam("days")
          int days) {

    long afterTimestamp = Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();
    return activityStreamRepository.count(afterTimestamp);
  }

  @PUT
  @Path("/{id}/reaction/{reactionType}")
  @Operation(
      operationId = "addReactionToActivity",
      summary = "Add a reaction to an activity event",
      description = "Add a reaction (emoji) to an activity event.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Activity event with updated reactions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEvent.class))),
        @ApiResponse(responseCode = "404", description = "Activity event not found")
      })
  public ActivityEvent addReaction(
      @Context SecurityContext securityContext,
      @Parameter(description = "Activity event ID", required = true) @PathParam("id") UUID id,
      @Parameter(description = "Reaction type to add", required = true) @PathParam("reactionType")
          ReactionType reactionType) {
    String userName = securityContext.getUserPrincipal().getName();
    EntityReference userRef = Entity.getEntityReferenceByName(Entity.USER, userName, null);
    return activityStreamRepository.addReaction(id, userRef, reactionType);
  }

  @DELETE
  @Path("/{id}/reaction/{reactionType}")
  @Operation(
      operationId = "removeReactionFromActivity",
      summary = "Remove a reaction from an activity event",
      description = "Remove a reaction (emoji) from an activity event.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Activity event with updated reactions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEvent.class))),
        @ApiResponse(responseCode = "404", description = "Activity event not found")
      })
  public ActivityEvent removeReaction(
      @Context SecurityContext securityContext,
      @Parameter(description = "Activity event ID", required = true) @PathParam("id") UUID id,
      @Parameter(description = "Reaction type to remove", required = true)
          @PathParam("reactionType")
          ReactionType reactionType) {
    String userName = securityContext.getUserPrincipal().getName();
    EntityReference userRef = Entity.getEntityReferenceByName(Entity.USER, userName, null);
    return activityStreamRepository.removeReaction(id, userRef, reactionType);
  }

  @jakarta.ws.rs.POST
  @Path("/test-insert")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "insertActivityEventForTesting",
      summary = "Insert an activity event (for testing only)",
      description = "This endpoint is for integration tests to create activity events directly.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Created activity event",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ActivityEvent.class)))
      })
  public ActivityEvent insertForTesting(
      @Context SecurityContext securityContext, @Valid ActivityEvent event) {
    activityStreamRepository.insert(event);
    return event;
  }

  /** Get team IDs for a user. */
  private List<String> getTeamIds(String userName) {
    List<String> teamIds = new java.util.ArrayList<>();
    try {
      org.openmetadata.schema.entity.teams.User user =
          Entity.getEntityByName(Entity.USER, userName, "teams", null);
      if (user.getTeams() != null) {
        for (EntityReference team : user.getTeams()) {
          teamIds.add(team.getId().toString());
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get team IDs for user {}: {}", userName, e.getMessage());
    }
    return teamIds;
  }

  /**
   * Get effective domain IDs for filtering based on user's access and query parameters.
   */
  private List<UUID> getEffectiveDomains(SecurityContext securityContext, String domainsParam) {
    // Parse domain IDs from query parameter
    List<UUID> requestedDomains = null;
    if (!nullOrEmpty(domainsParam)) {
      requestedDomains =
          java.util.Arrays.stream(domainsParam.split(","))
              .map(String::trim)
              .filter(s -> !s.isEmpty())
              .map(UUID::fromString)
              .toList();
    }

    // Check if user has domain-only access policy
    try {
      SubjectContext subjectContext = getSubjectContext(securityContext);
      if (subjectContext != null
          && !subjectContext.isAdmin()
          && subjectContext.hasAnyRole(DOMAIN_ONLY_ACCESS_ROLE)) {
        // User can only see activity in their domains
        List<EntityReference> userDomains = subjectContext.getUserDomains();
        if (!nullOrEmpty(userDomains)) {
          List<UUID> userDomainIds = userDomains.stream().map(EntityReference::getId).toList();

          // If user requested specific domains, intersect with their allowed domains
          if (!nullOrEmpty(requestedDomains)) {
            return requestedDomains.stream().filter(userDomainIds::contains).toList();
          }
          return userDomainIds;
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get subject context for domain filtering: {}", e.getMessage());
    }

    return requestedDomains;
  }

  /** Schema class for OpenAPI documentation. */
  private static class ActivityEventList extends ResultList<ActivityEvent> {
    public ActivityEventList() {
      super();
    }
  }
}
