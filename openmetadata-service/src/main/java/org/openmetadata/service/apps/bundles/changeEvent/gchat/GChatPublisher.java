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

package org.openmetadata.service.apps.bundles.changeEvent.gchat;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.G_CHAT;
import static org.openmetadata.service.util.SubscriptionUtil.deliverTestWebhookMessage;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTarget;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhookAlert;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import java.util.List;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.GChatMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

@Slf4j
public class GChatPublisher implements Destination<ChangeEvent> {
  private final MessageDecorator<GChatMessage> gChatMessageMessageDecorator =
      new GChatMessageDecorator();
  private final Webhook webhook;
  private final Client client;

  @Getter private final SubscriptionDestination subscriptionDestination;

  private final EventSubscription eventSubscription;

  public GChatPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == G_CHAT) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.webhook = JsonUtils.convertValue(subscriptionDestination.getConfig(), Webhook.class);

      // Build Client
      client =
          getClient(subscriptionDestination.getTimeout(), subscriptionDestination.getReadTimeout());
    } else {
      throw new IllegalArgumentException("GChat Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent event) throws EventPublisherException {

    try {
      GChatMessage gchatMessage =
          gChatMessageMessageDecorator.buildOutgoingMessage(
              getDisplayNameOrFqn(eventSubscription), event);
      String json = JsonUtils.pojoToJsonIgnoreNull(gchatMessage);
      List<Invocation.Builder> targets =
          getTargetsForWebhookAlert(
              webhook, subscriptionDestination.getCategory(), G_CHAT, client, event, json);
      targets.add(getTarget(client, webhook, json));
      for (Invocation.Builder actionTarget : targets) {
        postWebhookMessage(this, actionTarget, gchatMessage);
      }
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(G_CHAT, event, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(G_CHAT, e.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    try {
      GChatMessage gchatMessage = gChatMessageMessageDecorator.buildOutgoingTestMessage();
      deliverTestWebhookMessage(
          this, getTarget(client, webhook, JsonUtils.pojoToJson(gchatMessage)), gchatMessage);
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(G_CHAT, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(message);
    }
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
    if (null != client) {
      client.close();
    }
  }
}
