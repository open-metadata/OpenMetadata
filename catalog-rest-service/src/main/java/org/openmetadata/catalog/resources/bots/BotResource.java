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

package org.openmetadata.catalog.resources.bots;

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
import org.openmetadata.catalog.api.CreateBot;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.jdbi3.BotRepository;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/bots")
@Api(value = "Bot collection", tags = "Bot collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "bots")
public class BotResource extends EntityResource<Bot, BotRepository> {
  public static final String COLLECTION_PATH = "/v1/bots/";

  public BotResource(CollectionDAO dao, Authorizer authorizer) {
    super(Bot.class, new BotRepository(dao), authorizer);
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

    public BotList(List<Bot> data) {
      super(data);
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
      @PathParam("id") String id)
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
      @Parameter(description = "bot Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
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
      @Parameter(description = "bot Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "bot version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
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
    Bot bot = getBot(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, bot, false);
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
    Bot bot = getBot(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, bot, false);
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
      @Parameter(description = "Id of the bot", schema = @Schema(type = "string")) @PathParam("id") String id,
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
      @Parameter(description = "Id of the Bot", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, true, hardDelete, false);
  }

  private Bot getBot(CreateBot create, String user) {
    return copy(new Bot(), create, user).withBotUser(create.getBotUser());
  }
}
