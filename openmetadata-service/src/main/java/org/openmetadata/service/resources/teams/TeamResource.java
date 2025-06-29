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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.dropwizard.jersey.PATCH;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.TeamRepository.TeamCsv;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/teams")
@Tag(
    name = "Teams",
    description =
        "A `Team` is a group of zero or more users and/or other teams. Teams can own zero or"
            + " more data assets. Hierarchical teams are supported `Organization` -> `BusinessUnit` -> `Division` -> `Department`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "teams",
    order = 2,
    requiredForOps = true) // Load after roles, and policy resources
public class TeamResource extends EntityResource<Team, TeamRepository> {
  public static final String COLLECTION_PATH = "/v1/teams/";
  private final TeamMapper mapper = new TeamMapper();
  static final String FIELDS =
      "owners,profile,users,owns,defaultRoles,parents,children,policies,userCount,childrenCount,domains";

  @Override
  public Team addHref(UriInfo uriInfo, Team team) {
    super.addHref(uriInfo, team);
    Entity.withHref(uriInfo, team.getUsers());
    Entity.withHref(uriInfo, team.getDefaultRoles());
    Entity.withHref(uriInfo, team.getOwns());
    Entity.withHref(uriInfo, team.getParents());
    Entity.withHref(uriInfo, team.getPolicies());
    return team;
  }

