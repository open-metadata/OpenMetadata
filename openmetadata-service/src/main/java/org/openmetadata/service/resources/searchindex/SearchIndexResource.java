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

package org.openmetadata.service.resources.searchindex;

import static org.openmetadata.common.utils.CommonUtil.listOf;

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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SearchIndexRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.ResultList;

@Path("/v1/searchIndexes")
@Tag(
    name = "SearchIndex",
    description =
        "A `SearchIndex` is a index mapping for indexing documents in a `Search Service`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "searchIndexes")
public class SearchIndexResource extends EntityResource<SearchIndex, SearchIndexRepository> {
  private final SearchIndexMapper mapper = new SearchIndexMapper();
  public static final String COLLECTION_PATH = "v1/searchIndexes/";
  static final String FIELDS = "owners,followers,tags,extension,domain,dataProducts,sourceHash";

  @Override
  public SearchIndex addHref(UriInfo uriInfo, SearchIndex searchIndex) {
    super.addHref(uriInfo, searchIndex);
    Entity.withHref(uriInfo, searchIndex.getService());
    return searchIndex;
  }

  public SearchIndexResource(Authorizer authorizer, Limits limits) {
    super(Entity.SEARCH_INDEX, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    return listOf(MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
  }

  public static class SearchIndexList extends ResultList<SearchIndex> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listSearchIndexes",
      summary = "List searchIndexes",
      description =
          "Get a list of SearchIndexes, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of SearchIndexes",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndexList.class)))
      })
  public ResultList<SearchIndex> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter SearchIndexes by service name",
              schema = @Schema(type = "string", example = "ElasticSearchWestCoast"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Limit the number SearchIndexes returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of SearchIndexes before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of SearchIndexes after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllSearchIndexVersion",
      summary = "List SearchIndex versions",
      description = "Get a list of all the versions of a SearchIndex identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of SearchIndex versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a SearchIndex by id",
      description = "Get a SearchIndex by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class))),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {id} is not found")
      })
  public SearchIndex get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getSearchIndexByFQN",
      summary = "Get a SearchIndex by fully qualified name",
      description = "Get a SearchIndex by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class))),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {fqn} is not found")
      })
  public SearchIndex getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the SearchIndex",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificSearchIndexVersion",
      summary = "Get a version of the SearchIndex",
      description = "Get a version of the SearchIndex by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class))),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {id} and version {version} is not found")
      })
  public SearchIndex getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "SearchIndex version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createSearchIndex",
      summary = "Create a SearchIndex",
      description = "Create a SearchIndex under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSearchIndex create) {
    SearchIndex searchIndex =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, searchIndex);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchSearchIndex",
      summary = "Update a SearchIndex",
      description = "Update an existing SearchIndex using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchSearchIndex",
      summary = "Update a SearchIndex using name.",
      description = "Update an existing SearchIndex using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the SearchIndex", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateSearchIndex",
      summary = "Update SearchIndex",
      description = "Create a SearchIndex, it it does not exist or update an existing SearchIndex.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated SearchIndex ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSearchIndex create) {
    SearchIndex searchIndex =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, searchIndex);
  }

  @PUT
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "addSampleData",
      summary = "Add sample data",
      description = "Add sample data to the searchIndex.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class))),
      })
  public SearchIndex addSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid SearchIndexSampleData sampleData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    SearchIndex searchIndex = repository.addSampleData(id, sampleData);
    return addHref(uriInfo, searchIndex);
  }

  @GET
  @Path("/{id}/sampleData")
  @Operation(
      operationId = "getSampleData",
      summary = "Get sample data",
      description = "Get sample data from the SearchIndex.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully obtained the SampleData for SearchIndex",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class)))
      })
  public SearchIndex getSampleData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());

    SearchIndex searchIndex = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, searchIndex);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this SearchIndex",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the SearchIndex.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteSearchIndex",
      summary = "Delete a SearchIndex by id",
      description = "Delete a SearchIndex by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteSearchIndexAsync",
      summary = "Asynchronously delete a SearchIndex by id",
      description = "Asynchronously delete a SearchIndex by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the SearchIndex", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteSearchIndexByFQN",
      summary = "Delete a SearchIndex by fully qualified name",
      description = "Delete a SearchIndex by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SearchIndex for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the SearchIndex",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted SearchIndex",
      description = "Restore a soft deleted SearchIndex.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the SearchIndex. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchIndex.class)))
      })
  public Response restoreSearchIndex(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
