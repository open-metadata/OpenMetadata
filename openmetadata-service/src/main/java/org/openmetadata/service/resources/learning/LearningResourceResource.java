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

package org.openmetadata.service.resources.learning;

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
import java.io.IOException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.learning.CreateLearningResource;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.LearningResourceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/learning/resources")
@Tag(
    name = "Learning Resources",
    description =
        "Inline tutorials and expert content surfaced across OpenMetadata product surfaces.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "learning/resources", order = 3)
public class LearningResourceResource
    extends EntityResource<LearningResource, LearningResourceRepository> {
  public static final String COLLECTION_PATH = "/v1/learning/resources";
  static final String FIELDS = "owners,reviewers,tags,followers,contexts,categories";

  public LearningResourceResource(Authorizer authorizer, Limits limits) {
    super(Entity.LEARNING_RESOURCE, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Use merge method to add new resources and update existing ones
    repository.initSeedDataWithMerge();
  }

  @Override
  public LearningResource addHref(UriInfo uriInfo, LearningResource resource) {
    super.addHref(uriInfo, resource);
    return resource;
  }

  public static class LearningResourceList extends ResultList<LearningResource> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listLearningResources",
      summary = "List learning resources",
      description = "Get a paginated list of learning resources with optional contextual filters.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of learning resources",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResourceList.class)))
      })
  public ResultList<LearningResource> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of results returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of learning resources before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of learning resources after this cursor")
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description =
                  "Filter resources to specific page identifiers (supports comma-separated values)",
              schema = @Schema(type = "string"))
          @QueryParam("pageId")
          String pageId,
      @Parameter(
              description = "Filter by component identifier within a page",
              schema = @Schema(type = "string"))
          @QueryParam("componentId")
          String componentId,
      @Parameter(
              description =
                  "Filter by category (supports comma-separated values, e.g. DataGovernance,DataQuality)",
              schema = @Schema(type = "string", example = "DataGovernance"))
          @QueryParam("category")
          String category,
      @Parameter(
              description = "Filter by difficulty tier",
              schema = @Schema(type = "string", example = "Intro"))
          @QueryParam("difficulty")
          String difficulty,
      @Parameter(
              description =
                  "Filter by lifecycle status (supports comma-separated values, e.g. Active,Draft)",
              schema = @Schema(type = "string", example = "Active"))
          @QueryParam("status")
          String status,
      @Parameter(
              description =
                  "Filter by resource type (supports comma-separated values, e.g. Video,Storylane,Article)",
              schema = @Schema(type = "string", example = "Video"))
          @QueryParam("resourceType")
          String resourceType,
      @Parameter(
              description = "Search by name or display name (case-insensitive partial match)",
              schema = @Schema(type = "string"))
          @QueryParam("search")
          String search) {
    LearningResourceRepository.LearningResourceFilter filter =
        new LearningResourceRepository.LearningResourceFilter(include);
    if (pageId != null) {
      filter.addQueryParam("pageId", pageId);
    }
    if (componentId != null) {
      filter.addQueryParam("componentId", componentId);
    }
    if (category != null) {
      filter.addQueryParam("category", category);
    }
    if (difficulty != null) {
      filter.addQueryParam("difficulty", difficulty);
    }
    if (status != null) {
      filter.addQueryParam("status", status);
    }
    if (resourceType != null) {
      filter.addQueryParam("resourceType", resourceType);
    }
    if (search != null) {
      filter.addQueryParam("search", "%" + search + "%");
    }

    return addHref(
        uriInfo,
        listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getLearningResource",
      summary = "Get a learning resource by id",
      description = "Get a learning resource by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The learning resource",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class))),
        @ApiResponse(responseCode = "404", description = "Resource not found")
      })
  public LearningResource get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fields requested in the returned resource") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include all, deleted, or non-deleted entities")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(description = "Id of the learning resource", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getLearningResourceByName",
      summary = "Get a learning resource by name",
      description = "Get a learning resource by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The learning resource",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class))),
        @ApiResponse(responseCode = "404", description = "Resource not found")
      })
  public LearningResource getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the learning resource") @PathParam("name")
          String name,
      @Parameter(description = "Fields requested in the returned resource") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include deleted resources")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List learning resource versions",
      description = "Get a list of versions for the specified learning resource.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the learning resource", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a learning resource version",
      description = "Get a specific version of the learning resource.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Learning resource version details",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class)))
      })
  public LearningResource getVersion(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the learning resource", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Learning resource version", schema = @Schema(type = "string"))
          @PathParam("version")
          String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createLearningResource",
      summary = "Create a learning resource",
      description = "Create a new learning resource entry.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created resource",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateLearningResource create) {
    LearningResource resource = toEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, resource);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateLearningResource",
      summary = "Create or update a learning resource",
      description =
          "Create a new learning resource, or update an existing one if it already exists.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated resource",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateLearningResource create) {
    LearningResource resource = toEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, resource);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchLearningResource",
      summary = "Update a learning resource",
      description = "Apply a JSONPatch to a learning resource.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the learning resource", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples =
                          @ExampleObject("[{op:replace, path:/displayName, value: 'New name'}]")))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteLearningResource",
      summary = "Delete a learning resource",
      description = "Delete a learning resource by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Resource not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and its children. (Default = false)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = false)")
          @DefaultValue("false")
          @QueryParam("hardDelete")
          boolean hardDelete,
      @Parameter(description = "Id of the learning resource", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreLearningResource",
      summary = "Restore a soft-deleted learning resource",
      description = "Restore a previously soft-deleted learning resource.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The restored resource",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LearningResource.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "Id of the learning resource to restore",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(type = "string", format = "uuid")))
          RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private LearningResource toEntity(CreateLearningResource create, String updatedBy) {
    LearningResource resource = repository.copy(new LearningResource(), create, updatedBy);
    resource.setResourceType(create.getResourceType());
    resource.setCategories(create.getCategories());
    resource.setDifficulty(create.getDifficulty());
    resource.setSource(create.getSource());
    resource.setEstimatedDuration(create.getEstimatedDuration());
    resource.setContexts(create.getContexts());
    resource.setStatus(
        create.getStatus() == null
            ? null
            : LearningResource.Status.fromValue(create.getStatus().value()));
    return resource;
  }
}
