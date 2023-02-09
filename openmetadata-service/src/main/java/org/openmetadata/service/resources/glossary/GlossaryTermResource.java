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

package org.openmetadata.service.resources.glossary;

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
import java.io.IOException;
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
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.tags.TagLabelCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/glossaryTerms")
@Api(value = "Glossary collection", tags = "Glossary collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "glossaryTerms", order = 7) // Initialized after Glossary, Classification, and Tags
public class GlossaryTermResource extends EntityResource<GlossaryTerm, GlossaryTermRepository> {
  public static final String COLLECTION_PATH = "v1/glossaryTerms/";

  @Override
  public GlossaryTerm addHref(UriInfo uriInfo, GlossaryTerm term) {
    term.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, term.getId()));
    Entity.withHref(uriInfo, term.getGlossary());
    Entity.withHref(uriInfo, term.getParent());
    Entity.withHref(uriInfo, term.getChildren());
    Entity.withHref(uriInfo, term.getRelatedTerms());
    Entity.withHref(uriInfo, term.getReviewers());
    Entity.withHref(uriInfo, term.getOwner());
    return term;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    TagLabelCache.initialize();
  }

  @Inject
  public GlossaryTermResource(CollectionDAO dao, Authorizer authorizer) {
    super(GlossaryTerm.class, new GlossaryTermRepository(dao), authorizer);
  }

  public static class GlossaryTermList extends ResultList<GlossaryTerm> {
    @SuppressWarnings("unused")
    GlossaryTermList() {
      // Empty constructor needed for deserialization
    }
  }

  static final String FIELDS = "children,relatedTerms,reviewers,owner,tags,usageCount";

  @GET
  @Valid
  @Operation(
      operationId = "listGlossaryTerm",
      summary = "List glossary terms",
      tags = "glossaries",
      description =
          "Get a list of glossary terms. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary terms",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryTermList.class)))
      })
  public ResultList<GlossaryTerm> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "List glossary terms filtered by glossary identified by Id given in `glossary` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("glossary")
          String glossaryIdParam,
      @Parameter(
              description =
                  "List glossary terms filtered by children of glossary term identified by Id given in "
                      + "`parent` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("parent")
          UUID parentTermParam,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number glossary terms returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of glossary terms before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of glossary terms after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    // TODO make this common implementation
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);

    // Filter by glossary
    String fqn = null;
    EntityReference glossary = null;
    if (glossaryIdParam != null) {
      glossary = dao.getGlossary(glossaryIdParam);
      fqn = glossary.getName();
    }

    // Filter by glossary parent term
    if (parentTermParam != null) {
      GlossaryTerm parentTerm = dao.get(uriInfo, parentTermParam, Fields.EMPTY_FIELDS);
      fqn = parentTerm.getFullyQualifiedName();

      // Ensure parent glossary term belongs to the glossary
      if ((glossary != null) && (!parentTerm.getGlossary().getId().equals(glossary.getId()))) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.glossaryTermMismatch(parentTermParam.toString(), glossaryIdParam));
      }
    }
    ListFilter filter = new ListFilter(include).addQueryParam("parent", fqn);

    ResultList<GlossaryTerm> terms;
    if (before != null) { // Reverse paging
      terms = dao.listBefore(uriInfo, fields, filter, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      terms = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, terms);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getGlossaryTermByID",
      summary = "Get a glossary term by Id",
      tags = "glossaries",
      description = "Get a glossary term by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "404", description = "Glossary for instance {id} is not found")
      })
  public GlossaryTerm get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getGlossaryTermByFQN",
      summary = "Get a glossary term by fully qualified name",
      tags = "glossaries",
      description = "Get a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "404", description = "Glossary for instance {fqn} is not found")
      })
  public GlossaryTerm getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the glossary term", schema = @Schema(type = "string"))
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllGlossaryTermVersion",
      summary = "List glossary term versions",
      tags = "glossaries",
      description = "Get a list of all the versions of a glossary terms identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary term versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificGlossaryTermVersion",
      summary = "Get a version of the glossary term",
      tags = "glossaries",
      description = "Get a version of the glossary term by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "glossaries",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary for instance {id} and version {version} is " + "not found")
      })
  public GlossaryTerm getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "glossary term version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createGlossaryTerm",
      summary = "Create a glossary term",
      tags = "glossaries",
      description = "Create a new glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateGlossaryTerm create)
      throws IOException {
    GlossaryTerm term = getGlossaryTerm(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, term);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchGlossaryTerm",
      summary = "Update a glossary term",
      tags = "glossaries",
      description = "Update an existing glossary term using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "createOrUpdateGlossaryTerm",
      summary = "Create or update a glossary term",
      tags = "glossaries",
      description = "Create a new glossary term, if it does not exist or update an existing glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateGlossaryTerm create)
      throws IOException {
    GlossaryTerm term = getGlossaryTerm(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, term);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a glossary term by Id",
      tags = "glossaries",
      description = "Delete a glossary term by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "glossaryTerm for instance {id} is not found")
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
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteGlossaryTermByName",
      summary = "Delete a glossary term by fully qualified name",
      tags = "glossaries",
      description = "Delete a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "glossaryTerm for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the glossary term", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted glossary term",
      tags = "glossaries",
      description = "Restore a soft deleted glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Chart ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryTerm.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private GlossaryTerm getGlossaryTerm(CreateGlossaryTerm create, String user) throws IOException {
    return copy(new GlossaryTerm(), create, user)
        .withSynonyms(create.getSynonyms())
        .withGlossary(create.getGlossary())
        .withParent(create.getParent())
        .withRelatedTerms(create.getRelatedTerms())
        .withReferences(create.getReferences())
        .withReviewers(create.getReviewers())
        .withTags(create.getTags())
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
