package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

@Slf4j
public final class ChangeEventOffsetUtils {

  private static final String OFFSET_JSON_SCHEMA = "eventSubscriptionOffset";

  private ChangeEventOffsetUtils() {}

  public static void commitOffset(String workflowFqn, String entityType, Long maxProcessedOffset) {
    if (maxProcessedOffset == null) {
      LOG.debug(
          "No events processed for workflow '{}' entity type '{}'. Offset not updated.",
          workflowFqn,
          entityType);
      return;
    }
    String consumerId = FetchChangeEventsImpl.buildConsumerId(workflowFqn, entityType);
    String existingJson =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(consumerId, OFFSET_EXTENSION);
    if (existingJson != null) {
      EventSubscriptionOffset existing =
          JsonUtils.readValue(existingJson, EventSubscriptionOffset.class);
      if (existing.getCurrentOffset() >= maxProcessedOffset) {
        LOG.debug(
            "Stored offset {} >= processed offset {} for workflow '{}'. No update needed.",
            existing.getCurrentOffset(),
            maxProcessedOffset,
            workflowFqn);
        return;
      }
    }
    EventSubscriptionOffset newOffset =
        new EventSubscriptionOffset()
            .withStartingOffset(maxProcessedOffset)
            .withCurrentOffset(maxProcessedOffset)
            .withTimestamp(System.currentTimeMillis());
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            consumerId, OFFSET_EXTENSION, OFFSET_JSON_SCHEMA, JsonUtils.pojoToJson(newOffset));
    LOG.debug(
        "Committed offset {} for workflow '{}' entity type '{}'.",
        maxProcessedOffset,
        workflowFqn,
        entityType);
  }
}
