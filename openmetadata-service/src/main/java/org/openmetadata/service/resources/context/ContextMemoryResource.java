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

package org.openmetadata.service.resources.context;

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
import jakarta.ws.rs.BadRequestException;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
@Tag(name = "Context Memories", description = "APIs for managing reusable Context Center memories.")
@Path("/v1/contextCenter/memories")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "contextMemories")
public class ContextMemoryResource extends EntityResource<ContextMemory, ContextMemoryRepository> {
  public static final String COLLECTION_PATH = "v1/contextCenter/memories/";
  public static final String FIELDS = "owners,tags,domains,primaryEntity,relatedEntities";
  private static final String PIN_UPDATE_FIELDS =
      FIELDS + ",rootMemory,parentMemory,sourceEntity,sourceFile";

  private final ContextMemoryMapper mapper = new ContextMemoryMapper();

  public ContextMemoryResource(Authorizer authorizer, Limits limits) {
    super(Entity.CONTEXT_MEMORY, authorizer, limits);
  }

  public static class ContextMemoryList extends ResultList<ContextMemory> {
    /* Required for serde */
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  @Override
  public ContextMemory addHref(UriInfo uriInfo, ContextMemory memory) {
    super.addHref(uriInfo, memory);
    Entity.withHref(uriInfo, memory.getPrimaryEntity());
    Entity.withHref(uriInfo, memory.getRelatedEntities());
    Entity.withHref(uriInfo, memory.getRootMemory());
    Entity.withHref(uriInfo, memory.getParentMemory());
    return memory;
  }