  public TeamResource(Authorizer authorizer, Limits limits) {
    super(Entity.TEAM, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation(
        "profile,owns,defaultRoles,parents,children,policies,userCount,childrenCount",
        MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_POLICY, MetadataOperation.EDIT_USERS);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    repository.initOrganization();
  }

  public static class TeamList extends ResultList<Team> {
    /* Required for serde */
  }

  public static class TeamHierarchyList extends ResultList<TeamHierarchy> {
    /* Required for serde */
  }

  @GET
  @Path("/hierarchy")
  @Valid
  @Operation(
      operationId = "listTeamsHierarchy",
      summary = "List teams with hierarchy",
      description = "Get a list of teams with hierarchy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of teams with hierarchy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TeamList.class)))
      })
  public ResultList<TeamHierarchy> listHierarchy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number of teams returned. (1 to 1000000, default = 10)")
          @DefaultValue("10000")
          @Min(value = 1000, message = "must be greater than or equal to 1000")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description =
                  "Filter the results by whether the team can be joined by any user or not",
              schema = @Schema(type = "boolean"))
          @QueryParam("isJoinable")
          Boolean isJoinable) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    return new ResultList<>(repository.listHierarchy(filter, limitParam, isJoinable));
  }

  @GET
  @Valid
  @Operation(
      operationId = "listTeams",
      summary = "List teams",
      description =
          "Get a list of teams. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of teams",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TeamList.class)))
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
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of teams before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of teams after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Filter the results by parent team name",
              schema = @Schema(type = "string"))
          @QueryParam("parentTeam")
          String parentTeam,
      @Parameter(
              description =
                  "Filter the results by whether the team can be joined by any user or not",
              schema = @Schema(type = "boolean"))
          @QueryParam("isJoinable")
          Boolean isJoinable,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("parentTeam", parentTeam);
    if (isJoinable != null) {
      filter.addQueryParam("isJoinable", String.valueOf(isJoinable));
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTeamVersion",
      summary = "List team versions",
      description = "Get a list of all the versions of a team identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of team versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getTeamByID",
      summary = "Get a team by id",
      description = "Get a team by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
      })
  public Team get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getTeamByFQN",
      summary = "Get a team by name",
      description = "Get a team by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "404", description = "Team for instance {name} is not found")
      })
  public Team getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the team", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTeamVersion",
      summary = "Get a version of the team",
      description = "Get a version of the team by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "team",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Team for instance {id} and version {version} is not found")
      })
  public Team getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Team version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createTeam",
      summary = "Create a team",
      description = "Create a new team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct) {
    Team team = mapper.createToEntity(ct, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, team);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateTeam",
      summary = "Update team",
      description = "Create or Update a team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The team ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTeam ct) {
    Team team = mapper.createToEntity(ct, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, team);
  }

  @PUT
  @Path("/{name}/assets/add")
  @Operation(
      operationId = "bulkAddAssets",
      summary = "Bulk Add Assets",
      description = "Bulk Add Assets",
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
  public Response bulkAddAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Team", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.ok().entity(repository.bulkAddAssets(name, request)).build();
  }

  @PUT
  @Path("/{name}/assets/remove")
  @Operation(
      operationId = "bulkRemoveAssets",
      summary = "Bulk Remove Assets",
      description = "Bulk Remove Assets",
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
  public Response bulkRemoveAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Team", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.ok().entity(repository.bulkRemoveAssets(name, request)).build();
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchTeam",
      summary = "Update a team",
      description = "Update an existing team with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchTeam",
      summary = "Update a team using name.",
      description = "Update an existing team with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the team", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteTeam",
      summary = "Delete a team by id",
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
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteTeamAsync",
      summary = "Asynchronously delete a team by id",
      description = "Asynchronously delete a team by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Team for instance {id} is not found")
      })
  public Response deleteByIdAsync(
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
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTeamByName",
      summary = "Delete a team by name",
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
      @Parameter(description = "Name of the team", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted team",
      description = "Restore a soft deleted team.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Team ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Team.class)))
      })
  public Response restoreTeam(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/documentation/csv")
  @Valid
  @Operation(
      operationId = "getCsvDocumentation",
      summary = "Get CSV documentation for team import/export")
  public String getCsvDocumentation(
      @Context SecurityContext securityContext, @PathParam("name") String name) {
    return JsonUtils.pojoToJson(TeamCsv.DOCUMENTATION);
  }

  @GET
  @Path("/name/{name}/exportAsync")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportTeams",
      summary = "Export teams in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with teams information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext, @PathParam("name") String name) throws IOException {
    return exportCsvInternalAsync(securityContext, name, false);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportTeams",
      summary = "Export teams in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with teams information",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(@Context SecurityContext securityContext, @PathParam("name") String name)
      throws IOException {
    return exportCsvInternal(securityContext, name, false);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "importTeams",
      summary = "Import from CSV to create, and update teams.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
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
    return importCsvInternal(securityContext, name, csv, dryRun, false);
  }

  @PUT
  @Path("/{teamId}/users")
  @Operation(
      operationId = "updateTeamUsers",
      summary = "Update team users",
      description =
          "Update the list of users for a team. Replaces existing users with the provided list.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated team users",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Team not found")
      })
  public Response updateTeamUsers(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("teamId") UUID teamId,
      List<EntityReference> users) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_USERS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(teamId));
    return repository
        .updateTeamUsers(securityContext.getUserPrincipal().getName(), teamId, users)
        .toResponse();
  }

  @DELETE
  @Path("/{teamId}/users/{userId}")
  @Operation(
      operationId = "deleteTeamUser",
      summary = "Remove a user from a team",
      description = "Remove the user identified by `userId` from the team identified by `teamId`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "User removed from team",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Team or user not found")
      })
  public Response deleteTeamUser(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the team", schema = @Schema(type = "UUID"))
          @PathParam("teamId")
          UUID teamId,
      @Parameter(description = "Id of the user being removed", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_USERS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(teamId));
    return repository
        .deleteTeamUser(
            securityContext.getUserPrincipal().getName(), teamId, UUID.fromString(userId))
        .toResponse();
  }

  @PUT
  @Path("/name/{name}/importAsync")
  @Consumes(MediaType.TEXT_PLAIN)
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importTeamsAsync",
      summary = "Import from CSV to create, and update teams asynchronously.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public Response importCsvAsync(
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv) {
    return importCsvInternalAsync(securityContext, name, csv, dryRun, false);
  }
}
