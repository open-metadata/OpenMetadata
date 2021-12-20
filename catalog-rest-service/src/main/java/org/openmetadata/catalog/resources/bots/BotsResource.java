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

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
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
import org.openmetadata.catalog.entity.Bots;
import org.openmetadata.catalog.jdbi3.BotsRepository;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/bots")
@Api(value = "Bots collection", tags = "Bots collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "bots")
public class BotsResource {
  public static final String COLLECTION_PATH = "/v1/bots/";
  private final BotsRepository dao;
  private final CatalogAuthorizer authorizer;

  @Inject
  public BotsResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    this.dao = new BotsRepository(dao);
    this.authorizer = authorizer;
  }

  public static class BotsList extends ResultList<Bots> {
    public BotsList(List<Bots> data) {
      super(data);
    }
  }

  @GET
  @Operation(
      summary = "List bots",
      tags = "bots",
      description = "Get a list of bots.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of bots",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = BotsList.class)))
      })
  public ResultList<Bots> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("name") String name,
      @DefaultValue("10") @Min(1) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of bots before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of bots after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);

    ResultList<Bots> list;
    if (before != null) { // Reverse paging
      list = dao.listBefore(uriInfo, null, name, limitParam, before);
    } else { // Forward paging or first page
      list = dao.listAfter(uriInfo, null, name, limitParam, after);
    }
    return list;
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a bot",
      tags = "bots",
      description = "Get a bot by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bots.class))),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Bots get(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.get(uriInfo, id, Fields.EMPTY_FIELDS);
  }

  @POST
  @Operation(
      summary = "Create a bot",
      tags = "bots",
      description = "Create a new bot.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The bot ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Bots.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, Bots bot)
      throws IOException {
    SecurityUtil.checkAdminRole(authorizer, securityContext);
    bot.withId(UUID.randomUUID()).withUpdatedBy(securityContext.getUserPrincipal().getName()).withUpdatedAt(new Date());
    dao.create(uriInfo, bot);
    return Response.created(bot.getHref()).entity(bot).build();
  }
}
