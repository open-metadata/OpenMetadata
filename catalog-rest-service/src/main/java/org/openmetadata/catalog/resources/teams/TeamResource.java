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
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
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
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/teams")
@Api(value = "Teams collection", tags = "Teams collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "teams", repositoryClass = "org.openmetadata.catalog.jdbi3.TeamRepository")
public class TeamResource {
  private static final Logger LOG = LoggerFactory.getLogger(TeamResource.class);
  public static final String TEAM_COLLECTION_PATH = "/v1/teams/";
  private final TeamRepository dao;
  private final CatalogAuthorizer authorizer;


  public static void addHref(UriInfo uriInfo, EntityReference team) {
    team.setHref(RestUtil.getHref(uriInfo, TEAM_COLLECTION_PATH, team.getId()));
  }

  public static Team addHref(UriInfo uriInfo, Team team) {
    team.setHref(RestUtil.getHref(uriInfo, TEAM_COLLECTION_PATH, team.getId()));
    EntityUtil.addHref(uriInfo, team.getUsers());
    EntityUtil.addHref(uriInfo, team.getOwns());
    return team;
  }

  @Inject
  public TeamResource(TeamRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "TeamRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  static class TeamList extends ResultList<Team> {
    @SuppressWarnings("unused") /* Required for tests */
    public TeamList() {}

    public TeamList(List<Team> teams, int limitParam, String beforeCursor, String afterCursor)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(teams, limitParam, beforeCursor, afterCursor);
    }
  }

  private static final String FIELDS = "profile,users,owns";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));
  @GET
  @Valid
  @Operation(summary = "List teams", tags = "teams",
          description = "Get a list of teams. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of teams",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = TeamList.class)))
          })
  public TeamList list(@Context UriInfo uriInfo,
                       @Context SecurityContext securityContext,
                       @Parameter(description = "Fields requested in the returned resource",
                               schema = @Schema(type = "string", example = FIELDS))
                       @QueryParam("fields") String fieldsParam,
                       @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10) ",
                               schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
                       @DefaultValue("10")
                       @Min(1)
                       @Max(1000000)
                       @QueryParam("limit") int limitParam,
                       @Parameter(description = "Returns list of tables before this curor",
                               schema = @Schema(type = "string"))
                       @QueryParam("before") String before,
                       @Parameter(description = "Returns list of tables after this curor",
                               schema = @Schema(type = "string"))
                       @QueryParam("after") String after) throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    List<Team> teams;
    String beforeCursor = null, afterCursor = null;

    // For calculating cursors, ask for one extra entry beyond limit. If the extra entry exists, then in forward
    // scrolling afterCursor is not null. Similarly, if the extra entry exists, then in reverse scrolling,
    // beforeCursor is not null. Remove the extra entry before returning results.
    if (before != null) { // Reverse paging
      teams = dao.listBefore(fields, limitParam + 1, before); // Ask for one extra entry
      if (teams.size() > limitParam) {
        teams.remove(0);
        beforeCursor = teams.get(0).getName();
      }
      afterCursor = teams.get(teams.size() - 1).getName();
    } else { // Forward paging or first page
      teams = dao.listAfter(fields, limitParam + 1, after);
      beforeCursor = after == null ? null : teams.get(0).getName();
      if (teams.size() > limitParam) {
        teams.remove(limitParam);
        afterCursor = teams.get(limitParam - 1).getName();
      }
    }
    teams.forEach(team -> addHref(uriInfo, team));
    LOG.info("Returning {} teams", teams.size());
    return new TeamList(teams, limitParam, beforeCursor, afterCursor);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(summary = "Get a team", tags = "teams",
          description = "Get a team by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The team",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Team.class))),
                  @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
          })
  public Team get(@Context UriInfo uriInfo,
                  @Context SecurityContext securityContext,
                  @PathParam("id") String id,
                  @Parameter(description = "Fields requested in the returned resource",
                          schema = @Schema(type = "string", example = FIELDS))
                  @QueryParam("fields") String fieldsParam) throws IOException {
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(summary = "Get a team by name", tags = "teams",
          description = "Get a team by `name`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The team",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Team.class))),
                  @ApiResponse(responseCode = "404", description = "Team for instance {name} is not found")
          })
  public Team getByName(@Context UriInfo uriInfo,
                        @Context SecurityContext securityContext,
                        @PathParam("name") String name,
                        @Parameter(description = "Fields requested in the returned resource",
                          schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam) throws IOException {
    EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(name, fields));
  }

  @POST
  @Operation(summary = "Create a team", tags = "teams",
          description = "Create a new team.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The team",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Team.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateTeam ct) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Team team = new Team().withId(UUID.randomUUID()).withName(ct.getName()).withDescription(ct.getDescription())
            .withDisplayName(ct.getDisplayName()).withProfile(ct.getProfile());
    addHref(uriInfo, dao.create(team, ct.getUsers()));
    return Response.created(team.getHref()).entity(team).build();
  }

  @PATCH
  @Valid
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(summary = "Update a team", tags = "teams",
          description = "Update an existing team with JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  public Team patch(@Context UriInfo uriInfo,
                    @Context SecurityContext securityContext,
                    @PathParam("id") String id,
                    @RequestBody(description = "JsonPatch with array of operations",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                    examples = {@ExampleObject("[" +
                                        "{op:remove, path:/a}," +
                                        "{op:add, path: /b, value: val}" +
                                        "]")}))
                    JsonPatch patch) throws IOException {

    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    return addHref(uriInfo, dao.patch(id, patch));
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a team", tags = "teams",
          description = "Delete a team by given `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @PathParam("id") String id) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(id);
    return Response.ok().build();
  }
}