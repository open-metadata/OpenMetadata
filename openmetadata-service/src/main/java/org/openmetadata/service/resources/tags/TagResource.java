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
import static org.openmetadata.service.Entity.TAG;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
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
@Collection(name = "tags", order = 5) // initialize after Classification, and before Glossary and GlossaryTerm
public class TagResource extends EntityResource<Tag, TagRepository> {
  private final CollectionDAO daoCollection;
  public static final String TAG_COLLECTION_PATH = "/v1/tags/";

  static class TagList extends ResultList<Tag> {
    @SuppressWarnings("unused") // Empty constructor needed for deserialization
    TagList() {}
  }

  public TagResource(CollectionDAO collectionDAO, Authorizer authorizer) {
    super(Tag.class, new TagRepository(collectionDAO), authorizer);
    Objects.requireNonNull(collectionDAO, "TagRepository must not be null");
    daoCollection = collectionDAO;
  }

  private void migrateTags() {
    // Just want to run it when upgrading to version above 0.13.1 where tag relationship are not there , once we have
    // any entries we don't need to run it
    if (!(daoCollection.relationshipDAO().findIfAnyRelationExist(CLASSIFICATION, TAG) > 0)) {
      // We are missing relationship for classification -> tag, and also tag -> tag (parent relationship)
      // Find tag definitions and load classifications from the json file, if necessary
      ClassificationRepository classificationRepository =
          (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
      try {
        List<Classification> classificationList =
            classificationRepository.listAll(classificationRepository.getFields("*"), new ListFilter(Include.ALL));
        List<String> jsons = dao.dao.listAfter(new ListFilter(Include.ALL), Integer.MAX_VALUE, "");
        List<Tag> storedTags = JsonUtils.readObjects(jsons, Tag.class);
        for (Tag tag : storedTags) {
          if (tag.getFullyQualifiedName().contains(".")) {
            // Either it has classification or a tag which is its parent
            // Check Classification
            String[] tokens = tag.getFullyQualifiedName().split("\\.", 2);
            String classificationName = tokens[0];
            String remainingPart = tokens[1];
            for (Classification classification : classificationList) {
              if (classification.getName().equals(classificationName)) {
                // This means need to add a relationship
                try {
                  dao.addRelationship(classification.getId(), tag.getId(), CLASSIFICATION, TAG, Relationship.CONTAINS);
                  break;
                } catch (Exception ex) {
                  LOG.info("Classification Relation already exists");
                }
              }
            }
            if (remainingPart.contains(".")) {
              // Handle tag -> tag relationship
              String parentTagName =
                  tag.getFullyQualifiedName().substring(0, tag.getFullyQualifiedName().lastIndexOf("."));
              for (Tag parentTag : storedTags) {
                if (parentTag.getFullyQualifiedName().equals(parentTagName)) {
                  try {
                    dao.addRelationship(parentTag.getId(), tag.getId(), TAG, TAG, Relationship.CONTAINS);
                    break;
                  } catch (Exception ex) {
                    LOG.info("Parent Tag Ownership already exists");
                  }
                }
              }
            }
          }
        }
      } catch (Exception ex) {
        LOG.error("Failed in Listing all the Stored Tags.");
      }
    }
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // TODO: Once we have migrated to the version above 0.13.1, then this can be removed
    migrateTags();
    // Find tag definitions and load classifications from the json file, if necessary
    ClassificationRepository classificationRepository =
        (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
    List<LoadTags> loadTagsList =
        EntityRepository.getEntitiesFromSeedData(CLASSIFICATION, ".*json/data/tags/.*\\.json$", LoadTags.class);
    for (LoadTags loadTags : loadTagsList) {
      Classification classification =
          ClassificationResource.getClassification(loadTags.getCreateClassification(), ADMIN_USER_NAME);
      classificationRepository.initializeEntity(classification);

      List<Tag> tagsToCreate = new ArrayList<>();
      for (CreateTag createTag : loadTags.getCreateTags()) {
        createTag.withClassification(classification.getName());
        createTag.withProvider(classification.getProvider());
        tagsToCreate.add(getTag(createTag, ADMIN_USER_NAME));
      }

      // Sort tags based on tag hierarchy
      EntityUtil.sortByTagHierarchy(tagsToCreate);

      for (Tag tag : tagsToCreate) {
        dao.initializeEntity(tag);
      }
    }
  }

  static final String FIELDS = "children, usageCount";

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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TagList.class)))
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
      @Parameter(description = "Limit the number tags returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of tags before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tags after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("parent", parent);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "404", description = "Tag for instance {id} is not found")
      })
  public Tag get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      throws IOException {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "404", description = "Tag for instance {fqn} is not found")
      })
  public Tag getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the tag", schema = @Schema(type = "string")) @PathParam("fqn")
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
          Include include)
      throws IOException {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Tag for instance {id} and version {version} is " + "not found")
      })
  public Tag getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "tag version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTag create)
      throws IOException {
    Tag tag = getTag(securityContext, create);
    return create(uriInfo, securityContext, tag);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchTag",
      summary = "Update a tag",
      description = "Update an existing tag using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTag create) throws IOException {
    Tag tag = getTag(create, securityContext.getUserPrincipal().getName());
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
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the tag", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
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
      @Parameter(description = "Fully qualified name of the tag", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn)
      throws IOException {
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Tag.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @Override
  public Tag addHref(UriInfo uriInfo, Tag tag) {
    Entity.withHref(uriInfo, tag.getClassification());
    Entity.withHref(uriInfo, tag.getParent());
    Entity.withHref(uriInfo, tag.getChildren());
    return tag;
  }

  private Tag getTag(SecurityContext securityContext, CreateTag create) throws IOException {
    return getTag(create, securityContext.getUserPrincipal().getName());
  }

  private Tag getTag(CreateTag create, String updateBy) throws IOException {
    String parentFQN = create.getParent() != null ? create.getParent() : create.getClassification();
    EntityReference classification = getEntityReference(CLASSIFICATION, create.getClassification());
    EntityReference parent = create.getParent() == null ? null : getEntityReference(TAG, create.getParent());
    return copy(new Tag(), create, updateBy)
        .withFullyQualifiedName(FullyQualifiedName.add(parentFQN, create.getName()))
        .withParent(parent)
        .withClassification(classification)
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
