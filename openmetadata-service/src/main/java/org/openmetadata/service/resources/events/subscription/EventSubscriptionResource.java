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

package org.openmetadata.service.resources.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
import java.util.ArrayList;
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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SubscriptionResourceDescriptor;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.subscription.ActivityFeedAlertCache;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/events/subscription")
@Api(value = "Event Subscription  collection", tags = "Event Subscription Collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "events/subscription") // init after alertAction Resource
public class EventSubscriptionResource extends EntityResource<EventSubscription, EventSubscriptionRepository> {
  public static final String COLLECTION_PATH = "/v1/events/subscription";
  public static final String FIELDS = "owner,filteringRules";
  private final CollectionDAO daoCollection;

  @Override
  public EventSubscription addHref(UriInfo uriInfo, EventSubscription entity) {
    Entity.withHref(uriInfo, entity.getOwner());
    return entity;
  }

  public EventSubscriptionResource(CollectionDAO dao, Authorizer authorizer) {
    super(EventSubscription.class, new EventSubscriptionRepository(dao), authorizer);
    this.daoCollection = dao;
  }

  public static class EventSubscriptionList extends ResultList<EventSubscription> {

    @SuppressWarnings("unused") /* Required for tests */
    public EventSubscriptionList() {}
  }

  public static class EventSubResourceDescriptorList extends ResultList<SubscriptionResourceDescriptor> {
    @SuppressWarnings("unused")
    EventSubResourceDescriptorList() {
      // Empty constructor needed for deserialization
    }

    public EventSubResourceDescriptorList(List<SubscriptionResourceDescriptor> data) {
      super(data, null, null, data.size());
    }
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      dao.initSeedDataFromResources();
      EventsSubscriptionRegistry.initialize(listOrEmpty(EventSubscriptionResource.getDescriptors()));
      ActivityFeedAlertCache.initialize("ActivityFeedAlert", daoCollection);
      initializeEventSubscriptions();
    } catch (Exception ex) {
      // Starting application should not fail
      LOG.warn("Exception during initialization", ex);
    }
  }

  private void initializeEventSubscriptions() {
    try {
      List<String> listAllEventsSubscriptions =
          daoCollection
              .eventSubscriptionDAO()
              .listAllEventsSubscriptions(daoCollection.eventSubscriptionDAO().getTableName());
      List<EventSubscription> eventSubList = JsonUtils.readObjects(listAllEventsSubscriptions, EventSubscription.class);
      eventSubList.forEach(
          (subscription) -> {
            if (subscription.getSubscriptionType() != CreateEventSubscription.SubscriptionType.ACTIVITY_FEED) {
              dao.addSubscriptionPublisher(subscription);
            }
          });
    } catch (Exception ex) {
      // Starting application should not fail
      LOG.warn("Exception during initializeEventSubscriptions", ex);
    }
  }

  @GET
  @Operation(
      operationId = "listEventSubscriptions",
      summary = "List all available Event Subscriptions",
      tags = "eventsSubscription",
      description = "Get a list of All available Event Subscriptions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Event Subscriptions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscriptionResource.EventSubscriptionList.class)))
      })
  public ResultList<EventSubscription> listAlerts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number event subscriptions returned. (1 to 1000000, default = " + "10) ")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of event subscriptions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of event subscriptions after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionByID",
      summary = "Get a event Subscription by ID",
      tags = "eventsSubscription",
      description = "Get a event Subscription by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public EventSubscription getAlertById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID")) @PathParam("id")
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
          Include include)
      throws IOException {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{eventSubscriptionName}")
  @Operation(
      operationId = "getEventSubscriptionByName",
      summary = "Get an Event Subscription by name",
      tags = "eventSubscription",
      description = "Get an Event Subscription by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event Subscription with request name is returned",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription for instance {eventSubscriptionName} is not found")
      })
  public EventSubscription getAlertByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @POST
  @Operation(
      operationId = "createEventSubscription",
      summary = "Create a new Event Subscription",
      tags = "eventSubscription",
      description = "Create a new Event Subscription",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event Subscription Created",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateEventSubscription.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createEventSubscription(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateEventSubscription request)
      throws IOException {
    EventSubscription eventSub = getEventSubscription(request, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, eventSub);
    dao.addSubscriptionPublisher(eventSub);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateEventSubscription",
      summary = "Updated an existing or create a new Event Subscription",
      tags = "eventSubscription",
      description = "Updated an existing or create a new alert",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateEventSubscription.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateEventSubscription(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateEventSubscription create)
      throws IOException {
    EventSubscription eventSub = getEventSubscription(create, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, eventSub);
    dao.updateWebhookPublisher((EventSubscription) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchEventSubscription",
      summary = "Update an Event Subscriptions",
      tags = "alerts",
      description = "Update an existing Event Subscriptions using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchAlert(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the event Subscription", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    dao.updateWebhookPublisher((EventSubscription) response.getEntity());
    return response;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllAlertVersion",
      summary = "List alert versions",
      tags = "alerts",
      description = "Get a list of all the versions of an alert identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of alert versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listAlertVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificAlertVersion",
      summary = "Get a version of the alert",
      tags = "alerts",
      description = "Get a version of the alert by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "alert",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Alert for instance {id} and version {version} is " + "not found")
      })
  public EventSubscription getAlertVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "alert version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "deleteEventSubscription",
      summary = "Delete an Event Subscription by Id",
      tags = "eventSubscription",
      description = "Delete an Event Subscription",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the alert", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException, InterruptedException {
    Response response = delete(uriInfo, securityContext, id, true, true);
    dao.deleteEventSubscriptionPublisher(id);
    return response;
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteEventSubscriptionByName",
      summary = "Delete an Event Subscription by name",
      tags = "eventSubscription",
      description = "Delete an Event Subscription by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Entity for instance {name} is not found")
      })
  public Response deleteEventSubscriptionByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException, InterruptedException {
    Response response = deleteByName(uriInfo, securityContext, name, true, true);
    dao.deleteEventSubscriptionPublisher(((EventSubscription) response.getEntity()).getId());
    return response;
  }

  @GET
  @Path("/name/{eventSubscriptionName}/status")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionStatus",
      summary = "Get Event Subscription status",
      tags = "eventSubscription",
      description = "Get a event Subscription status by given Name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return the current status of the Event Subscription",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = SubscriptionStatus.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public SubscriptionStatus getEventSubscriptionStatusByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name)
      throws IOException {
    EventSubscription sub = dao.getByName(null, name, dao.getFields("name"));
    return dao.getStatusForEventSubscription(sub.getId());
  }

  @GET
  @Path("/{eventSubscriptionId}/status")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionStatusById",
      summary = "Get Event Subscription status by Id",
      tags = "eventSubscription",
      description = "Get a event Subscription status by given Name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return the current status of the Event Subscription",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = SubscriptionStatus.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public SubscriptionStatus getEventSubscriptionStatusById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("eventSubscriptionId")
          UUID id) {
    return dao.getStatusForEventSubscription(id);
  }

  @GET
  @Path("/functions")
  @Operation(
      operationId = "listAlertFunctions",
      summary = "Get list of alert functions used in filtering alert",
      tags = "alerts",
      description = "Get list of alert functions used in filtering conditions in alerts")
  public List<Function> listAlertFunctions(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return new ArrayList<>(AlertUtil.getAlertFilterFunctions().values());
  }

  @GET
  @Path("/resources")
  @Operation(
      operationId = "listEventSubscriptionResources",
      summary = "Get list of Event Subscriptions Resources used in filtering alert",
      tags = "eventSubscription",
      description = "Get list of alert functions used in filtering conditions in alerts")
  public EventSubResourceDescriptorList listEventSubResources(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return new EventSubResourceDescriptorList(EventsSubscriptionRegistry.listResourceDescriptors());
  }

  @GET
  @Path("/validation/condition/{expression}")
  @Operation(
      operationId = "validateCondition",
      summary = "Validate a given condition",
      tags = "alerts",
      description = "Validate a given condition expression used in filtering rules.",
      responses = {
        @ApiResponse(responseCode = "204", description = "No value is returned"),
        @ApiResponse(responseCode = "400", description = "Invalid expression")
      })
  public void validateCondition(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Expression to validate", schema = @Schema(type = "string")) @PathParam("expression")
          String expression) {
    AlertUtil.validateExpression(expression, Boolean.class);
  }

  public EventSubscription getEventSubscription(CreateEventSubscription create, String user) throws IOException {
    return copy(new EventSubscription(), create, user)
        .withEnabled(create.getEnabled())
        .withBatchSize(create.getBatchSize())
        .withTimeout(create.getTimeout())
        .withFilteringRules(create.getFilteringRules())
        .withSubscriptionType(create.getSubscriptionType())
        .withSubscriptionConfig(create.getSubscriptionConfig());
  }

  public static List<SubscriptionResourceDescriptor> getDescriptors() throws IOException {
    List<String> jsonDataFiles = EntityUtil.getJsonDataResources(".*json/data/eventSubResourceDescriptor.json$");
    if (jsonDataFiles.size() != 1) {
      LOG.warn("Invalid number of jsonDataFiles {}. Only one expected.", jsonDataFiles.size());
      return null;
    }
    String jsonDataFile = jsonDataFiles.get(0);
    try {
      String json = CommonUtil.getResourceAsStream(EventSubscriptionResource.class.getClassLoader(), jsonDataFile);
      return JsonUtils.readObjects(json, SubscriptionResourceDescriptor.class);
    } catch (Exception e) {
      LOG.warn("Failed to initialize the events subscription resource descriptors from file {}", jsonDataFile, e);
    }
    return null;
  }
}
