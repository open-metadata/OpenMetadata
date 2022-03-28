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

package org.openmetadata.catalog.resources.events;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.catalog.api.events.CreateWebhook;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.WebhookRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/webhook")
@Api(value = "Webhook resource", tags = "webhook")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "webhook")
public class WebhookResource extends EntityResource<Webhook, WebhookRepository> {
  public static final String COLLECTION_PATH = "v1/webhook/";

  @Override
  public Webhook addHref(UriInfo uriInfo, Webhook entity) {
    return entity;
  }

  public static class WebhookList extends ResultList<Webhook> {

    @SuppressWarnings("unused") /* Required for tests */
    public WebhookList() {}

    public WebhookList(List<Webhook> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public WebhookResource(CollectionDAO dao, Authorizer authorizer) {
    super(Webhook.class, new WebhookRepository(dao), authorizer);
  }

  @GET
  @Operation(
      summary = "List webhooks",
      tags = "webhook",
      description = "Get a list of webhook subscriptions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of webhooks",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = WebhookList.class)))
      })
  public ResultList<Webhook> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number webhooks returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of webhooks before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of webhooks after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, ParseException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    ListFilter filter = new ListFilter(include);
    ResultList<Webhook> webhooks;
    if (before != null) { // Reverse paging
      webhooks = dao.listBefore(uriInfo, Fields.EMPTY_FIELDS, filter, limitParam, before);
    } else { // Forward paging or first page
      webhooks = dao.listAfter(uriInfo, Fields.EMPTY_FIELDS, filter, limitParam, after);
    }
    webhooks.getData().forEach(t -> dao.withHref(uriInfo, t));
    return webhooks;
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      summary = "Get a webhook",
      tags = "webhook",
      description = "Get a webhook by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Webhook get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "webhook Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, ParseException {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      summary = "Get a webhook by name",
      tags = "webhook",
      description = "Get a webhook by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "webhook",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
        @ApiResponse(responseCode = "404", description = "Webhook for instance {id} is not found")
      })
  public Webhook getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the webhook", schema = @Schema(type = "string")) @PathParam("name") String name,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException, ParseException {
    return getByNameInternal(uriInfo, securityContext, name, "", include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List webhook versions",
      tags = "webhook",
      description = "Get a list of all the versions of a webhook identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of webhook versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "webhook Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the webhook",
      tags = "webhook",
      description = "Get a version of the webhook by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "webhook",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Webhook for instance {id} and version {version} is " + "not found")
      })
  public Webhook getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "webhook Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "webhook version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Subscribe to a new webhook",
      tags = "webhook",
      description = "Subscribe to a new webhook",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "webhook",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createWebhook(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWebhook create)
      throws IOException, ParseException {
    Webhook webhook = getWebhook(securityContext, create);
    Response response = create(uriInfo, securityContext, webhook, ADMIN);
    dao.addWebhookPublisher(webhook);
    return response;
  }

  @PUT
  @Operation(
      summary = "Updated an existing or create a new webhook",
      tags = "webhook",
      description = "Updated an existing or create a new webhook",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "webhook",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response updateWebhook(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWebhook create)
      throws IOException, ParseException, InterruptedException {
    Webhook webhook = getWebhook(securityContext, create);
    Response response = createOrUpdate(uriInfo, securityContext, webhook, ADMIN | BOT);
    dao.updateWebhookPublisher((Webhook) response.getEntity());
    return response;
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      summary = "Delete a webhook",
      tags = "webhook",
      description = "Get a webhook by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteWebhook(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "webhook Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException, InterruptedException {
    Response response = delete(uriInfo, securityContext, id, false, ADMIN);
    dao.deleteWebhookPublisher(UUID.fromString(id));
    return response;
  }

  public Webhook getWebhook(SecurityContext securityContext, CreateWebhook create) {
    // Add filter for soft delete events if delete event type is requested
    EntityUtil.addSoftDeleteFilter(create.getEventFilters());
    return new Webhook()
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withId(UUID.randomUUID())
        .withEndpoint(create.getEndpoint())
        .withEventFilters(create.getEventFilters())
        .withBatchSize(create.getBatchSize())
        .withTimeout(create.getTimeout())
        .withEnabled(create.getEnabled())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis())
        .withSecretKey(create.getSecretKey())
        .withStatus(Boolean.TRUE.equals(create.getEnabled()) ? Status.ACTIVE : Status.DISABLED);
  }
}
