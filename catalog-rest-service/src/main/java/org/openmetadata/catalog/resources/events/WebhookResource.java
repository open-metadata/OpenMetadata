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
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.api.events.CreateWebhook;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.WebhookDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.WebhookRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/webhook")
@Api(value = "Webhook resource", tags = "webhook")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "webhook")
public class WebhookResource extends EntityResource<Webhook, WebhookRepository> {
  public static final String COLLECTION_PATH = "v1/webhook/";
  private WebhookDAO webhookDAO;

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
    webhookDAO = dao.webhookDAO();
  }

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(CatalogApplicationConfig config) throws IOException {
    try {
      List<String> listAllWebhooks = webhookDAO.listAllWebhooks(webhookDAO.getTableName());
      List<Webhook> webhookList = JsonUtils.readObjects(listAllWebhooks, Webhook.class);
      webhookList.forEach(dao::addWebhookPublisher);
    } catch (Exception ex) {
      // Starting application should not fail
    }
  }

  @GET
  @Operation(
      operationId = "listWebHooks",
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
      @Parameter(description = "Filter webhooks by status", schema = @Schema(type = "string", example = "active"))
          @QueryParam("status")
          String statusParam,
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
      throws IOException {
    ListFilter filter = new ListFilter(Include.ALL).addQueryParam("status", statusParam);
    return listInternal(uriInfo, securityContext, "", filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "getWebHookByID",
      summary = "Get a webhook",
      tags = "webhook",
      description = "Get a webhook by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Webhook.class))),
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
      throws IOException {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getWebHookByFQN",
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
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, "", include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWebHookVersion",
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
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWebhookVersion",
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
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      operationId = "createWebHook",
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
      throws IOException {
    Webhook webhook = getWebhook(create, securityContext.getUserPrincipal().getName());
    webhook.setWebhookType(Webhook.WebhookType.slack);
    Response response = create(uriInfo, securityContext, webhook, false);
    dao.addWebhookPublisher(webhook);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateWebhook",
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
      throws IOException {
    Webhook webhook = getWebhook(create, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, webhook, true);
    dao.updateWebhookPublisher((Webhook) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWebHook",
      summary = "Update a webhook",
      tags = "webhook",
      description = "Update an existing webhook using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
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
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "deleteWebHook",
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
      throws IOException, InterruptedException {
    Response response = delete(uriInfo, securityContext, id, false, true, false);
    dao.deleteWebhookPublisher(UUID.fromString(id));
    return response;
  }

  public Webhook getWebhook(CreateWebhook create, String user) {
    // Add filter for soft delete events if delete event type is requested
    EntityUtil.addSoftDeleteFilter(create.getEventFilters());
    return copy(new Webhook(), create, user)
        .withEndpoint(create.getEndpoint())
        .withEventFilters(create.getEventFilters())
        .withBatchSize(create.getBatchSize())
        .withTimeout(create.getTimeout())
        .withEnabled(create.getEnabled())
        .withSecretKey(create.getSecretKey())
        .withStatus(Boolean.TRUE.equals(create.getEnabled()) ? Status.ACTIVE : Status.DISABLED)
        .withWebhookType(Webhook.WebhookType.fromValue(create.getWebhookType().value()));
  }
}
