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
  private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  // TODO: Understand if we need to consider ENTITY_NO_CHANGE, ENTITY_FIELDS_CHANGED or
  // ENTITY_RESTORED.
  private static List<EventType> validEventTypes =
      List.of(EventType.ENTITY_CREATED, EventType.ENTITY_UPDATED);
  private static List<String> validEntityTypes = List.of(Entity.GLOSSARY_TERM);

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

      if (validEventTypes.contains(eventType) && validEntityTypes.contains(entityType)) {
        String signal = String.format("%s-%s", entityType, eventType.toString());

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

        WorkflowHandler.getInstance().triggerWithSignal(signal, variables);
      }
    } catch (Exception exc) {
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
