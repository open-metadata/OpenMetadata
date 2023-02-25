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

package org.openmetadata.service.resources.teams;

import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_ORGANIZATION;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.TeamRepository.TeamCsv;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/teams")
@Api(value = "Teams collection", tags = "Teams collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "teams", order = 2) // Load after roles, and policy resources
public class TeamResource extends EntityResource<Team, TeamRepository> {
  public static final String COLLECTION_PATH = "/v1/teams/";

  @Override
  public Team addHref(UriInfo uriInfo, Team team) {
    Entity.withHref(uriInfo, team.getOwner());
    Entity.withHref(uriInfo, team.getUsers());
    Entity.withHref(uriInfo, team.getDefaultRoles());
    Entity.withHref(uriInfo, team.getOwns());
    Entity.withHref(uriInfo, team.getParents());
    Entity.withHref(uriInfo, team.getChildren());
    Entity.withHref(uriInfo, team.getPolicies());
    return team;
  }

  public TeamResource(CollectionDAO dao, Authorizer authorizer) {
    super(Team.class, new TeamRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    dao.initOrganization();
  }

  public static class TeamList extends ResultList<Team> {
    @SuppressWarnings("unused") /* Required for tests */
    TeamList() {}
  }

  public static class TeamHierarchyList extends ResultList<TeamHierarchy> {
    @SuppressWarnings("unused") /* Required for tests */
    TeamHierarchyList() {}
  }

  static final String FIELDS =
      "owner,profile,users,owns,defaultRoles,parents,children,policies,userCount,childrenCount";

  @GET
  @Path("/hierarchy")
  @Valid
  @Operation(
      operationId = "listTeamsHierarchy",
      summary = "List teams with hierarchy",
      tags = "teams",
      description = "Get a list of teams with hierarchy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of teams with hierarchy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TeamList.class)))
      })
  public ResultList<TeamHierarchy> listHierarchy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number of teams returned. (1 to 1000000, default = 10)")
          @DefaultValue("10000")
          @Min(1000)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Filter the results by whether the team can be joined by any user or not",
              schema = @Schema(type = "boolean"))
          @QueryParam("isJoinable")
          Boolean isJoinable)
      throws IOException {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    return new ResultList<>(dao.listHierarchy(filter, limitParam, isJoinable));
  }

  @GET
  @Valid
  @Operation(
      operationId = "listTeams",
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
      @Parameter(description = "Limit the number of teams returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of teams before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of teams after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(description = "Filter the results by parent team name", schema = @Schema(type = "string"))
          @QueryParam("parentTeam")
          String parentTeam,
      @Parameter(
              description = "Filter the results by whether the team can be joined by any user or not",
              schema = @Schema(type = "boolean"))
          @QueryParam("isJoinable")
          Boolean isJoinable,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("parentTeam", parentTeam);
    if (isJoinable != null) {
      filter.addQueryParam("isJoinable", String.valueOf(isJoinable));
    }
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTeamVersion",
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
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getTeamByID",
      summary = "Get a team by id",
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
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getTeamByFQN",
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
      @Parameter(description = "Name of the team", schema = @Schema(type = "string")) @PathParam("name") String name,
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
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificRoleVersion",
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
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Team version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTeam",
      summary = "Create a team",
      tags = "teams",
      description = "Create a new team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct)
      throws IOException {
    Team team = getTeam(ct, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, team);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTeam",
      summary = "Update team",
      tags = "teams",
      description = "Create or Update a team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct) throws IOException {
    Team team = getTeam(ct, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, team);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchTeam",
      summary = "Update a team",
      tags = "teams",
      description = "Update an existing team with JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTeam",
      summary = "Delete a team by id",
      tags = "teams",
      description = "Delete a team by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this team and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTeamByName",
      summary = "Delete a team by name",
      tags = "teams",
      description = "Delete a team by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Team for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the team", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted team",
      tags = "teams",
      description = "Restore a soft deleted team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Team ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Team.class)))
      })
  public Response restoreTeam(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/documentation/csv")
  @Valid
  @Operation(
      operationId = "getCsvDocumentation",
      summary = "Get CSV documentation for team import/export",
      tags = "teams")
  public String getCsvDocumentation(@Context SecurityContext securityContext, @PathParam("name") String name)
      throws IOException {
    return JsonUtils.pojoToJson(TeamCsv.DOCUMENTATION);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportTeams",
      summary = "Export teams in CSV format",
      tags = "teams",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with teams information",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(@Context SecurityContext securityContext, @PathParam("name") String name) throws IOException {
    return exportCsvInternal(securityContext, name);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "importTeams",
      summary = "Import from CSV to create, and update teams.",
      tags = "teams",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, name, csv, dryRun);
  }

  private Team getTeam(CreateTeam ct, String user) throws IOException {
    if (ct.getTeamType().equals(TeamType.ORGANIZATION)) {
      throw new IllegalArgumentException(CREATE_ORGANIZATION);
    }
    if (ct.getTeamType().equals(TeamType.GROUP) && ct.getChildren() != null) {
      throw new IllegalArgumentException(CREATE_GROUP);
    }
    return copy(new Team(), ct, user)
        .withProfile(ct.getProfile())
        .withIsJoinable(ct.getIsJoinable())
        .withUsers(EntityUtil.toEntityReferences(ct.getUsers(), Entity.USER))
        .withDefaultRoles(EntityUtil.toEntityReferences(ct.getDefaultRoles(), Entity.ROLE))
        .withTeamType(ct.getTeamType())
        .withParents(EntityUtil.toEntityReferences(ct.getParents(), Entity.TEAM))
        .withChildren(EntityUtil.toEntityReferences(ct.getChildren(), Entity.TEAM))
        .withPolicies(EntityUtil.toEntityReferences(ct.getPolicies(), Entity.POLICY));
  }
}