  @GET
  @Operation(
      operationId = "listContextMemories",
      summary = "List context memories",
      description = "Get a paginated list of context memories.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of context memories",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemoryList.class)))
      })
  public ResultList<ContextMemory> list(
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
      @Parameter(description = "Returns list of context memories before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of context memories after this cursor")
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(description = "Search title, question, answer, and summary") @QueryParam("q")
          String q,
      @Parameter(
              description =
                  "Comma-separated asset UUIDs. Matches the memory primaryEntity or relatedEntities.")
          @QueryParam("assets")
          String assets,
      @Parameter(description = "Memory author as user name or user UUID") @QueryParam("author")
          String author,
      @Parameter(description = "Filter by pinned state") @QueryParam("pinned") Boolean pinned,
      @Parameter(description = "Sort field: updatedAt, usageCount, updatedBy") @QueryParam("sortBy")
          String sortBy,
      @Parameter(description = "Sort order: asc or desc") @QueryParam("sortOrder") String sortOrder,
      @Parameter(description = "Offset for search-backed pagination") @Min(0) @QueryParam("offset")
          Integer offset,
      @Parameter(
              description =
                  "Only return knowledge pills extracted from the context file with this id",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("sourceFileId")
          UUID sourceFileId,
      @Parameter(
              description =
                  "Only return knowledge pills extracted from the context entity (file or page) with this id",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("sourceEntityId")
          UUID sourceEntityId,
      @Parameter(
              description =
                  "Only return knowledge pills whose primaryEntity (the data asset the pill applies to) has this id",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("primaryEntityId")
          UUID primaryEntityId)
      throws IOException {
    if (hasSearchBackedListParams(q, assets, author, pinned, sortBy, offset)) {
      return listMemoriesFromSearch(
          uriInfo,
          securityContext,
          fieldsParam,
          q,
          assets,
          author,
          pinned,
          sortBy,
          sortOrder,
          limitParam,
          offset == null ? 0 : offset,
          before,
          after,
          include,
          sourceFileId,
          sourceEntityId,
          primaryEntityId);
    }

    ListFilter filter = new ListFilter(include);
    if (sourceFileId != null) {
      filter.addQueryParam("sourceFileId", sourceFileId.toString());
    }
    if (sourceEntityId != null) {
      filter.addQueryParam("sourceEntityId", sourceEntityId.toString());
    }
    if (primaryEntityId != null) {
      filter.addQueryParam("primaryEntityId", primaryEntityId.toString());
    }
    ResultList<ContextMemory> memories =
        addHref(
            uriInfo,
            listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after));
    List<ContextMemory> visible =
        ContextMemoryVisibility.filterByVisibility(memories.getData(), securityContext);
    if (visible.size() == memories.getData().size()) {
      return memories;
    }
    return new ResultList<>(visible);
  }

  private ResultList<ContextMemory> listMemoriesFromSearch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      String q,
      String assets,
      String author,
      Boolean pinned,
      String sortBy,
      String sortOrder,
      int limit,
      int offset,
      String before,
      String after,
      Include include,
      UUID sourceFileId,
      UUID sourceEntityId,
      UUID primaryEntityId)
      throws IOException {
    validateSearchBackedListParams(before, after, sourceFileId, sourceEntityId, primaryEntityId);
    SearchListFilter searchListFilter =
        buildContextMemorySearchFilter(include, assets, author, pinned, null);
    SearchSortFilter searchSortFilter =
        new SearchSortFilter(resolveSortField(sortBy), resolveSortOrder(sortOrder), null, null);
    EntityUtil.Fields fields = getFields(fieldsParam);
    ResultList<ContextMemory> memories =
        listInternalFromSearch(
            uriInfo,
            securityContext,
            fields,
            searchListFilter,
            limit,
            offset,
            searchSortFilter,
            q,
            null,
            getAuthRequestsForListOps());
    // The search index does not enforce shareConfig visibility, so a non-admin could otherwise
    // read another user's PRIVATE memory by adding any search param. Apply the same per-memory
    // filter the non-search branch uses.
    List<ContextMemory> visible =
        ContextMemoryVisibility.filterByVisibility(memories.getData(), securityContext);
    return visible.size() == memories.getData().size() ? memories : new ResultList<>(visible);
  }

  private static boolean hasSearchBackedListParams(
      String q, String assets, String author, Boolean pinned, String sortBy, Integer offset) {
    return !CommonUtil.nullOrEmpty(q)
        || !CommonUtil.nullOrEmpty(assets)
        || !CommonUtil.nullOrEmpty(author)
        || pinned != null
        || !CommonUtil.nullOrEmpty(sortBy)
        || offset != null;
  }

  private static void validateSearchBackedListParams(
      String before, String after, UUID sourceFileId, UUID sourceEntityId, UUID primaryEntityId) {
    if (!CommonUtil.nullOrEmpty(before) || !CommonUtil.nullOrEmpty(after)) {
      throw new BadRequestException(
          "before/after cursor pagination cannot be combined with q/assets/author/pinned/sortBy/offset");
    }
    if (sourceFileId != null || sourceEntityId != null || primaryEntityId != null) {
      throw new BadRequestException(
          "sourceFileId/sourceEntityId/primaryEntityId cannot be combined with q/assets/author/pinned/sortBy/offset");
    }
  }

  private SearchListFilter buildContextMemorySearchFilter(
      Include include, String assets, String author, Boolean pinned, String includeFields) {
    SearchListFilter searchListFilter = new SearchListFilter(include);
    if (!CommonUtil.nullOrEmpty(assets)) {
      searchListFilter.addQueryParam("assets", normalizeAssetIds(assets));
    }
    if (!CommonUtil.nullOrEmpty(author)) {
      searchListFilter.addQueryParam("owners", resolveAuthorId(author));
    }
    if (pinned != null) {
      searchListFilter.addQueryParam("pinned", pinned);
    }
    if (!CommonUtil.nullOrEmpty(includeFields)) {
      searchListFilter.addQueryParam("includeFields", includeFields);
    }
    return searchListFilter;
  }

  private static String normalizeAssetIds(String assets) {
    List<String> ids = new ArrayList<>();
    for (String asset : assets.split(",")) {
      String trimmed = asset.trim();
      if (trimmed.isEmpty()) {
        continue;
      }
      try {
        ids.add(UUID.fromString(trimmed).toString());
      } catch (IllegalArgumentException ex) {
        throw new BadRequestException(
            String.format("Invalid assets value '%s'. Expected comma-separated UUIDs.", trimmed));
      }
    }
    return String.join(",", ids);
  }

  private String resolveAuthorId(String author) {
    String trimmed = author.trim();
    String result;
    try {
      result = UUID.fromString(trimmed).toString();
    } catch (IllegalArgumentException ignored) {
      result = resolveAuthorByName(trimmed);
    }
    return result;
  }

  private String resolveAuthorByName(String name) {
    String result;
    try {
      User user = Entity.getEntityByName(Entity.USER, name, "", Include.NON_DELETED);
      result = user.getId().toString();
    } catch (EntityNotFoundException e) {
      throw new BadRequestException("Unknown author '" + name + "'. Expected a user name or UUID.");
    }
    return result;
  }

  private static String resolveSortField(String sortBy) {
    if (CommonUtil.nullOrEmpty(sortBy)) {
      return "updatedAt";
    }
    return switch (sortBy) {
      case "updatedAt" -> "updatedAt";
      case "usageCount" -> "usageCount";
      case "updatedBy" -> "updatedBy.keyword";
      default -> throw new BadRequestException(
          "Unsupported sortBy value '" + sortBy + "'. Allowed: updatedAt, usageCount, updatedBy.");
    };
  }

  private static String resolveSortOrder(String sortOrder) {
    if (CommonUtil.nullOrEmpty(sortOrder)) {
      return "desc";
    }
    if (!"asc".equals(sortOrder) && !"desc".equals(sortOrder)) {
      throw new BadRequestException(
          "Unsupported sortOrder value '" + sortOrder + "'. Allowed: asc, desc.");
    }
    return sortOrder;
  }

  private List<AuthRequest> getAuthRequestsForListOps() {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    return List.of(new AuthRequest(operationContext, getResourceContext()));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getContextMemory",
      summary = "Get a memory by id",
      description = "Get a context memory by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The context memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class))),
        @ApiResponse(responseCode = "404", description = "Memory not found")
      })
  public ContextMemory get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Fields requested in the returned resource") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include all, deleted, or non-deleted entities")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ContextMemory memory = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    ContextMemoryVisibility.enforceVisibility(memory, securityContext);
    return memory;
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getContextMemoryByFqn",
      summary = "Get a memory by fully qualified name",
      description = "Get a context memory by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The context memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class))),
        @ApiResponse(responseCode = "404", description = "Memory not found")
      })
  public ContextMemory getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the context memory") @PathParam("fqn")
          String fqn,
      @Parameter(description = "Fields requested in the returned resource") @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include deleted memories")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ContextMemory memory = getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
    ContextMemoryVisibility.enforceVisibility(memory, securityContext);
    return memory;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllContextMemoryVersions",
      summary = "List context memory versions",
      description = "Get a list of all the versions of a context memory identified by `id`.",
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
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificContextMemoryVersion",
      summary = "Get a version of a context memory",
      description = "Get a version of a context memory by given `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Context memory version details",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public ContextMemory getVersion(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Context memory version", schema = @Schema(type = "string"))
          @PathParam("version")
          String version) {
    return getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createContextMemory",
      summary = "Create a memory",
      description = "Create a new context memory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContextMemory create) {
    ContextMemory memory =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, memory);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateContextMemory",
      summary = "Create or update a memory",
      description = "Create a new context memory, or update an existing one if it already exists.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContextMemory create) {
    ContextMemory memory =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, memory);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchContextMemory",
      summary = "Update a memory",
      description = "Apply a JSONPatch to a context memory.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
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

  @PUT
  @Path("/{id}/pin")
  @Operation(
      operationId = "pinContextMemory",
      summary = "Pin a memory",
      description = "Globally pin a context memory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The pinned memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public Response pin(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return setPinned(uriInfo, securityContext, id, true);
  }

  @DELETE
  @Path("/{id}/pin")
  @Operation(
      operationId = "unpinContextMemory",
      summary = "Unpin a memory",
      description = "Remove the global pin from a context memory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The unpinned memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public Response unpin(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return setPinned(uriInfo, securityContext, id, false);
  }

  private Response setPinned(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean pinned) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    ContextMemory original =
        repository.get(uriInfo, id, getFields(PIN_UPDATE_FIELDS), Include.NON_DELETED, false);
    ContextMemory updated = JsonUtils.deepCopy(original, ContextMemory.class);
    updated.setPinned(pinned);
    var response =
        repository.update(uriInfo, original, updated, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteContextMemory",
      summary = "Delete a memory by id",
      description = "Delete a context memory by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Memory not found")
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
      @Parameter(description = "Id of the context memory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteContextMemoryByFqn",
      summary = "Delete a memory by fully qualified name",
      description = "Delete a context memory by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Memory not found")
      })
  public Response deleteByFqn(
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
      @Parameter(description = "Fully qualified name of the context memory") @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreContextMemory",
      summary = "Restore a soft-deleted memory",
      description = "Restore a previously soft-deleted context memory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The restored memory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextMemory.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "Id of the context memory to restore",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(type = "string", format = "uuid")))
          RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
