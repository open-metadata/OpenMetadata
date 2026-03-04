package org.openmetadata.service.governance.workflows;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RECOGNIZER_FEEDBACK;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRIGGERING_OBJECT_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RecognizerFeedbackRepository;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.Registry;

@Slf4j
public class WorkflowEventConsumer implements Destination<ChangeEvent> {
  public static final String GOVERNANCE_BOT = "governance-bot";

  private static final RetryConfig RETRY_CONFIG =
      RetryConfig.custom()
          .maxAttempts(3)
          .waitDuration(Duration.ofMillis(100))
          .retryOnException(WorkflowEventConsumer::isTransientDatabaseError)
          .build();

  private final Retry retry = Retry.of("workflow-event-consumer", RETRY_CONFIG);
  private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  // TODO: Understand if we need to consider ENTITY_NO_CHANGE, ENTITY_FIELDS_CHANGED or
  // ENTITY_RESTORED.
  private static List<EventType> validEventTypes =
      List.of(EventType.ENTITY_CREATED, EventType.ENTITY_UPDATED);
  private static List<String> validEntityTypes =
      List.of(
          Entity.GLOSSARY_TERM,
          Entity.TABLE,
          Entity.DASHBOARD,
          Entity.PIPELINE,
          Entity.TOPIC,
          Entity.CONTAINER,
          Entity.DATABASE,
          Entity.DATABASE_SCHEMA,
          Entity.STORED_PROCEDURE,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.CHART,
          Entity.MLMODEL,
          Entity.SEARCH_INDEX,
          Entity.API_ENDPOINT,
          Entity.API_COLLECTION,
          Entity.DATABASE_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.API_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.DOMAIN,
          Entity.DATA_PRODUCT,
          Entity.GLOSSARY,
          Entity.CLASSIFICATION,
          Entity.TAG,
          Entity.POLICY,
          Entity.ROLE,
          Entity.TEAM,
          Entity.USER,
          Entity.BOT,
          Entity.APPLICATION,
          Entity.INGESTION_PIPELINE,
          Entity.TEST_SUITE,
          Entity.TEST_CASE,
          Entity.QUERY,
          Entity.METRIC,
          Entity.DATA_INSIGHT_CHART,
          Entity.DATA_CONTRACT,
          Entity.PAGE);

  private static final Registry<Function<ChangeEvent, Map<String, Object>>> handlerRegistry =
      new Registry<>(WorkflowEventConsumer::defaultHandler);

  static {
    handlerRegistry.register(
        Entity.RECOGNIZER_FEEDBACK, WorkflowEventConsumer::handleTagRecognizerFeedback);
  }

