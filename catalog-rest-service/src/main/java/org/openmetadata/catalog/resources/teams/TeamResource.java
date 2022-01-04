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

package org.openmetadata.catalog.resources.teams;

import com.google.inject.Inject;
import io.dropwizard.jersey.PATCH;
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
import java.util.Date;
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
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/teams")
@Api(value = "Teams collection", tags = "Teams collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "teams")
public class TeamResource {
  public static final String COLLECTION_PATH = "/v1/teams/";
  private final TeamRepository dao;
  private final Authorizer authorizer;

  public static Team addHref(UriInfo uriInfo, Team team) {
    Entity.withHref(uriInfo, team.getUsers());
    Entity.withHref(uriInfo, team.getOwns());
    return team;
  }

  @Inject
  public TeamResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "TeamRepository must not be null");
    this.dao = new TeamRepository(dao);
    this.authorizer = authorizer;
  }

  public static class TeamList extends ResultList<Team> {
    @SuppressWarnings("unused") /* Required for tests */
    TeamList() {}

    public TeamList(List<Team> teams, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(teams, beforeCursor, afterCursor, total);
    }
  }

  protected static final String FIELDS = "profile,users,owns";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "").split(","));

  @GET
  @Valid
  @Operation(
      summary = "List teams",
      tags = "teams",
      description =
          "Get a list of teams. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of teams",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TeamList.class)))
      })
  public ResultList<Team> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of tables before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of tables after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);

    ResultList<Team> teams;
    if (before != null) { // Reverse paging
      teams = dao.listBefore(uriInfo, fields, null, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      teams = dao.listAfter(uriInfo, fields, null, limitParam, after);
    }
    teams.getData().forEach(team -> addHref(uriInfo, team));
    return teams;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List team versions",
      tags = "teams",
      description = "Get a list of all the versions of a team identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of team versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "team Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      summary = "Get a team",
      tags = "teams",
      description = "Get a team by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
      })
  public Team get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException, ParseException {
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
      summary = "Get a team by name",
      tags = "teams",
      description = "Get a team by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "404", description = "Team for instance {name} is not found")
      })
  public Team getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException, ParseException {
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, name, fields));
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the team",
      tags = "teams",
      description = "Get a version of the team by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "team",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Team for instance {id} and version {version} is " + "not found")
      })
  public Team getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Team Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Team version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a team",
      tags = "teams",
      description = "Create a new team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTeam.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct)
      throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Team team = getTeam(ct, securityContext);
    addHref(uriInfo, dao.create(uriInfo, team));
    return Response.created(team.getHref()).entity(team).build();
  }

  @PUT
  @Operation(
      summary = "Create or Update a team",
      tags = "teams",
      description = "Create or Update a team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTeam.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateTeam(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Team team = getTeam(ct, securityContext);
    RestUtil.PutResponse<Team> response = dao.createOrUpdate(uriInfo, team);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      summary = "Update a team",
      tags = "teams",
      description = "Update an existing team with JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
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
      throws IOException, ParseException {

    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    PatchResponse<Team> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a team",
      tags = "teams",
      description = "Delete a team by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
      })
  public Response delete(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id), false);
    return Response.ok().build();
  }

  private Team getTeam(CreateTeam ct, SecurityContext securityContext) {
    return new Team()
        .withId(UUID.randomUUID())
        .withName(ct.getName())
        .withDescription(ct.getDescription())
        .withDisplayName(ct.getDisplayName())
        .withProfile(ct.getProfile())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(new Date())
        .withUsers(dao.getUsers(ct.getUsers()));
  }
}
