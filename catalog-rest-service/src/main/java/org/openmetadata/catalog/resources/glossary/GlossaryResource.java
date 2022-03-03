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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.GlossaryRepository;
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

@Path("/v1/glossaries")
@Api(value = "Glossary collection", tags = "Glossary collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "glossaries")
public class GlossaryResource {
  public static final String COLLECTION_PATH = "v1/glossaries/";
  private final GlossaryRepository dao;
  private final Authorizer authorizer;

  public static List<Glossary> addHref(UriInfo uriInfo, List<Glossary> glossaries) {
    listOrEmpty(glossaries).forEach(i -> addHref(uriInfo, i));
    return glossaries;
  }

  public static Glossary addHref(UriInfo uriInfo, Glossary glossary) {
    glossary.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, glossary.getId()));
    Entity.withHref(uriInfo, glossary.getOwner());
    Entity.withHref(uriInfo, glossary.getReviewers());
    return glossary;
  }

  @Inject
  public GlossaryResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "GlossaryRepository must not be null");
    this.dao = new GlossaryRepository(dao);
    this.authorizer = authorizer;
  }

  public static class GlossaryList extends ResultList<Glossary> {
    @SuppressWarnings("unused")
    GlossaryList() {
      // Empty constructor needed for deserialization
    }

    public GlossaryList(List<Glossary> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,tags,reviewers";
  public static final List<String> ALLOWED_FIELDS = Entity.getEntityFields(Glossary.class);

  @GET
  @Valid
  @Operation(
      summary = "List Glossaries",
      tags = "glossaries",
      description =
          "Get a list of glossaries. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossaries",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = GlossaryList.class)))
      })
  public ResultList<Glossary> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number glossaries returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of glossaries before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of glossaries after this cursor", schema = @Schema(type = "string"))
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
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);

    ResultList<Glossary> glossary;
    if (before != null) { // Reverse paging
      glossary = dao.listBefore(uriInfo, fields, null, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      glossary = dao.listAfter(uriInfo, fields, null, limitParam, after, include);
    }
    addHref(uriInfo, glossary.getData());
    return glossary;
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
  public Glossary get(
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
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);
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
  public Glossary getByName(
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
    Fields fields = new Fields(ALLOWED_FIELDS, fieldsParam);
    Glossary glossary = dao.getByName(uriInfo, name, fields, include);
    return addHref(uriInfo, glossary);
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
  public Glossary getVersion(
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
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CreateGlossary.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateGlossary create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Glossary glossary = getGlossary(securityContext, create);
    glossary = addHref(uriInfo, dao.create(uriInfo, glossary));
    return Response.created(glossary.getHref()).entity(glossary).build();
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
    Fields fields = new Fields(ALLOWED_FIELDS, FIELDS);
    Glossary glossary = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(glossary).getEntityReference(), patch);
    PatchResponse<Glossary> response =
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateGlossary create)
      throws IOException, ParseException {
    Glossary glossary = getGlossary(securityContext, create);
    EntityReference owner = dao.getOriginalOwner(glossary);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, owner);
    PutResponse<Glossary> response = dao.createOrUpdate(uriInfo, glossary);
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
    DeleteResponse<Glossary> response = dao.delete(securityContext.getUserPrincipal().getName(), id);
    return response.toResponse();
  }

  private Glossary getGlossary(SecurityContext securityContext, CreateGlossary create) {
    return new Glossary()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withReviewers(create.getReviewers())
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
