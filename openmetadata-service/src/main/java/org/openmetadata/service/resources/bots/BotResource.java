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

import static org.openmetadata.service.util.UserUtil.getRoleForBot;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.UserUtil;

@Slf4j
@Path("/v1/bots")
@Api(value = "Bot collection", tags = "Bot collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "bots", order = 4) // initialize after user resource
public class BotResource extends EntityResource<Bot, BotRepository> {
  public static final String COLLECTION_PATH = "/v1/bots/";

  public BotResource(CollectionDAO dao, Authorizer authorizer) {
    super(Bot.class, new BotRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Load system bots
    List<Bot> bots = dao.getEntitiesFromSeedData();
    String domain = SecurityUtil.getDomain(config);
    for (Bot bot : bots) {
      String userName = bot.getBotUser().getName();
      User user = UserUtil.user(userName, domain, userName).withIsBot(true).withIsAdmin(false);

      // Add role corresponding to the bot to the user
      // we need to set a mutable list here
      user.setRoles(getRoleForBot(bot.getName()));
      user = UserUtil.addOrUpdateBotUser(user, config);
      bot.withBotUser(user.getEntityReference());
      dao.initializeEntity(bot);
    }
  }

  @Override
  protected void upgrade() throws IOException {
    // This should be deleted once 0.13 is deprecated
    // For all the existing bots, add ingestion bot role
    ResultList<Bot> bots = dao.listAfter(null, Fields.EMPTY_FIELDS, new ListFilter(Include.NON_DELETED), 1000, null);
    EntityReference ingestionBotRole = RoleResource.getRole(Entity.INGESTION_BOT_ROLE);
    for (Bot bot : bots.getData()) {
      User botUser = Entity.getEntity(bot.getBotUser(), "roles", Include.NON_DELETED);
      if (botUser.getRoles() == null) {
        botUser.setRoles(List.of(ingestionBotRole));
        dao.addRelationship(botUser.getId(), ingestionBotRole.getId(), Entity.USER, Entity.ROLE, Relationship.HAS);
      }
    }
  }

  @Override
  public Bot addHref(UriInfo uriInfo, Bot entity) {
    Entity.withHref(uriInfo, entity.getBotUser());
    return entity;
  }

  public static class BotList extends ResultList<Bot> {
    @SuppressWarnings("unused")
    public BotList() {
      /* Required for serde */
    }
  }

  @GET
  @Operation(
      operationId = "listBots",
      summary = "List Bot",
      tags = "bots",
      description = "Get a list of Bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = BotList.class)))
      })
  public ResultList<Bot> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of Bot before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of Bot after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return listInternal(uriInfo, securityContext, "", new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getBotByID",
      summary = "Get a bot",
      tags = "bots",
      description = "Get a bot by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Bot get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("include") @DefaultValue("non-deleted") Include include,
      @PathParam("id") UUID id)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getBotByFQN",
      summary = "Get a bot by name",
      tags = "bots",
      description = "Get a bot by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "404", description = "Bot for instance {name} is not found")
      })
  public Bot getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the table", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, "", include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllBotVersion",
      summary = "List bot versions",
      tags = "bots",
      description = "Get a list of all the versions of a bot identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of bot versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "bot Id", schema = @Schema(type = "uuid")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "listSpecificBotVersion",
      summary = "Get a version of the bot",
      tags = "bots",
      description = "Get a version of the bot by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Bot for instance {id} and version {version} is " + "not found")
      })
  public Bot getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "bot Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "bot version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createBot",
      summary = "Create a bot",
      tags = "bots",
      description = "Create a new bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateBot create)
      throws IOException {
    Bot bot = getBot(securityContext, create);
    return create(uriInfo, securityContext, bot);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateBot",
      summary = "Create or update a bot",
      tags = "bots",
      description = "Create a bot, if it does not exist. If a bot already exists, update the bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateBot create) throws IOException {
    Bot bot = getBot(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, bot);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchBot",
      summary = "Update a bot",
      tags = "bots",
      description = "Update an existing bot using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the bot", schema = @Schema(type = "string")) @PathParam("id") UUID id,
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
      operationId = "deleteBot",
      summary = "Delete a bot",
      tags = "bots",
      description = "Delete a bot by `id`.",
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
      @Parameter(description = "Id of the Bot", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, true, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted bot.",
      tags = "bots",
      description = "Restore a soft deleted bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Bot ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bot.class)))
      })
  public Response restoreBot(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Bot getBot(CreateBot create, String user) throws IOException {
    return copy(new Bot(), create, user)
        .withBotUser(create.getBotUser())
        .withProvider(create.getProvider())
        .withFullyQualifiedName(create.getName());
  }

  private boolean userHasRelationshipWithAnyBot(User user, Bot botUser) {
    if (user == null) {
      return false;
    }
    List<CollectionDAO.EntityRelationshipRecord> userBotRelationship = retrieveBotRelationshipsFor(user);
    return !userBotRelationship.isEmpty()
        && (botUser == null
            || userBotRelationship.stream().anyMatch(relationship -> !relationship.getId().equals(botUser.getId())));
  }

  private List<CollectionDAO.EntityRelationshipRecord> retrieveBotRelationshipsFor(User user) {
    return dao.findFrom(user.getId(), Entity.USER, Relationship.CONTAINS, Entity.BOT);
  }

  private Bot getBot(SecurityContext securityContext, CreateBot create) throws IOException {
    Bot bot = getBot(create, securityContext.getUserPrincipal().getName());
    Bot originalBot = retrieveBot(bot.getName());
    User botUser = retrieveUser(bot);
    if (botUser != null && !Boolean.TRUE.equals(botUser.getIsBot())) {
      throw new IllegalArgumentException(String.format("User [%s] is not a bot user", botUser.getName()));
    }
    if (userHasRelationshipWithAnyBot(botUser, originalBot)) {
      List<CollectionDAO.EntityRelationshipRecord> userBotRelationship = retrieveBotRelationshipsFor(botUser);
      bot =
          dao.get(null, userBotRelationship.stream().findFirst().orElseThrow().getId(), EntityUtil.Fields.EMPTY_FIELDS);
      throw new IllegalArgumentException(CatalogExceptionMessage.userAlreadyBot(botUser.getName(), bot.getName()));
    }
    // TODO: review this flow on https://github.com/open-metadata/OpenMetadata/issues/8321
    if (originalBot != null) {
      bot.setProvider(originalBot.getProvider());
    }
    return bot;
  }

  private User retrieveUser(Bot bot) {
    try {
      return UserRepository.class
          .cast(Entity.getEntityRepository(Entity.USER))
          .get(null, bot.getBotUser().getId(), EntityUtil.Fields.EMPTY_FIELDS);
    } catch (Exception exception) {
      return null;
    }
  }

  private Bot retrieveBot(String botName) {
    try {
      return dao.getByName(null, botName, EntityUtil.Fields.EMPTY_FIELDS);
    } catch (Exception e) {
      return null;
    }
  }
}
