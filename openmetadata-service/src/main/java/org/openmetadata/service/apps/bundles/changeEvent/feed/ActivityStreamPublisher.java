/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.changeEvent.feed;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.ACTIVITY_FEED;

import java.util.List;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.ActivityStreamRepository;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.socket.WebSocketManager;

/**
 * Publisher that writes to the new lightweight activity_stream table.
 *
 * <p>This replaces ActivityFeedPublisher for the activity stream use case. The key differences:
 * <ul>
 *   <li>Writes to partitioned activity_stream table (not thread_entity)</li>
 *   <li>Stores domain references for domain-scoped filtering</li>
 *   <li>Lightweight records - no full Thread/Post structure</li>
 *   <li>Automatic retention via partition management</li>
 * </ul>
 */
@Slf4j
public class ActivityStreamPublisher implements Destination<ChangeEvent> {

  private static final String ACTIVITY_STREAM_CHANNEL = "activityStream";

  // Entity types to skip (they have their own handling or are internal)
  private static final Set<String> SKIP_ENTITY_TYPES =
      Set.of(
          Entity.THREAD,
          Entity.TASK,
          Entity.BOT,
          Entity.INGESTION_PIPELINE,
          Entity.TEST_CASE_RESOLUTION_STATUS,
          Entity.EVENT_SUBSCRIPTION);

  private final ActivityStreamRepository activityStreamRepository;

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public ActivityStreamPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == ACTIVITY_FEED) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.activityStreamRepository = new ActivityStreamRepository();
    } else {
      throw new IllegalArgumentException(
          "ActivityStreamPublisher invoked with illegal subscription type.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent changeEvent, Set<Recipient> recipients)
      throws EventPublisherException {
    try {
      // Skip internal entity types
      if (SKIP_ENTITY_TYPES.contains(changeEvent.getEntityType())) {
        return;
      }

      // Skip if no entity in the change event
      if (changeEvent.getEntity() == null) {
        return;
      }

      // Get the entity to extract domains
      EntityInterface entity = getEntityFromChangeEvent(changeEvent);
      if (entity == null) {
        LOG.debug(
            "Could not get entity for change event: {} {}",
            changeEvent.getEntityType(),
            changeEvent.getEntityId());
        return;
      }

      // Create activity events from the change event
      List<ActivityEvent> events =
          activityStreamRepository.createFieldEventsFromChangeEvent(changeEvent, entity);

      // Broadcast via WebSocket for real-time updates
      for (ActivityEvent event : events) {
        broadcastActivityEvent(event);
      }

      LOG.debug(
          "Published {} activity events for {} {}",
          events.size(),
          changeEvent.getEntityType(),
          changeEvent.getEntityId());

    } catch (Exception ex) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              ACTIVITY_FEED, changeEvent, ex.getMessage());
      LOG.error(message, ex);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(ACTIVITY_FEED, ex.getMessage()),
          Pair.of(subscriptionDestination.getId(), changeEvent));
    }
  }

  private EntityInterface getEntityFromChangeEvent(ChangeEvent changeEvent) {
    try {
      // Try to get entity from the change event itself
      Object entityObj = changeEvent.getEntity();
      if (entityObj instanceof EntityInterface entityInterface) {
        return entityInterface;
      }

      // If entity is a map/JSON, we need to fetch it from the database
      if (changeEvent.getEntityId() != null) {
        return Entity.getEntity(
            changeEvent.getEntityType(), changeEvent.getEntityId(), "domains", null);
      }

      return null;
    } catch (Exception e) {
      LOG.debug(
          "Could not fetch entity {} {}: {}",
          changeEvent.getEntityType(),
          changeEvent.getEntityId(),
          e.getMessage());
      return null;
    }
  }

  private void broadcastActivityEvent(ActivityEvent event) {
    try {
      WebSocketManager.getInstance()
          .broadCastMessageToAll(ACTIVITY_STREAM_CHANNEL, JsonUtils.pojoToJson(event));
    } catch (Exception e) {
      LOG.debug("Failed to broadcast activity event: {}", e.getMessage());
    }
  }

  @Override
  public void sendTestMessage() {
    // No-op for activity stream
  }

  @Override
  public EventSubscription getEventSubscriptionForDestination() {
    return eventSubscription;
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  public void close() {
    LOG.info("Closing Activity Stream Publisher");
  }
}
