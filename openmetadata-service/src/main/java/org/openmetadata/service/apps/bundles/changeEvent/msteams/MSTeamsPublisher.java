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

package org.openmetadata.service.apps.bundles.changeEvent.msteams;

import static org.openmetadata.service.util.SubscriptionUtil.deliverTestWebhookMessage;
import static org.openmetadata.service.util.SubscriptionUtil.getTarget;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import java.util.List;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.apps.bundles.changeEvent.IsolatedSends;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.channels.builtin.HttpWebhookTransport;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.MSTeamsMessageDecorator;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

@Slf4j
public class MSTeamsPublisher implements Destination<ChangeEvent> {
  private final HandlebarsNotificationMessageEngine messageEngine;
  private final Webhook webhook;
  private final Client client;

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public MSTeamsPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    this.eventSubscription = eventSubscription;
    this.subscriptionDestination = subscriptionDestination;
    this.webhook = JsonUtils.convertValue(subscriptionDestination.getConfig(), Webhook.class);
    this.client =
        HttpWebhookTransport.shared()
            .clientFor(
                subscriptionDestination.getTimeout(), subscriptionDestination.getReadTimeout());
    this.messageEngine =
        new HandlebarsNotificationMessageEngine(
            (NotificationTemplateRepository)
                Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE));
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    try {
      String json = (String) prepare(event);

      List<WebhookRecipient> webhookRecipients =
          recipients.stream()
              .filter(WebhookRecipient.class::isInstance)
              .map(WebhookRecipient.class::cast)
              .toList();

      IsolatedSends.sendToEach(webhookRecipients, this, recipient -> sendTo(recipient, json));
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), event, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), e.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  // Rendered once for an event, whatever the number of targets it is sent to.
  private String payloadOf(ChangeEvent event, EventContent content) {
    NotificationMessage message =
        messageEngine.format(content.by(messageEngine), subscriptionDestination);
    return JsonUtils.pojoToJson((TeamsMessage) message);
  }

  @Override
  public Object prepare(ChangeEvent event) {
    return prepare(event, new EventContent(event, eventSubscription));
  }

  @Override
  public Object prepare(ChangeEvent event, EventContent content) {
    return payloadOf(event, content);
  }

  @Override
  public void sendTo(Object prepared, Recipient recipient) throws EventPublisherException {
    if (recipient instanceof WebhookRecipient webhookRecipient) {
      sendTo(webhookRecipient, (String) prepared);
    }
  }

  private void sendTo(WebhookRecipient recipient, String json) throws EventPublisherException {
    Invocation.Builder target = recipient.getConfiguredRequest(client, json);
    if (target != null) {
      postWebhookMessage(this, target, json);
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    try {
      // Use legacy test message (unchanged)
      TeamsMessage teamsMessage = new MSTeamsMessageDecorator().buildOutgoingTestMessage();

      deliverTestWebhookMessage(
          this, getTarget(client, webhook, JsonUtils.pojoToJson(teamsMessage)), teamsMessage);
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), e.getMessage());
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

  // The client belongs to the transport, which closes it when the server shuts down.
  public void close() {}
}
