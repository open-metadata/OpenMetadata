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
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/glossaryTerms")
@Api(value = "Glossary collection", tags = "Glossary collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "glossaries")
public class GlossaryTermResource {
  public static final String COLLECTION_PATH = "v1/glossaryTerms/";
  private final GlossaryTermRepository dao;
  private final Authorizer authorizer;

  public static List<GlossaryTerm> addHref(UriInfo uriInfo, List<GlossaryTerm> terms) {
    Optional.ofNullable(terms).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return terms;
  }

  public static GlossaryTerm addHref(UriInfo uriInfo, GlossaryTerm term) {
    term.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, term.getId()));
    Entity.withHref(uriInfo, term.getGlossary());
    Entity.withHref(uriInfo, term.getParent());
    Entity.withHref(uriInfo, term.getRelatedTerms());
    Entity.withHref(uriInfo, term.getReviewers());
    return term;
  }

  @Inject
  public GlossaryTermResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "GlossaryTermRepository must not be null");
    this.dao = new GlossaryTermRepository(dao);
    this.authorizer = authorizer;
  }

  public static class GlossaryTermList extends ResultList<GlossaryTerm> {
    @SuppressWarnings("unused")
    GlossaryTermList() {
      // Empty constructor needed for deserialization
    }

    public GlossaryTermList(List<GlossaryTerm> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "children,relatedTerms,reviewers,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "").split(","));

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
          @Min(1)
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

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

    ResultList<GlossaryTerm> terms;
    if (before != null) { // Reverse paging
      terms = dao.listBefore(uriInfo, fields, fqn, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      terms = dao.listAfter(uriInfo, fields, fqn, limitParam, after, include);
    }
    addHref(uriInfo, terms.getData());
    return terms;
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields, include));
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    GlossaryTerm term = dao.getByName(uriInfo, name, fields, include);
    return addHref(uriInfo, term);
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
      throws IOException, ParseException {
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
      throws IOException, ParseException {
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
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    GlossaryTerm term = getGlossaryTerm(securityContext, create);
    term = addHref(uriInfo, dao.create(uriInfo, term));
    return Response.created(term.getHref()).entity(term).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a glossary",
      tags = "glossaries",
      description = "Update an existing glossary using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    GlossaryTerm term = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(term).getEntityReference(), patch);
    PatchResponse<GlossaryTerm> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
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
      throws IOException, ParseException {
    GlossaryTerm term = getGlossaryTerm(securityContext, create);
    EntityReference owner = dao.getOriginalOwner(term);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, owner);
    PutResponse<GlossaryTerm> response = dao.createOrUpdate(uriInfo, term);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
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
  public Response delete(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    DeleteResponse<GlossaryTerm> response = dao.delete(securityContext.getUserPrincipal().getName(), id);
    return response.toResponse();
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
