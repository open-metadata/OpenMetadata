package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.JsonUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class WorkflowEventConsumer implements Destination<ChangeEvent> {
    private final SubscriptionDestination subscriptionDestination;
    private final EventSubscription eventSubscription;

    // TODO: Understand if we need to consider ENTITY_NO_CHANGE, ENTITY_FIELDS_CHANGED or ENTITY_RESTORED.
    private static List<EventType> validEventTypes = List.of(
            EventType.ENTITY_CREATED,
            EventType.ENTITY_UPDATED,
            EventType.ENTITY_SOFT_DELETED,
            EventType.ENTITY_DELETED);
    public WorkflowEventConsumer(EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
        if (subscriptionDestination.getType() == SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT) {

            this.eventSubscription = eventSubscription;
            this.subscriptionDestination = subscriptionDestination;
        } else {
            throw new IllegalArgumentException(String.format("WorkflowEventConsumer does not work with %s.", subscriptionDestination.getType()));
        }
    }
    @Override
    public void sendMessage(ChangeEvent event) throws EventPublisherException {
        // NOTE: We are only consuming ENTITY related events.
        EventType eventType = event.getEventType();

        if (validEventTypes.contains(eventType)) {
            String entityType = event.getEntityType();
            String signal = String.format("%s-%s", entityType, eventType.toString());

            EntityReference relatedEntity = Entity.getEntityReferenceById(entityType, event.getEntityId(), Include.ALL);

            Map<String, Object> variables = new HashMap<>();

            variables.put("entityType", entityType);
            variables.put("relatedEntity", JsonUtils.pojoToJson(relatedEntity));

            WorkflowHandler.getInstance().triggerWithSignal(signal, variables);
        }
    }

    @Override
    public void sendTestMessage() throws EventPublisherException {

    }

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
