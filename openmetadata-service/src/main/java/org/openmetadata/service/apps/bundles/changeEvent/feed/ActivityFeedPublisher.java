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

import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FeedUtils;

@Slf4j
public class ActivityFeedPublisher implements Destination<ChangeEvent> {
  private final FeedMessageDecorator feedMessageFormatter = new FeedMessageDecorator();
  final FeedRepository feedRepository = new FeedRepository();

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public ActivityFeedPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == ACTIVITY_FEED) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
    } else {
      throw new IllegalArgumentException("Activity Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent changeEvent, Set<Recipient> recipients)
      throws EventPublisherException {
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
          }
        }
      }
    } catch (Exception ex) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              ACTIVITY_FEED, changeEvent, ex.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(ACTIVITY_FEED, ex.getMessage()),
          Pair.of(subscriptionDestination.getId(), changeEvent));
    }
  }

  @Override
  public void sendTestMessage() {}

  @Override
  public EventSubscription getEventSubscriptionForDestination() {
    return eventSubscription;
  }

  @Override
  public boolean getEnabled() {
    return subscriptionDestination.getEnabled();
  }

  @Override
  public boolean requiresRecipients() {
    return false;
  }

  public void close() {
    LOG.info("Closing Activity Feed Publisher");
  }
}
