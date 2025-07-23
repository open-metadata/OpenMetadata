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

package org.openmetadata.service.resources.tags;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.CLASSIFICATION;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/tags")
@io.swagger.v3.oas.annotations.tags.Tag(
    name = "Classifications",
    description =
        "These APIs are related to `Classification` and `Tags`. A `Classification`"
            + " "
            + "entity "
            + "contains hierarchical"
            + " terms called `Tags` used "
            + "for categorizing and classifying data assets and other entities.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "tags",
    order = 5) // initialize after Classification, and before Glossary and GlossaryTerm
public class TagResource extends EntityResource<Tag, TagRepository> {
  private final ClassificationMapper classificationMapper = new ClassificationMapper();
  private final TagMapper mapper = new TagMapper();
  public static final String TAG_COLLECTION_PATH = "/v1/tags/";
  static final String FIELDS = "owners,domain,children,usageCount";

  static class TagList extends ResultList<Tag> {
    /* Required for serde */
  }

  public TagResource(Authorizer authorizer, Limits limits) {
    super(Entity.TAG, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("owners,domain,children,usageCount", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    // Find tag definitions and load classifications from the json file, if necessary
    ClassificationRepository classificationRepository =
        (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
    List<LoadTags> loadTagsList =
        EntityRepository.getEntitiesFromSeedData(
            CLASSIFICATION, ".*json/data/tags/.*\\.json$", LoadTags.class);
    for (LoadTags loadTags : loadTagsList) {
      Classification classification =
          classificationMapper.createToEntity(loadTags.getCreateClassification(), ADMIN_USER_NAME);
      classificationRepository.initializeEntity(classification);

      List<Tag> tagsToCreate = new ArrayList<>();
      for (CreateTag createTag : loadTags.getCreateTags()) {
        createTag.withClassification(classification.getName());
        createTag.withProvider(classification.getProvider());
        Tag tag = mapper.createToEntity(createTag, ADMIN_USER_NAME);
        repository.setFullyQualifiedName(tag); // FQN required for ordering tags based on hierarchy
        tagsToCreate.add(tag);
      }

      // Sort tags based on tag hierarchy
      EntityUtil.sortByFQN(tagsToCreate);

      for (Tag tag : tagsToCreate) {
        repository.initializeEntity(tag);
      }
    }
  }

  @GET
  @Valid
  @Operation(
      operationId = "listTags",
      summary = "List tags",
      description =
          "Get a list of tags. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tags",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TagList.class)))
      })
  public ResultList<Tag> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "List tags filtered by children of tag identified by fqn given in `parent` parameter. The fqn "
                      + "can either be classificationName or fqn of a parent tag",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("parent")
          String parent,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter Disabled Classifications",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("disabled")
          @DefaultValue("false")
          Boolean disabled,
      @Parameter(description = "Limit the number tags returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of tags before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of tags after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("parent", parent)
            .addQueryParam("classification.disabled", disabled);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTagByID",
      summary = "Get a tag by id",
      description = "Get a tag by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The tag",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "404", description = "Tag for instance {id} is not found")
      })
  public Tag get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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
      operationId = "getTagByFQN",
      summary = "Get a tag by fully qualified name",
      description = "Get a tag by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The tag",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "404", description = "Tag for instance {fqn} is not found")
      })
  public Tag getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the tag", schema = @Schema(type = "string"))
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTagVersion",
      summary = "List tag versions",
      description = "Get a list of all the versions of a tag identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of tag versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTagVersion",
      summary = "Get a version of the tags",
      description = "Get a version of the tag by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "tags",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Tag for instance {id} and version {version} is not found")
      })
  public Tag getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "tag version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTag",
      summary = "Create a tag",
      description = "Create a new tag.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The tag",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTag create) {
    Tag tag = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, tag);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTag",
      summary = "Update a tag",
      description = "Update an existing tag using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
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
      operationId = "patchTag",
      summary = "Update a tag using name.",
      description = "Update an existing tag using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the tag", schema = @Schema(type = "string"))
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
      operationId = "createOrUpdateTag",
      summary = "Create or update a tag",
      description = "Create a new tag, if it does not exist or update an existing tag.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The tag",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTag create) {
    Tag tag = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, tag);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTag",
      summary = "Delete a tag by id",
      description = "Delete a tag by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "tag for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteTagAsync",
      summary = "Asynchronously delete a tag by id",
      description = "Asynchronously delete a tag by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "tag for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteTagByName",
      summary = "Delete a tag by fully qualified name",
      description = "Delete a tag by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "tag for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the tag", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreTag",
      summary = "Restore a soft deleted tag.",
      description = "Restore a soft deleted tag.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Tag ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Tag.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{id}/assets/add")
  @Operation(
      operationId = "bulkAddTagToAssets",
      summary = "Bulk Add Classification Tag to Assets",
      description = "Bulk Add Classification Tag to Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkAddTagToAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddTagToAssetsRequest request) {
    return bulkAddToAssetsAsync(securityContext, id, request);
  }

  @PUT
  @Path("/{id}/assets/remove")
  @Operation(
      operationId = "bulkRemoveTagFromAssets",
      summary = "Bulk Remove Tag from Assets",
      description = "Bulk Remove Tag from Assets",
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
  public Response bulkRemoveTagFromAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddTagToAssetsRequest request) {
    return bulkRemoveFromAssetsAsync(securityContext, id, request);
  }

  @Override
  public Tag addHref(UriInfo uriInfo, Tag tag) {
    super.addHref(uriInfo, tag);
    Entity.withHref(uriInfo, tag.getClassification());
    Entity.withHref(uriInfo, tag.getParent());
    return tag;
  }
}
