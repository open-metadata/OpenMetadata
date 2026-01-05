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

package org.openmetadata.service.services.events;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.api.events.CreateEventSubscription.AlertType.NOTIFICATION;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.EventSubscriptionDestinationTestRequest;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.NotificationResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.bundles.changeEvent.AlertFactory;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;
import org.quartz.SchedulerException;

/**
 * Service layer for EventSubscription entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.EVENT_SUBSCRIPTION)
public class EventSubscriptionService
    extends EntityBaseService<EventSubscription, EventSubscriptionRepository> {
  public static final String FIELDS = "owners,filteringRules";
  @Getter private final EventSubscriptionMapper mapper;

  @Inject
  public EventSubscriptionService(
      EventSubscriptionRepository repository,
      Authorizer authorizer,
      EventSubscriptionMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.EVENT_SUBSCRIPTION, EventSubscription.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    allowedFields.add("statusDetails");
    addViewOperation("filteringRules", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class EventSubscriptionList extends ResultList<EventSubscription> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    EventSubscriptionScheduler.initialize(config);
    EventsSubscriptionRegistry.initialize(
        listOrEmpty(getNotificationsFilterDescriptors()),
        listOrEmpty(getObservabilityFilterDescriptors()));
    repository.initSeedDataFromResources();
    initializeEventSubscriptions();
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

  public Response deleteEventSubscription(UriInfo uriInfo, SecurityContext securityContext, UUID id)
      throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    EventSubscription eventSubscription = repository.get(null, id, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance().deleteSuccessfulAndFailedEventsRecordByAlert(id);
    return delete(uriInfo, securityContext, id, true, true);
  }

  public Response deleteEventSubscriptionAsync(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    EventSubscription eventSubscription = repository.get(null, id, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance().deleteSuccessfulAndFailedEventsRecordByAlert(id);
    return deleteByIdAsync(uriInfo, securityContext, id, true, true);
  }

  public Response deleteEventSubscriptionByName(
      UriInfo uriInfo, SecurityContext securityContext, String name) throws SchedulerException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription eventSubscription =
        repository.getByName(null, name, repository.getFields("id"));
    EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSubscription);
    EventSubscriptionScheduler.getInstance()
        .deleteSuccessfulAndFailedEventsRecordByAlert(eventSubscription.getId());
    return deleteByName(uriInfo, securityContext, name, true, true);
  }

  public SubscriptionStatus getEventSubscriptionStatusByName(
      SecurityContext securityContext, String name, UUID destinationId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription sub = repository.getByName(null, name, repository.getFields("name"));
    return EventSubscriptionScheduler.getInstance()
        .getStatusForEventSubscription(sub.getId(), destinationId);
  }

  public SubscriptionStatus getEventSubscriptionStatusById(
      SecurityContext securityContext, UUID id, UUID destinationId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    return EventSubscriptionScheduler.getInstance()
        .getStatusForEventSubscription(id, destinationId);
  }

  public ResultList<FilterResourceDescriptor> listEventResources(
      SecurityContext securityContext, CreateEventSubscription.AlertType alertType) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    if (alertType.equals(NOTIFICATION)) {
      return new ResultList<>(EventsSubscriptionRegistry.listEntityNotificationDescriptors());
    } else {
      return new ResultList<>(EventsSubscriptionRegistry.listObservabilityDescriptors());
    }
  }

  public Response checkIfThePublisherProcessedALlEvents(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok()
        .entity(EventSubscriptionScheduler.getInstance().checkIfPublisherPublishedAllEvents(id))
        .build();
  }

  public EventSubscriptionOffset syncEventSubscriptionOffset(String name) {
    return repository.syncEventSubscriptionOffset(name);
  }

  public ResultList<TypedEvent> getEvents(
      SecurityContext securityContext,
      UUID id,
      String statusParam,
      int limit,
      int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return fetchEventRecords(id, statusParam, limit, paginationOffset);
  }

  public EventsRecord getEventsRecordById(SecurityContext securityContext, UUID subscriptionId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(subscriptionId));
    return EventSubscriptionScheduler.getInstance()
        .getEventSubscriptionEventsRecord(subscriptionId);
  }

  public boolean doesRecordExist(UUID subscriptionId) {
    return EventSubscriptionScheduler.getInstance().doesRecordExist(subscriptionId);
  }

  public EventsRecord getEventsRecordByName(
      SecurityContext securityContext, String subscriptionName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, getResourceContextByName(subscriptionName));
    EventSubscription subscription =
        repository.getByName(null, subscriptionName, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance()
        .getEventSubscriptionEventsRecord(subscription.getId());
  }

  public EventSubscriptionDiagnosticInfo getDiagnosticInfoById(
      SecurityContext securityContext,
      UUID subscriptionId,
      int limit,
      int paginationOffset,
      boolean listCountOnly) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(subscriptionId));
    return EventSubscriptionScheduler.getInstance()
        .getEventSubscriptionDiagnosticInfo(subscriptionId, limit, paginationOffset, listCountOnly);
  }

  public EventSubscriptionDiagnosticInfo getDiagnosticInfoByName(
      SecurityContext securityContext,
      String subscriptionName,
      int limit,
      int paginationOffset,
      boolean listCountOnly) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, getResourceContextByName(subscriptionName));
    EventSubscription subscription =
        repository.getByName(null, subscriptionName, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance()
        .getEventSubscriptionDiagnosticInfo(
            subscription.getId(), limit, paginationOffset, listCountOnly);
  }

  public List<FailedEventResponse> getFailedEventsById(
      SecurityContext securityContext, UUID id, String source, int limit, int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return EventSubscriptionScheduler.getInstance()
        .getFailedEventsByIdAndSource(id, source, limit, paginationOffset);
  }

  public List<FailedEventResponse> getFailedEventsByName(
      SecurityContext securityContext,
      String name,
      String source,
      int limit,
      int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription subscription = repository.getByName(null, name, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance()
        .getFailedEventsByIdAndSource(subscription.getId(), source, limit, paginationOffset);
  }

  public List<FailedEventResponse> getAllFailedEvents(
      SecurityContext securityContext, String source, int limit, int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    return EventSubscriptionScheduler.getInstance()
        .getAllFailedEvents(source, limit, paginationOffset);
  }

  public List<ChangeEvent> getSuccessfulEventsById(
      SecurityContext securityContext, UUID id, int limit, int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return EventSubscriptionScheduler.getInstance()
        .getSuccessfullySentChangeEventsForAlert(id, limit, paginationOffset);
  }

  public List<ChangeEvent> getSuccessfulEventsByName(
      SecurityContext securityContext, String name, int limit, int paginationOffset) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription subscription = repository.getByName(null, name, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance()
        .getSuccessfullySentChangeEventsForAlert(subscription.getId(), limit, paginationOffset);
  }

  public List<SubscriptionDestination> getDestinationsById(
      SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return EventSubscriptionScheduler.getInstance().listAlertDestinations(id);
  }

  public List<SubscriptionDestination> getDestinationsByName(
      SecurityContext securityContext, String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    EventSubscription sub = repository.getByName(null, name, repository.getFields("id"));
    return EventSubscriptionScheduler.getInstance().listAlertDestinations(sub.getId());
  }

  public Response syncOffset(SecurityContext securityContext, String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return Response.status(Response.Status.OK)
        .entity(repository.syncEventSubscriptionOffset(name))
        .build();
  }

  public List<SubscriptionDestination> testDestination(
      SecurityContext securityContext, EventSubscriptionDestinationTestRequest request) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    EventSubscription eventSubscription = new EventSubscription();

    List<SubscriptionDestination> resultDestinations = new ArrayList<>();
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
    return resultDestinations;
  }
}
