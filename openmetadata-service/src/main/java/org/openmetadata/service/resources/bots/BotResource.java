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

package org.openmetadata.service.resources.bots;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
import jakarta.ws.rs.PATCH;
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
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.UserUtil;

@Slf4j
@Path("/v1/bots")
@Tag(
    name = "Bots",
    description =
        "A `Bot` automates tasks, such as ingesting metadata, and running data quality "
            + "It performs this task as a special user in the system.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "bots", order = 4, requiredForOps = true) // initialize after user resource
public class BotResource extends EntityResource<Bot, BotRepository> {
  public static final String COLLECTION_PATH = "/v1/bots/";
  private final BotMapper mapper = new BotMapper();

  public BotResource(Authorizer authorizer, Limits limits) {
    super(Entity.BOT, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    String domain = SecurityUtil.getDomain(config);
    // First, load the bot users and assign their roles
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    List<User> botUsers = userRepository.getEntitiesFromSeedData(".*json/data/botUser/.*\\.json$");
    for (User botUser : botUsers) {
      User user =
          UserUtil.user(botUser.getName(), domain, botUser.getName())
              .withIsBot(true)
              .withIsAdmin(false);
      user.setRoles(
          listOrEmpty(botUser.getRoles()).stream()
              .map(
                  entityReference -> {
                    Role role =
                        Entity.getEntityByName(
                            Entity.ROLE,
                            entityReference.getName(),
                            "id",
                            Include.NON_DELETED,
                            true);
                    return role.getEntityReference();
                  })
              .toList());
      // Add or update User Bot
      UserUtil.addOrUpdateBotUser(user);
    }

    // Then, load the bots and bind them to the users
    List<Bot> bots = repository.getEntitiesFromSeedData();
    for (Bot bot : bots) {
      String userName = bot.getBotUser().getName();
      bot.withBotUser(
          userRepository
              .getByName(null, userName, userRepository.getFields("id"))
              .getEntityReference());
      repository.initializeEntity(bot);
    }
  }

  @Override
  public Bot addHref(UriInfo uriInfo, Bot entity) {
    super.addHref(uriInfo, entity);
    Entity.withHref(uriInfo, entity.getBotUser());
    return entity;
  }

  public static class BotList extends ResultList<Bot> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listBots",
      summary = "List bots",
      description = "Get a list of Bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Bot",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BotList.class)))
      })
  public ResultList<Bot> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of Bot before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of Bot after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return listInternal(
        uriInfo, securityContext, "", new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getBotByID",
      summary = "Get a bot by Id",
      description = "Get a bot by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Bot get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("include") @DefaultValue("non-deleted") Include include,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getBotByFQN",
      summary = "Get a bot by name",
      description = "Get a bot by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "bot",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "404", description = "Bot for instance {name} is not found")
      })
  public Bot getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the bot", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(
        uriInfo, securityContext, EntityInterfaceUtil.quoteName(name), "", include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllBotVersion",
      summary = "List bot versions",
      description = "Get a list of all the versions of a bot identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of bot versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "listSpecificBotVersion",
      summary = "Get a version of the bot",
      description = "Get a version of the bot by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "bot",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Bot for instance {id} and version {version} is not found")
      })
  public Bot getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "bot version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createBot",
      summary = "Create a bot",
      description = "Create a new bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateBot create) {
    Bot bot = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, bot);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateBot",
      summary = "Create or update a bot",
      description = "Create a bot, if it does not exist. If a bot already exists, update the bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateBot create) {
    Bot bot = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, bot);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchBot",
      summary = "Update a bot",
      description = "Update an existing bot using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Operation(
      operationId = "patchBot",
      summary = "Update a bot by name.",
      description = "Update an existing bot using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the bot", schema = @Schema(type = "string"))
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
      operationId = "deleteBot",
      summary = "Delete a bot by Id",
      description = "Delete a bot by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, true, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteBotAsync",
      summary = "Asynchronously delete a bot by Id",
      description = "Asynchronously delete a bot by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, true, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteBotByFQN",
      summary = "Delete a bot by name",
      description = "Delete a bot by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the bot", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(
        uriInfo, securityContext, EntityInterfaceUtil.quoteName(name), true, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted bot",
      description = "Restore a soft deleted bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Bot ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Bot.class)))
      })
  public Response restoreBot(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
