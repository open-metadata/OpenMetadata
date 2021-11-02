/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.thesauruses;

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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateThesaurus;
import org.openmetadata.catalog.entity.data.Thesaurus;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ThesaurusRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/thesauruses")
@Api(value = "Thesauruses collection", tags = "Thesauruses collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "thesauruses")
public class ThesaurusResource {
  public static final String COLLECTION_PATH = "v1/thesauruses/";
  private final ThesaurusRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, ref.getId()));
  }

  public static List<Thesaurus> addHref(UriInfo uriInfo, List<Thesaurus> thesauruses) {
    Optional.ofNullable(thesauruses).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return thesauruses;
  }

  public static Thesaurus addHref(UriInfo uriInfo, Thesaurus thesaurus) {
    thesaurus.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, thesaurus.getId()));
    Entity.withHref(uriInfo, thesaurus.getOwner());
    Entity.withHref(uriInfo, thesaurus.getFollowers());
    return thesaurus;
  }

  @Inject
  public ThesaurusResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "ThesaurusRepository must not be null");
    this.dao = new ThesaurusRepository(dao);
    this.authorizer = authorizer;
  }

  public static class ThesaurusList extends ResultList<Thesaurus> {
    @SuppressWarnings("unused")
    ThesaurusList() {
      // Empty constructor needed for deserialization
    }

    public ThesaurusList(List<Thesaurus> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,dashboard,definition,followers,tags,usageSummary,skos";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Valid
  @Operation(summary = "List Thesauruses", tags = "thesauruses",
          description = "Get a list of thesauruses. Use `fields` parameter to get only necessary fields. " +
                  " Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of thesauruses",
                               content = @Content(mediaType = "application/json",
                                       schema = @Schema(implementation = ThesaurusList.class)))
          })
  public ResultList<Thesaurus> list(@Context UriInfo uriInfo,
                                      @Context SecurityContext securityContext,
                                      @Parameter(description = "Fields requested in the returned resource",
                                              schema = @Schema(type = "string", example = FIELDS))
                                      @QueryParam("fields") String fieldsParam,
                                      @Parameter(description = "Limit the number thesauruses returned. (1 to 1000000, " +
                                              "default = 10)")
                                      @DefaultValue("10")
                                      @Min(1)
                                      @Max(1000000)
                                      @QueryParam("limit") int limitParam,
                                      @Parameter(description = "Returns list of thesauruses before this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("before") String before,
                                      @Parameter(description = "Returns list of thesauruses after this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Thesaurus> thesauruses;
    if (before != null) { // Reverse paging
      thesauruses = dao.listBefore(uriInfo, fields, null, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      thesauruses = dao.listAfter(uriInfo, fields, null, limitParam, after);
    }
    addHref(uriInfo, thesauruses.getData());
    return thesauruses;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a thesaurus", tags = "thesauruses",
          description = "Get a thesaurus by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thesaurus",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Thesaurus.class))),
                  @ApiResponse(responseCode = "404", description = "Thesaurus for instance {id} is not found")
          })
  public Thesaurus get(@Context UriInfo uriInfo,
                       @Context SecurityContext securityContext,
                       @PathParam("id") String id,
                       @Parameter(description = "Fields requested in the returned resource",
                               schema = @Schema(type = "string", example = FIELDS))
                       @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a thesaurus by name", tags = "thesauruses",
          description = "Get a thesaurus by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thesaurus",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Thesaurus.class))),
                  @ApiResponse(responseCode = "404", description = "Thesaurus for instance {id} is not found")
          })
  public Thesaurus getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Thesaurus thesaurus = dao.getByName(uriInfo, fqn, fields);
    return addHref(uriInfo, thesaurus);
  }


  @POST
  @Operation(summary = "Create a thesaurus", tags = "thesauruses",
          description = "Create a new thesaurus.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thesaurus",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateThesaurus.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateThesaurus create) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Thesaurus thesaurus = getThesaurus(securityContext, create);
    thesaurus = addHref(uriInfo, dao.create(uriInfo, thesaurus));
    return Response.created(thesaurus.getHref()).entity(thesaurus).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a thesaurus", tags = "thesauruses",
          description = "Update an existing thesaurus using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(@Context UriInfo uriInfo,
                                     @Context SecurityContext securityContext,
                                     @PathParam("id") String id,
                                     @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Thesaurus thesaurus = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            dao.getOwnerReference(thesaurus));
    PatchResponse<Thesaurus> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(summary = "Create or update a thesaurus", tags = "thesauruses",
          description = "Create a new thesaurus, if it does not exist or update an existing thesaurus.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The thesaurus",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Thesaurus.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateThesaurus create) throws IOException, ParseException {
    Thesaurus thesaurus = getThesaurus(securityContext, create);
    PutResponse<Thesaurus> response = dao.createOrUpdate(uriInfo, thesaurus);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "thesauruses",
          description = "Add a user identified by `userId` as follower of this thesaurus",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "thesaurus for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the thesaurus", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException, ParseException {
          return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id),
                          UUID.fromString(userId)).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "thesauruses",
          description = "Remove the user identified `userId` as a follower of the thesaurus.")
  public Response deleteFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the thesaurus",
                                      schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user being removed as follower",
                                      schema = @Schema(type = "string"))
                              @PathParam("userId") String userId) throws IOException, ParseException {
          return dao.deleteFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id),
                          UUID.fromString(userId)).toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Thesaurus", tags = "thesauruses",
          description = "Delete a thesaurus by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "thesaurus for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(UUID.fromString(id));
    return Response.ok().build();
  }

  private Thesaurus getThesaurus(SecurityContext securityContext, CreateThesaurus create) {
    return new Thesaurus().withId(UUID.randomUUID()).withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withSkos(create.getSkos())
            .withTags(create.getTags())
            .withOwner(create.getOwner())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());
  }
}
