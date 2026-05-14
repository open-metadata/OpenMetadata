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

package org.openmetadata.service.resources.feeds;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
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
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.AnnouncementStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
@Path("/v1/announcements")
@Tag(name = "Announcements", description = "Time-bound notifications for data assets")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "announcements", order = 8)
public class AnnouncementResource extends EntityResource<Announcement, AnnouncementRepository> {

  public static final String COLLECTION_PATH = "v1/announcements/";
  static final String FIELDS = "";

  public AnnouncementResource(Authorizer authorizer, Limits limits) {
    super(Entity.ANNOUNCEMENT, authorizer, limits);
  }

  public static class AnnouncementList extends ResultList<Announcement> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listAnnouncements",
      summary = "List announcements",
      description = "Get a list of announcements with optional filters.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of announcements",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AnnouncementList.class)))
      })
  public ResultList<Announcement> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields to include in response") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter by entity link") @QueryParam("entityLink") String entityLink,
      @Parameter(description = "Filter by status") @QueryParam("status") AnnouncementStatus status,
      @Parameter(description = "Filter active announcements") @QueryParam("active") Boolean active,
      @Parameter(description = "Filter by domain FQN") @QueryParam("domain") String domain,
      @Parameter(description = "Limit the number results")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list before this cursor") @QueryParam("before")
          String before,
      @Parameter(description = "Returns list after this cursor") @QueryParam("after") String after,
      @Parameter(description = "Include deleted announcements")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    repository.addDomainFilter(filter, domain);
    EntityUtil.addDomainQueryParam(securityContext, filter, Entity.ANNOUNCEMENT);
    if (entityLink != null) {
      filter.addQueryParam("entityLink", entityLink);
    }
    if (status != null) {
      filter.addQueryParam("status", status.value());
    }
    if (active != null) {
      filter.addQueryParam("active", String.valueOf(active));
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getAnnouncementById",
      summary = "Get an announcement by ID",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The announcement",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Announcement.class)))
      })
  public Announcement get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getAnnouncementByFQN",
      summary = "Get an announcement by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The announcement",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Announcement.class)))
      })
  public Announcement getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAnnouncementVersions",
      summary = "List announcement versions",
      responses = {
        @ApiResponse(responseCode = "200", description = "List of announcement versions")
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getAnnouncementVersion",
      summary = "Get a specific version of an announcement",
      responses = {@ApiResponse(responseCode = "200", description = "The announcement version")})
  public Announcement getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("version") String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createAnnouncement",
      summary = "Create an announcement",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created announcement",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Announcement.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAnnouncement create) {
    Announcement announcement =
        getAnnouncement(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, announcement);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateAnnouncement",
      summary = "Create or update an announcement",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The announcement",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Announcement.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAnnouncement create) {
    Announcement announcement =
        getAnnouncement(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, announcement);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchAnnouncement",
      summary = "Update an announcement",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteAnnouncement",
      summary = "Delete an announcement",
      responses = {@ApiResponse(responseCode = "200", description = "Announcement deleted")})
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(operationId = "restoreAnnouncement", summary = "Restore a soft deleted announcement")
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Announcement getAnnouncement(CreateAnnouncement create, String userName) {
    return new Announcement()
        .withId(UUID.randomUUID())
        .withName(create.getName() != null ? create.getName() : "announcement-" + UUID.randomUUID())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withEntityLink(create.getEntityLink())
        .withStartTime(create.getStartTime())
        .withEndTime(create.getEndTime())
        .withOwners(resolveOwners(create.getOwners()))
        .withCreatedBy(userName)
        .withUpdatedBy(userName)
        .withCreatedAt(System.currentTimeMillis())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private java.util.List<EntityReference> resolveOwners(java.util.List<String> owners) {
    if (owners == null || owners.isEmpty()) {
      return null;
    }

    return owners.stream().map(this::resolveOwner).filter(java.util.Objects::nonNull).toList();
  }

  private EntityReference resolveOwner(String ownerName) {
    try {
      return Entity.getEntityReferenceByName(Entity.USER, ownerName, Include.NON_DELETED);
    } catch (Exception ignored) {
      try {
        return Entity.getEntityReferenceByName(Entity.TEAM, ownerName, Include.NON_DELETED);
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid announcement owner: " + ownerName, e);
      }
    }
  }
}