  public WorkflowEventConsumer(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType()
        == SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT) {

      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
    } else {
      throw new IllegalArgumentException(
          String.format(
              "WorkflowEventConsumer does not work with %s.", subscriptionDestination.getType()));
    }
  }

  private static boolean isTransientDatabaseError(Throwable e) {
    String rootCauseMessage = ExceptionUtils.getRootCauseMessage(e);
    if (rootCauseMessage == null) {
      return false;
    }
    String lowerMessage = rootCauseMessage.toLowerCase();
    return lowerMessage.contains("deadlock")
        || lowerMessage.contains("lock wait timeout")
        || lowerMessage.contains("try restarting transaction")
        || lowerMessage.contains("updated by another transaction concurrently")
        || lowerMessage.contains("optimisticlockingfailureexception");
  }

  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    EventType eventType = event.getEventType();
    String entityType = event.getEntityType();

    String signal = String.format("%s-%s", entityType, eventType.toString());

    LOG.debug(
        "WorkflowEventConsumer - Received event for entityType: {}, eventType: {}, entityId: {}",
        entityType,
        eventType,
        event.getEntityId());

    if (!validEventTypes.contains(event.getEventType())) {
      return;
    }

    // Skip events from governance-bot to prevent infinite loops
    // These are system-initiated workflow changes that shouldn't trigger new workflows
    if (GOVERNANCE_BOT.equals(event.getUserName())
        || (event.getImpersonatedBy() != null
            && GOVERNANCE_BOT.equals(event.getImpersonatedBy()))) {
      LOG.debug(
          "Skipping workflow-initiated event from governance-bot for entity {} of type: {}",
          event.getEntityFullyQualifiedName(),
          event.getEntityType());
      return;
    }

    Function<ChangeEvent, Map<String, Object>> handler = handlerRegistry.get(event.getEntityType());

    if (handler == null) {
      LOG.debug("No handler found in registry for entity type {}", event.getEntityType());
      return;
    }

    LOG.debug("WorkflowEventConsumer - Generated Signal: {}", signal);

    Map<String, Object> variables;
    try {
      variables = handler.apply(event);

      if (variables != null && !variables.isEmpty()) {
        LOG.info("WorkflowEventConsumer - Triggering with signal: {}", signal);
        Retry.decorateRunnable(
                retry, () -> WorkflowHandler.getInstance().triggerWithSignal(signal, variables))
            .run();
      }
    } catch (Exception exc) {
      LOG.error("WorkflowEventConsumer - Error processing event", exc);
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              GOVERNANCE_WORKFLOW_CHANGE_EVENT, event, exc.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              GOVERNANCE_WORKFLOW_CHANGE_EVENT, exc.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  public static Map<String, Object> defaultHandler(ChangeEvent event) {
    // NOTE: We are only consuming ENTITY related events.
    EventType eventType = event.getEventType();
    String entityType = event.getEntityType();

    Map<String, Object> variables = new HashMap<>();

    if (validEventTypes.contains(eventType) && validEntityTypes.contains(entityType)) {
      EntityReference entityReference;
      try {
        entityReference =
            Entity.getEntityReferenceById(entityType, event.getEntityId(), Include.ALL);
      } catch (EntityNotFoundException e) {
        // Entity was deleted between event creation and processing - skip workflow trigger
        LOG.debug(
            "Skipping workflow trigger for event {} on {}  - entity {} no longer exists",
            eventType,
            entityType,
            event.getEntityFullyQualifiedName());
        return variables;
      }

      MessageParser.EntityLink entityLink =
          new MessageParser.EntityLink(entityType, entityReference.getFullyQualifiedName());

      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
          entityLink.getLinkString());

      // Set the updatedBy variable from the change event userName
      if (event.getUserName() != null) {
        variables.put(
            getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE), event.getUserName());
      }
    }
    return variables;
  }

  private static Map<String, Object> handleTagRecognizerFeedback(ChangeEvent event) {
    Map<String, Object> variables = new HashMap<>();

    if (!Entity.RECOGNIZER_FEEDBACK.equals(event.getEntityType())) return variables;

    RecognizerFeedbackRepository feedbackRepository =
        new RecognizerFeedbackRepository(Entity.getCollectionDAO());

    RecognizerFeedback feedback = feedbackRepository.get(event.getEntityId());

    EntityReference entityReference =
        Entity.getEntityReferenceByName(Entity.TAG, feedback.getTagFQN(), Include.ALL);
    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(Entity.TAG, entityReference.getFullyQualifiedName());

    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
        entityLink.getLinkString());

    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, TRIGGERING_OBJECT_ID_VARIABLE),
        feedback.getId().toString());

    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RECOGNIZER_FEEDBACK),
        JsonUtils.pojoToJson(feedback));

    // Set the updatedBy variable from the change event userName
    if (event.getUserName() != null) {
      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE), event.getUserName());
    }
    return variables;
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {}

  @Override
  public SubscriptionDestination getSubscriptionDestination() {
    return subscriptionDestination;
  }

  @Override
  public EventSubscription getEventSubscriptionForDestination() {
    return eventSubscription;
  }

  @Override
  public void close() {
    LOG.debug("Closing WorkflowEventConsumer");
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  @Override
  public boolean requiresRecipients() {
    return false;
  }
}
