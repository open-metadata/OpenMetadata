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

package org.openmetadata.service.apps.bundles.changeEvent.slack;

import static org.openmetadata.service.util.SubscriptionUtil.deliverTestWebhookMessage;
import static org.openmetadata.service.util.SubscriptionUtil.getTarget;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

@Slf4j
public class SlackEventPublisher implements Destination<ChangeEvent> {
  private final HandlebarsNotificationMessageEngine messageEngine;
  private final Webhook webhook;
  private final Client client;

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public SlackEventPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDest) {
    this.eventSubscription = eventSubscription;
    this.subscriptionDestination = subscriptionDest;
    this.webhook = JsonUtils.convertValue(subscriptionDest.getConfig(), Webhook.class);
    this.client =
        HttpWebhookTransport.shared()
            .clientFor(subscriptionDest.getTimeout(), subscriptionDest.getReadTimeout());
    this.messageEngine =
        new HandlebarsNotificationMessageEngine(
            (NotificationTemplateRepository)
                Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE));
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    try {
      String transformedJson = (String) prepare(event);

      List<WebhookRecipient> webhookRecipients =
          recipients.stream()
              .filter(WebhookRecipient.class::isInstance)
              .map(WebhookRecipient.class::cast)
              .toList();

      IsolatedSends.sendToEach(
          webhookRecipients, this, recipient -> sendTo(recipient, transformedJson));
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
    return convertCamelCaseToSnakeCase(JsonUtils.pojoToJsonIgnoreNull((SlackMessage) message));
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
      SlackMessage slackMessage = new SlackMessageDecorator().buildOutgoingTestMessage();

      String json = JsonUtils.pojoToJsonIgnoreNull(slackMessage);
      json = convertCamelCaseToSnakeCase(json);
      deliverTestWebhookMessage(this, getTarget(client, webhook, json), json);
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              subscriptionDestination.getType(), e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(message);
    }
  }

  /**
   * Slack messages sent via webhook require some keys in snake_case.
   * Using Layout blocks (from com.slack.api.model.block) restricts control over key
   * aliases within the class.
   */
  public String convertCamelCaseToSnakeCase(String jsonString) {
    JsonNode rootNode = JsonUtils.readTree(jsonString);
    JsonNode modifiedNode = convertKeys(rootNode);
    return JsonUtils.pojoToJsonIgnoreNull(modifiedNode);
  }

  private JsonNode convertKeys(JsonNode node) {
    if (node.isObject()) {
      ObjectNode objectNode = (ObjectNode) node;
      ObjectNode newNode = JsonUtils.getObjectNode();

      objectNode
          .fieldNames()
          .forEachRemaining(
              fieldName -> {
                String newFieldName = fieldName;
                if (fieldName.equals("imageUrl")) {
                  newFieldName = "image_url";
                } else if (fieldName.equals("altText")) {
                  newFieldName = "alt_text";
                }
                newNode.set(newFieldName, convertKeys(objectNode.get(fieldName)));
              });
      return newNode;
    } else if (node.isArray()) {
      ArrayNode arrayNode = (ArrayNode) node;
      ArrayNode newArrayNode = JsonUtils.getObjectNode().arrayNode();
      for (int i = 0; i < arrayNode.size(); i++) {
        newArrayNode.add(convertKeys(arrayNode.get(i)));
      }
      return newArrayNode;
    }
    return node;
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
