package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RECOGNIZER_FEEDBACK;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
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
import org.openmetadata.schema.entity.teams.User;
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
  private static final List<EventType> validEventTypes =
      List.of(EventType.ENTITY_CREATED, EventType.ENTITY_UPDATED);
  private static final List<String> validEntityTypes =
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
          Entity.FILE,
          Entity.DIRECTORY,
          Entity.SPREADSHEET,
          Entity.WORKSHEET,
          Entity.DATABASE_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.API_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.DRIVE_SERVICE,
          Entity.LLM_SERVICE,
          Entity.MCP_SERVICE,
          Entity.SECURITY_SERVICE,
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
          Entity.PAGE,
          Entity.AI_APPLICATION,
          Entity.LLM_MODEL,
          Entity.MCP_SERVER,
          Entity.PROMPT_TEMPLATE,
          Entity.AI_GOVERNANCE_POLICY,
          Entity.AI_GOVERNANCE_FRAMEWORK,
          Entity.AI_FRAMEWORK_CONTROL);

  private static final Registry<Function<ChangeEvent, Map<String, Object>>> handlerRegistry =
      new Registry<>(WorkflowEventConsumer::defaultHandler);

  static {
    handlerRegistry.register(
        Entity.RECOGNIZER_FEEDBACK, WorkflowEventConsumer::handleTagRecognizerFeedback);
  }

  public WorkflowEventConsumer(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    this.eventSubscription = eventSubscription;
    this.subscriptionDestination = subscriptionDestination;
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

    if (isBotChange(event.getUserName(), event.getImpersonatedBy())) {
      LOG.debug(
          "Skipping bot change by {} for entity {} of type: {}",
          event.getUserName(),
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
    } catch (EntityNotFoundException e) {
      LOG.debug(
          "Skipping workflow event for {} {} - entity {} was deleted before processing",
          eventType,
          entityType,
          event.getEntityId());
    } catch (Exception exc) {
      LOG.error("WorkflowEventConsumer - Error processing event", exc);
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), event, exc.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), exc.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  /**
   * Bot changes are excluded from governance workflows: any change whose updatedBy user is a bot,
   * and workflow automation, which writes as the acting user with governance-bot as impersonator. A
   * bot impersonating a user records that user as updatedBy, so the change is the user's.
   */
  public static boolean isBotChange(String userName, String impersonatedBy) {
    boolean botChange = GOVERNANCE_BOT.equals(userName) || GOVERNANCE_BOT.equals(impersonatedBy);
    if (!botChange && userName != null) {
      User actor = Entity.findByNameOrNull(Entity.USER, userName, Include.NON_DELETED);
      botChange = actor != null && Boolean.TRUE.equals(actor.getIsBot());
    }
    return botChange;
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
            "Skipping workflow trigger for event {} on {} - entity {} no longer exists",
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

      // Record the immutable entity id alongside the FQN link so workflow nodes can resolve the
      // entity by id (move/rename-proof) instead of the mutable FQN.
      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE),
          entityReference.getId().toString());

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
  public void sendTestMessage() {}

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
