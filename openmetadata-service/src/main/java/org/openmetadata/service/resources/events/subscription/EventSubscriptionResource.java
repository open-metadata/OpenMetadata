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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.api.events.CreateEventSubscription.AlertType.NOTIFICATION;

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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.EventSubscriptionDestinationTestRequest;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.NotificationResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.bundles.changeEvent.AlertFactory;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.quartz.SchedulerException;

@Slf4j
@Path("/v1/events/subscriptions")
@Tag(
    name = "Events",
    description =
        "The `Events` are changes to metadata and are sent when entities are created, modified, or updated. External systems can subscribe to events using event subscription API over Webhooks, Slack, or Microsoft Teams.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "events/subscriptions", order = 7) // needs to initialize before applications
public class EventSubscriptionResource
    extends EntityResource<EventSubscription, EventSubscriptionRepository> {
  public static final String COLLECTION_PATH = "/v1/events/subscriptions";
  public static final String FIELDS = "owners,filteringRules";
  private final EventSubscriptionMapper mapper = new EventSubscriptionMapper();

  public EventSubscriptionResource(Authorizer authorizer, Limits limits) {
    super(Entity.EVENT_SUBSCRIPTION, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    this.allowedFields.add("statusDetails");
    addViewOperation("filteringRules", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class EventSubscriptionList extends ResultList<EventSubscription> {
    /* Required for serde */
  }

  public static class EventSubResourceDescriptorList
      extends ResultList<NotificationResourceDescriptor> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      EventSubscriptionScheduler.initialize(config);
      EventsSubscriptionRegistry.initialize(
          listOrEmpty(EventSubscriptionResource.getNotificationsFilterDescriptors()),
          listOrEmpty(EventSubscriptionResource.getObservabilityFilterDescriptors()));
      repository.initSeedDataFromResources();
      initializeEventSubscriptions();
    } catch (Exception ex) {
      // Starting application should not fail
      LOG.warn("Exception during initialization", ex);
    }
  }

  private void initializeEventSubscriptions() {
    CollectionDAO daoCollection = repository.getDaoCollection();
    daoCollection.eventSubscriptionDAO().listAllEventsSubscriptions().stream()
        .map(obj -> JsonUtils.readValue(obj, EventSubscription.class))
        .forEach(
            subscription -> {
              try {
                EventSubscriptionScheduler.getInstance()
                    .addSubscriptionPublisher(subscription, true);
              } catch (Exception ex) {
                LOG.error("Failed to initialize subscription: {}", subscription.getId(), ex);
              }
            });
  }

  @GET
  @Operation(
      operationId = "listEventSubscriptions",
      summary = "List all available Event Subscriptions",
      description = "Get a list of All available Event Subscriptions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Event Subscriptions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                EventSubscriptionResource.EventSubscriptionList.class)))
      })
  public ResultList<EventSubscription> listEventSubscriptions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number event subscriptions returned. (1 to 1000000, default = 10) ")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "alertType filter. Notification / Observability")
          @QueryParam("alertType")
          String alertType,
      @Parameter(
              description = "Returns list of event subscriptions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of event subscriptions after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    ListFilter filter = new ListFilter(null);
    if (!nullOrEmpty(alertType)) {
      filter.addQueryParam("alertType", alertType);
    }
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionByID",
      summary = "Get a event Subscription by ID",
      description = "Get a event Subscription by given Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public EventSubscription getEventsSubscriptionById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, null);
  }

  @GET
  @Path("/name/{eventSubscriptionName}")
  @Operation(
      operationId = "getEventSubscriptionByName",
      summary = "Get an Event Subscription by name",
      description = "Get an Event Subscription by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event Subscription with request name is returned",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription for instance {eventSubscriptionName} is not found")
      })
  public EventSubscription getEventsSubscriptionByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, null);
  }

  @POST
  @Operation(
      operationId = "createEventSubscription",
      summary = "Create a new Event Subscription",
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
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateEventSubscription request)
      throws SchedulerException,
          ClassNotFoundException,
          InvocationTargetException,
          NoSuchMethodException,
          InstantiationException,
          IllegalAccessException {
    EventSubscription eventSub =
        mapper.createToEntity(request, securityContext.getUserPrincipal().getName());
    // Only one Creation is allowed
    Response response = create(uriInfo, securityContext, eventSub);
    EventSubscriptionScheduler.getInstance().addSubscriptionPublisher(eventSub, false);
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateEventSubscription",
      summary = "Updated an existing or create a new Event Subscription",
      description = "Updated an existing or create a new Event Subscription",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "create Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateEventSubscription.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateEventSubscription create) {
    EventSubscription eventSub =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, eventSub);
    EventSubscriptionScheduler.getInstance()
        .updateEventSubscription((EventSubscription) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchEventSubscription",
      summary = "Update an Event Subscriptions",
      description = "Update an existing Event Subscriptions using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
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
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    EventSubscriptionScheduler.getInstance()
        .updateEventSubscription((EventSubscription) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchEventSubscription",
      summary = "Update an Event Subscriptions by name.",
      description = "Update an existing Event Subscriptions using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the event Subscription", schema = @Schema(type = "string"))
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
    Response response = patchInternal(uriInfo, securityContext, fqn, patch);
    EventSubscriptionScheduler.getInstance()
        .updateEventSubscription((EventSubscription) response.getEntity());
    return response;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllEventSubscriptionVersion",
      summary = "List Event Subscription versions",
      description = "Get a list of all the versions of an Event Subscription identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Event Subscription versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listEventSubscriptionVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificEventSubscriptionVersion",
      summary = "Get a version of the Event Subscription",
      description = "Get a version of the Event Subscription by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get specific version of Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription for instance {id} and version {version} is not found")
      })
  public EventSubscription getEventSubscriptionVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Event Subscription version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Valid
  @Operation(
      operationId = "deleteEventSubscription",
      summary = "Delete an Event Subscription by Id",
      description = "Delete an Event Subscription",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id)
      throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    EventSubscription eventSubscription = repository.get(null, id, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance().deleteSuccessfulAndFailedEventsRecordByAlert(id);
    return delete(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Valid
  @Operation(
      operationId = "deleteEventSubscriptionAsync",
      summary = "Asynchronously delete an Event Subscription by Id",
      description = "Asynchronously delete an Event Subscription",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscription.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public Response deleteEventSubscriptionAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id)
      throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    EventSubscription eventSubscription = repository.get(null, id, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance().deleteSuccessfulAndFailedEventsRecordByAlert(id);
    return deleteByIdAsync(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteEventSubscriptionByName",
      summary = "Delete an Event Subscription by name",
      description = "Delete an Event Subscription by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Entity for instance {name} is not found")
      })
  public Response deleteEventSubscriptionByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("name")
          String name)
      throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription eventSubscription =
        repository.getByName(null, name, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance()
        .deleteSuccessfulAndFailedEventsRecordByAlert(eventSubscription.getId());
    return deleteByName(uriInfo, securityContext, name, true, true);
  }

  @GET
  @Path("/name/{eventSubscriptionName}/status/{destinationId}")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionStatus",
      summary = "Get Event Subscription status",
      description = "Get a event Subscription status by given Name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return the current status of the Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SubscriptionStatus.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public SubscriptionStatus getEventSubscriptionStatusByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name,
      @Parameter(description = "Destination Id", schema = @Schema(type = "UUID"))
          @PathParam("destinationId")
          UUID destinationId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription sub = repository.getByName(null, name, repository.getFields("name"));
    return EventSubscriptionScheduler.getInstance()
        .getStatusForEventSubscription(sub.getId(), destinationId);
  }

  @GET
  @Path("/{eventSubscriptionId}/status/{destinationId}")
  @Valid
  @Operation(
      operationId = "getEventSubscriptionStatusById",
      summary = "Get Event Subscription status by Id",
      description = "Get a event Subscription status by given Name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Return the current status of the Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SubscriptionStatus.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public SubscriptionStatus getEventSubscriptionStatusById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("eventSubscriptionId")
          UUID id,
      @Parameter(description = "Destination Id", schema = @Schema(type = "UUID"))
          @PathParam("destinationId")
          UUID destinationId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    return EventSubscriptionScheduler.getInstance()
        .getStatusForEventSubscription(id, destinationId);
  }

  @GET
  @Path("/{alertType}/resources")
  @Operation(
      operationId = "listEventSubscriptionResources",
      summary = "Get list of Event Subscriptions Resources used in filtering Event Subscription",
      description =
          "Get list of EventSubscription functions used in filtering conditions in Event Subscription")
  public ResultList<FilterResourceDescriptor> listEventSubResources(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "AlertType", schema = @Schema(type = "string"))
          @PathParam("alertType")
          CreateEventSubscription.AlertType alertType) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    if (alertType.equals(NOTIFICATION)) {
      return new ResultList<>(EventsSubscriptionRegistry.listEntityNotificationDescriptors());
    } else {
      return new ResultList<>(EventsSubscriptionRegistry.listObservabilityDescriptors());
    }
  }

  @GET
  @Path("/{id}/processedEvents")
  @Operation(
      operationId = "checkIfThePublisherProcessedALlEvents",
      summary = "Check If the Publisher Processed All Events",
      description =
          "Return a boolean 'true' or 'false' to indicate if the publisher processed all events",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Event Subscription versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public Response checkIfThePublisherProcessedALlEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok()
        .entity(EventSubscriptionScheduler.getInstance().checkIfPublisherPublishedAllEvents(id))
        .build();
  }

  @GET
  @Path("id/{id}/listEvents")
  @Operation(
      operationId = "getEvents",
      summary = "Retrieve events based on various filters",
      description =
          "Retrieve failed, successfully sent, or unprocessed change events, identified by alert ID, with an optional limit. If status is not provided, retrieves data from all statuses in ascending timestamp.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Events retrieved successfully"),
        @ApiResponse(responseCode = "404", description = "Entity not found"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Status of events to retrieve (failed, successful)",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"failed", "successful"}))
          @QueryParam("status")
          String statusParam,
      @Parameter(description = "ID of the alert or destination", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Maximum number of events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    try {
      ResultList<TypedEvent> result = fetchEventRecords(id, statusParam, limit, paginationOffset);
      return Response.ok().entity(result).build();
    } catch (EntityNotFoundException e) {
      LOG.error("Entity not found for ID: {}", id, e);
      return Response.status(Response.Status.NOT_FOUND)
          .entity(String.format("Entity with ID %s not found.", id))
          .build();
    } catch (Exception e) {
      LOG.error("Error retrieving events for ID: {}", id, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("An error occurred while retrieving events. [%s]", e.getMessage()))
          .build();
    }
  }

  @GET
  @Path("/id/{subscriptionId}/eventsRecord")
  @Operation(
      operationId = "getEventSubscriptionEventsRecordById",
      summary = "Get event subscription events record",
      description =
          "Retrieve the total count, pending count, failed count, and successful count of events for a given event subscription ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event subscription events record retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventsRecord.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getEventSubscriptionEventsRecordById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "UUID of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("subscriptionId")
          UUID subscriptionId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(subscriptionId));

    try {
      if (!EventSubscriptionScheduler.getInstance().doesRecordExist(subscriptionId)) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("Event subscription not found for ID: " + subscriptionId)
            .build();
      }

      EventsRecord eventsRecord =
          EventSubscriptionScheduler.getInstance().getEventSubscriptionEventsRecord(subscriptionId);

      return Response.ok().entity(eventsRecord).build();
    } catch (Exception e) {
      LOG.error("Error retrieving events record for subscription ID: {}", subscriptionId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              "An error occurred while retrieving events record for subscription ID: "
                  + subscriptionId)
          .build();
    }
  }

  @GET
  @Path("/name/{subscriptionName}/eventsRecord")
  @Operation(
      operationId = "getEventSubscriptionEventsRecordByName",
      summary = "Get event subscription events record by name",
      description =
          "Retrieve the total count, pending count, failed count, and successful count of events for a given event subscription name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event subscription events record retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventsRecord.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getEventSubscriptionEventsRecordByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("subscriptionName")
          String subscriptionName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, getResourceContextByName(subscriptionName));

    try {
      EventSubscription subscription =
          repository.getByName(null, subscriptionName, repository.getFields("id"));

      if (subscription == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("Event subscription not found for name: " + subscriptionName)
            .build();
      }

      EventsRecord eventsRecord =
          EventSubscriptionScheduler.getInstance()
              .getEventSubscriptionEventsRecord(subscription.getId());

      return Response.ok().entity(eventsRecord).build();
    } catch (Exception e) {
      LOG.error("Error retrieving events record for subscription name: {}", subscriptionName, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              "An error occurred while retrieving events record for subscription name: "
                  + subscriptionName)
          .build();
    }
  }

  @GET
  @Path("/id/{subscriptionId}/diagnosticInfo")
  @Operation(
      operationId = "getEventSubscriptionDiagnosticInfoById",
      summary = "Get event subscription diagnostic info",
      description =
          "Retrieve diagnostic information for a given event subscription ID, including current and latest offsets, unprocessed events count, and more.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event subscription diagnostic info retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscriptionDiagnosticInfo.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getEventSubscriptionDiagnosticInfoById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Maximum number of unprocessed events returned")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("limit")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset,
      @Parameter(description = "UUID of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("subscriptionId")
          UUID subscriptionId,
      @Parameter(description = "Return only count if true")
          @QueryParam("listCountOnly")
          @DefaultValue("false")
          boolean listCountOnly) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(subscriptionId));

    try {
      if (!EventSubscriptionScheduler.getInstance().doesRecordExist(subscriptionId)) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("Event subscription not found for ID: " + subscriptionId)
            .build();
      }

      EventSubscriptionDiagnosticInfo diagnosticInfo =
          EventSubscriptionScheduler.getInstance()
              .getEventSubscriptionDiagnosticInfo(
                  subscriptionId, limit, paginationOffset, listCountOnly);

      return Response.ok().entity(diagnosticInfo).build();
    } catch (Exception e) {
      LOG.error("Error retrieving diagnostic info for subscription ID: {}", subscriptionId, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              "An error occurred while retrieving diagnostic info for subscription ID: "
                  + subscriptionId)
          .build();
    }
  }

  @GET
  @Path("/name/{subscriptionName}/diagnosticInfo")
  @Operation(
      operationId = "getEventSubscriptionDiagnosticInfoByName",
      summary = "Get event subscription diagnostic info by name",
      description =
          "Retrieve diagnostic information for a given event subscription name, including current and latest offsets, unprocessed events count, and more.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event subscription diagnostic info retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventSubscriptionDiagnosticInfo.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getEventSubscriptionDiagnosticInfoByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Maximum number of unprocessed events returned")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("limit")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("subscriptionName")
          String subscriptionName,
      @Parameter(description = "Return only count if true")
          @QueryParam("listCountOnly")
          @DefaultValue("false")
          boolean listCountOnly) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, getResourceContextByName(subscriptionName));

    try {
      EventSubscription subscription =
          repository.getByName(null, subscriptionName, repository.getFields("id"));

      if (subscription == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("Event subscription not found for name: " + subscriptionName)
            .build();
      }

      EventSubscriptionDiagnosticInfo diagnosticInfo =
          EventSubscriptionScheduler.getInstance()
              .getEventSubscriptionDiagnosticInfo(
                  subscription.getId(), limit, paginationOffset, listCountOnly);

      return Response.ok().entity(diagnosticInfo).build();
    } catch (Exception e) {
      LOG.error("Error retrieving diagnostic info for subscription name: {}", subscriptionName, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              "An error occurred while retrieving diagnostic info for subscription name: "
                  + subscriptionName)
          .build();
    }
  }

  @GET
  @Path("/id/{id}/failedEvents")
  @Operation(
      operationId = "getFailedEventsBySubscriptionId",
      summary = "Get failed events for a subscription by id",
      description = "Retrieve failed events for a given subscription id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Failed events retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getFailedEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Maximum number of failed events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset,
      @Parameter(description = "Source of the failed events", schema = @Schema(type = "string"))
          @QueryParam("source")
          String source) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    try {
      List<FailedEventResponse> failedEvents =
          EventSubscriptionScheduler.getInstance()
              .getFailedEventsByIdAndSource(id, source, limit, paginationOffset);

      return Response.ok().entity(failedEvents).build();
    } catch (Exception e) {
      LOG.error("Error retrieving failed events for subscription ID: {}", id, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("An error occurred while retrieving failed events for subscription ID: " + id)
          .build();
    }
  }

  @GET
  @Path("/name/{eventSubscriptionName}/failedEvents")
  @Operation(
      operationId = "getFailedEventsBySubscriptionName",
      summary = "Get failed events for a subscription by name",
      description = "Retrieve failed events for a given subscription name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Failed events retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Event subscription not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getFailedEventsByEventSubscriptionName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name,
      @Parameter(
              description = "Maximum number of failed events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset,
      @Parameter(description = "Source of the failed events", schema = @Schema(type = "string"))
          @QueryParam("source")
          String source) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));

    try {
      EventSubscription subscription = repository.getByName(null, name, repository.getFields("id"));

      List<FailedEventResponse> failedEvents =
          EventSubscriptionScheduler.getInstance()
              .getFailedEventsByIdAndSource(subscription.getId(), source, limit, paginationOffset);

      return Response.ok().entity(failedEvents).build();

    } catch (EntityNotFoundException ex) {
      return Response.status(Response.Status.NOT_FOUND)
          .entity("Event subscription not found for name: " + name)
          .build();

    } catch (Exception e) {
      LOG.error("Error retrieving failed events for subscription Name: {}", name, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("An error occurred while retrieving failed events for subscription name: " + name)
          .build();
    }
  }

  @GET
  @Path("/listAllFailedEvents")
  @Operation(
      operationId = "getAllFailedEvents",
      summary = "Get all failed events",
      description = "Retrieve all failed events, optionally filtered by source, and apply a limit.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Failed events retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getAllFailedEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Maximum number of failed events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset,
      @Parameter(description = "Source of the failed events", schema = @Schema(type = "string"))
          @QueryParam("source")
          String source) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());

    try {
      List<FailedEventResponse> failedEvents =
          EventSubscriptionScheduler.getInstance()
              .getAllFailedEvents(source, limit, paginationOffset);

      return Response.ok().entity(failedEvents).build();
    } catch (Exception e) {
      LOG.error("Error retrieving all failed events", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("An error occurred while retrieving all failed events." + e.getMessage())
          .build();
    }
  }

  @GET
  @Path("id/{id}/listSuccessfullySentChangeEvents")
  @Operation(
      operationId = "getSuccessfullySentChangeEventsForAlert",
      summary = "Get successfully sent change events for an alert",
      description =
          "Retrieve successfully sent change events for a specific alert, identified by its ID, with an optional limit.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully sent change events retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Alert not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getSuccessfullySentChangeEventsForAlert(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "ID of the alert to retrieve change events for",
              schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Maximum number of change events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    try {
      List<ChangeEvent> changeEvents =
          EventSubscriptionScheduler.getInstance()
              .getSuccessfullySentChangeEventsForAlert(id, limit, paginationOffset);

      return Response.ok().entity(changeEvents).build();
    } catch (EntityNotFoundException e) {
      LOG.error("Alert not found: {}", id, e);
      return Response.status(Response.Status.NOT_FOUND)
          .entity(String.format("Alert with ID %s not found.", id))
          .build();
    } catch (Exception e) {
      LOG.error("Error retrieving successfully sent change events for alert: {}", id, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              String.format(
                  "An error occurred while retrieving successfully sent change events for alert: %s. [%s]",
                  id, e.getMessage()))
          .build();
    }
  }

  @GET
  @Path("name/{eventSubscriptionName}/listSuccessfullySentChangeEvents")
  @Operation(
      operationId = "getSuccessfullySentChangeEventsForAlertByName",
      summary = "Get successfully sent change events for an alert by name",
      description =
          "Retrieve successfully sent change events for a specific alert, identified by its name, with an optional limit.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully sent change events retrieved successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Alert not found"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
      })
  public Response getSuccessfullySentChangeEventsForAlertByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Name of the alert to retrieve change events for",
              schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name,
      @Parameter(
              description = "Maximum number of change events to retrieve",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("15")
          @Min(value = 0, message = "must be greater than or equal to 0")
          int limit,
      @Parameter(
              description = "Offset for pagination (starting point for records)",
              schema = @Schema(type = "integer"))
          @QueryParam("paginationOffset")
          @DefaultValue("0")
          int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    try {
      EventSubscription subscription = repository.getByName(null, name, repository.getFields("id"));

      List<ChangeEvent> changeEvents =
          EventSubscriptionScheduler.getInstance()
              .getSuccessfullySentChangeEventsForAlert(
                  subscription.getId(), limit, paginationOffset);

      return Response.ok().entity(changeEvents).build();
    } catch (EntityNotFoundException e) {
      LOG.error("Alert not found with name: {}", name, e);
      return Response.status(Response.Status.NOT_FOUND)
          .entity(String.format("Alert with name '%s' not found.", name))
          .build();
    } catch (Exception e) {
      LOG.error(
          "Error retrieving successfully sent change events for alert with name: {}", name, e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              String.format(
                  "An error occurred while retrieving successfully sent change events for alert with name: %s. [%s]",
                  name, e.getMessage()))
          .build();
    }
  }

  @GET
  @Path("/id/{eventSubscriptionId}/destinations")
  @Valid
  @Operation(
      operationId = "getAllDestinationForEventSubscription",
      summary = "Get the destinations for a specific Event Subscription",
      description =
          "Retrieve the status of all destinations associated with the given Event Subscription ID",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Returns the destinations for the Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SubscriptionDestination.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription for instance {eventSubscriptionId} is not found")
      })
  public List<SubscriptionDestination> getAllDestinationForSubscriptionById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the Event Subscription", schema = @Schema(type = "UUID"))
          @PathParam("eventSubscriptionId")
          UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return EventSubscriptionScheduler.getInstance().listAlertDestinations(id);
  }

  @GET
  @Path("name/{eventSubscriptionName}/destinations")
  @Valid
  @Operation(
      operationId = "getAllDestinationForEventSubscriptionByName",
      summary = "Get the destinations for a specific Event Subscription by its name",
      description =
          "Retrieve the status of all destinations associated with the given Event Subscription's fully qualified name (FQN)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Returns the destinations for the Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SubscriptionDestination.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription with the name {fqn} is not found")
      })
  public List<SubscriptionDestination> getAllDestinationStatusesForSubscriptionByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription sub = repository.getByName(null, name, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance().listAlertDestinations(sub.getId());
  }

  @PUT
  @Path("name/{eventSubscriptionName}/syncOffset")
  @Valid
  @Operation(
      operationId = "syncOffsetForEventSubscriptionByName",
      summary = "Sync Offset for a specific Event Subscription by its name",
      description = "Sync Offset for a specific Event Subscription by its name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Returns the destinations for the Event Subscription",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SubscriptionDestination.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Event Subscription with the name {fqn} is not found")
      })
  public Response syncOffsetForEventSubscription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Event Subscription", schema = @Schema(type = "string"))
          @PathParam("eventSubscriptionName")
          String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.status(Response.Status.OK)
        .entity(repository.syncEventSubscriptionOffset(name))
        .build();
  }

  @POST
  @Path("/testDestination")
  @Operation(
      operationId = "testDestination",
      summary = "Send a test message alert to external destinations.",
      description = "Send a test message alert to external destinations of the alert.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Test message sent successfully",
            content = @Content(schema = @Schema(implementation = Response.class)))
      })
  public Response sendTestMessageAlert(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      EventSubscriptionDestinationTestRequest request) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    EventSubscription eventSubscription = new EventSubscription();

    List<SubscriptionDestination> resultDestinations = new ArrayList<>();

    // by-pass AbstractEventConsumer - covers external destinations as of now
    request
        .getDestinations()
        .forEach(
            (destination) -> {
              Destination<ChangeEvent> alert =
                  AlertFactory.getAlert(eventSubscription, destination);
              try {
                alert.sendTestMessage();
                resultDestinations.add(destination);
              } catch (EventPublisherException e) {
                LOG.error(e.getMessage());
              }
            });

    return Response.ok(resultDestinations).build();
  }

  public static List<FilterResourceDescriptor> getNotificationsFilterDescriptors()
      throws IOException {
    List<NotificationResourceDescriptor> entityNotificationDescriptors =
        getDescriptorsFromFile(
            "EventSubResourceDescriptor.json", NotificationResourceDescriptor.class);
    Map<String, EventFilterRule> functions =
        getDescriptorsFromFile("FilterFunctionsDescriptor.json", EventFilterRule.class).stream()
            .collect(
                Collectors.toMap(EventFilterRule::getName, eventFilterRule -> eventFilterRule));
    return entityNotificationDescriptors.stream()
        .map(
            descriptor -> {
              List<EventFilterRule> rules =
                  descriptor.getSupportedFilters().stream()
                      .map(operation -> functions.get(operation.value()))
                      .filter(Objects::nonNull)
                      .toList();
              return new FilterResourceDescriptor()
                  .withName(descriptor.getName())
                  .withSupportedFilters(rules);
            })
        .toList();
  }

  private ResultList<TypedEvent> fetchEventRecords(
      UUID id, String statusParam, int limit, int paginationOffset) {
    List<TypedEvent> combinedEvents = new ArrayList<>();
    TypedEvent.Status status = null;
    int totalEvents;

    // validate the status parameter
    if (statusParam != null && !statusParam.isBlank()) {
      try {
        status = TypedEvent.Status.fromValue(statusParam);
      } catch (IllegalArgumentException e) {
        throw new WebApplicationException(
            "Invalid status. Must be 'failed' or 'successful'.", Response.Status.BAD_REQUEST);
      }
    }

    // Fetch total count and events based on status
    if (status == null) {
      totalEvents = EventSubscriptionScheduler.getInstance().countTotalEvents(id);
      combinedEvents.addAll(fetchEvents(id, limit, paginationOffset));
    } else {
      totalEvents = EventSubscriptionScheduler.getInstance().countTotalEvents(id, status);
      combinedEvents.addAll(fetchEvents(id, limit, paginationOffset, status));
    }

    return new ResultList<>(combinedEvents, paginationOffset, limit, totalEvents);
  }

  private List<TypedEvent> fetchEvents(
      UUID id, int limit, int paginationOffset, TypedEvent.Status status) {
    List<?> events;
    switch (status) {
      case FAILED -> events =
          EventSubscriptionScheduler.getInstance().getFailedEventsById(id, limit, paginationOffset);
      case SUCCESSFUL -> events =
          EventSubscriptionScheduler.getInstance()
              .getSuccessfullySentChangeEventsForAlert(id, limit, paginationOffset);
      default -> throw new IllegalArgumentException("Unknown event status: " + status);
    }

    return events.stream()
        .map(
            event ->
                new TypedEvent()
                    .withStatus(status)
                    .withData(List.of(event))
                    .withTimestamp(Double.valueOf(extractTimestamp(event))))
        .toList();
  }

  private List<TypedEvent> fetchEvents(UUID id, int limit, int paginationOffset) {
    return EventSubscriptionScheduler.getInstance()
        .listEventsForSubscription(id, limit, paginationOffset);
  }

  private Long extractTimestamp(Object event) {
    if (event instanceof ChangeEvent changeEvent) {
      return changeEvent.getTimestamp();
    } else if (event instanceof FailedEventResponse failedEvent) {
      return failedEvent.getChangeEvent().getTimestamp();
    }
    throw new IllegalArgumentException("Unknown event type: " + event.getClass());
  }

  public static List<FilterResourceDescriptor> getObservabilityFilterDescriptors()
      throws IOException {
    return getDescriptorsFromFile(
        "EntityObservabilityFilterDescriptor.json", FilterResourceDescriptor.class);
  }

  public static <T> List<T> getDescriptorsFromFile(String fileName, Class<T> classType)
      throws IOException {
    List<String> jsonDataFiles =
        EntityUtil.getJsonDataResources(String.format(".*json/data/%s$", fileName));
    if (jsonDataFiles.size() != 1) {
      LOG.warn("Invalid number of jsonDataFiles {}. Only one expected.", jsonDataFiles.size());
      return Collections.emptyList();
    }
    String jsonDataFile = jsonDataFiles.get(0);
    try {
      String json =
          CommonUtil.getResourceAsStream(
              EventSubscriptionResource.class.getClassLoader(), jsonDataFile);
      return JsonUtils.readObjects(json, classType);
    } catch (Exception e) {
      LOG.warn(
          "Failed to initialize the events subscription resource descriptors from file {}",
          jsonDataFile,
          e);
    }
    return Collections.emptyList();
  }
}
