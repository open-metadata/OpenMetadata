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

package org.openmetadata.catalog.resources.glossary;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;

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
import java.util.List;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossaryTerm;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.GlossaryTermRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/glossaryTerms")
@Api(value = "Glossary collection", tags = "Glossary collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "glossaries")
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
    return term;
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

    public GlossaryTermList(List<GlossaryTerm> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "children,relatedTerms,reviewers,tags,usageCount";

  @GET
  @Valid
  @Operation(
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
          String parentTermParam,
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
            CatalogExceptionMessage.glossaryTermMismatch(parentTermParam, glossaryIdParam));
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
      summary = "Get a glossary",
      tags = "glossaries",
      description = "Get a glossary by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "404", description = "Glossary for instance {id} is not found")
      })
  public GlossaryTerm get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
  @Path("/name/{name}")
  @Operation(
      summary = "Get a glossary by name",
      tags = "glossaries",
      description = "Get a glossary by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "404", description = "Glossary for instance {id} is not found")
      })
  public GlossaryTerm getByName(
      @Context UriInfo uriInfo,
      @PathParam("name") String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List glossary versions",
      tags = "glossaries",
      description = "Get a list of all the versions of a glossary identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "glossary Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the glossaries",
      tags = "glossaries",
      description = "Get a version of the glossary by given `id`",
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
      @Parameter(description = "glossary Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "glossary version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a glossary",
      tags = "glossaries",
      description = "Create a new glossary.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateGlossaryTerm create)
      throws IOException {
    GlossaryTerm term = getGlossaryTerm(securityContext, create);
    return create(uriInfo, securityContext, term, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a glossary",
      tags = "glossaries",
      description = "Update an existing glossary using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
      summary = "Create or update a glossary",
      tags = "glossaries",
      description = "Create a new glossary, if it does not exist or update an existing glossary.",
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
    GlossaryTerm term = getGlossaryTerm(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, term, ADMIN | BOT);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Glossary",
      tags = "glossaries",
      description = "Delete a glossary by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "glossary for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Chart Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, ADMIN | BOT);
  }

  private GlossaryTerm getGlossaryTerm(SecurityContext securityContext, CreateGlossaryTerm create) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withSynonyms(create.getSynonyms())
        .withGlossary(create.getGlossary())
        .withParent(create.getParent())
        .withRelatedTerms(create.getRelatedTerms())
        .withReferences(create.getReferences())
        .withReviewers(create.getReviewers())
        .withTags(create.getTags())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
