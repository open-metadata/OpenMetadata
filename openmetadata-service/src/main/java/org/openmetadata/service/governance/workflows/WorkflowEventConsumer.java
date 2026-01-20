package org.openmetadata.service.governance.workflows;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class WorkflowEventConsumer implements Destination<ChangeEvent> {
  public static final String GOVERNANCE_BOT = "governance-bot";
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

  @Override
  public void sendMessage(ChangeEvent event) throws EventPublisherException {
    // NOTE: We are only consuming ENTITY related events.
    try {
      EventType eventType = event.getEventType();
      String entityType = event.getEntityType();

      LOG.debug(
          "WorkflowEventConsumer - Received event for entityType: {}, eventType: {}, entityId: {}",
          entityType,
          eventType,
          event.getEntityId());

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

      if (validEventTypes.contains(eventType) && validEntityTypes.contains(entityType)) {
        LOG.debug(
            "WorkflowEventConsumer - Generating signal for entityType: {}, eventType: {}",
            entityType,
            eventType);
        String eventTypeStr =
            eventType.equals(EventType.ENTITY_CREATED) ? "entityCreated" : "entityUpdated";
        String signal = String.format("%s-%s", entityType, eventTypeStr);
        LOG.debug("WorkflowEventConsumer - Generated Signal: {}", signal);

        EntityReference entityReference =
            Entity.getEntityReferenceById(entityType, event.getEntityId(), Include.ALL);
        MessageParser.EntityLink entityLink =
            new MessageParser.EntityLink(entityType, entityReference.getFullyQualifiedName());

        Map<String, Object> variables = new HashMap<>();

        variables.put(
            getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
            entityLink.getLinkString());

        // Set the updatedBy variable from the change event userName
        if (event.getUserName() != null) {
          variables.put(
              getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE),
              event.getUserName());
        }

        LOG.debug("WorkflowEventConsumer - Triggering with signal: {}", signal);
        WorkflowHandler.getInstance().triggerWithSignal(signal, variables);
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
    LOG.info("Closing WorkflowEventConsumer");
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }
}
