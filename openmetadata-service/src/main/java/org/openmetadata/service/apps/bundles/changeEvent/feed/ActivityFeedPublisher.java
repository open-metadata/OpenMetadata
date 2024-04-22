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

package org.openmetadata.service.apps.bundles.changeEvent.feed;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.ACTIVITY_FEED;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;

import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FeedUtils;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ActivityFeedPublisher implements Destination<ChangeEvent> {
  private final FeedMessageDecorator feedMessageFormatter = new FeedMessageDecorator();
  FeedRepository feedRepository = new FeedRepository();

  @Getter private final SubscriptionDestination subscriptionDestination;

  public ActivityFeedPublisher(SubscriptionDestination subscription) {
    if (subscription.getType() == ACTIVITY_FEED) {
      this.subscriptionDestination = subscription;
    } else {
      throw new IllegalArgumentException("Activity Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent changeEvent) throws EventPublisherException {
    try {
      // Thread are created in FeedRepository Directly
      if (!changeEvent.getEntityType().equals(Entity.THREAD)) {
        for (Thread thread :
            listOrEmpty(FeedUtils.getThreadWithMessage(feedMessageFormatter, changeEvent))) {
          // Don't create a thread if there is no message
          if (thread.getMessage() != null && !thread.getMessage().isEmpty()) {
            feedRepository.create(thread, changeEvent);
            WebSocketManager.getInstance()
                .broadCastMessageToAll(
                    WebSocketManager.FEED_BROADCAST_CHANNEL, JsonUtils.pojoToJson(thread));
            // Delete all conversations related to the entity
            if (changeEvent.getEventType().equals(ENTITY_DELETED)) {
              deleteAllConversationsRelatedToEntity(
                  getEntity(changeEvent), Entity.getCollectionDAO());
            }
          }
        }
      }
    } catch (Exception ex) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              ACTIVITY_FEED, changeEvent, ex.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          message, Pair.of(subscriptionDestination.getId(), changeEvent));
    }
  }

  private void deleteAllConversationsRelatedToEntity(
      EntityInterface entityInterface, CollectionDAO collectionDAO) {
    String entityId = entityInterface.getId().toString();
    List<String> threadIds = collectionDAO.feedDAO().findByEntityId(entityId);
    for (String threadId : threadIds) {
      UUID id = UUID.fromString(threadId);
      collectionDAO.relationshipDAO().deleteAll(id, Entity.THREAD);
      collectionDAO.feedDAO().delete(id);
    }
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  public void close() {
    LOG.info("Closing Activity Feed Publisher");
  }
}
