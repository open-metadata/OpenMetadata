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

package org.openmetadata.service.apps.bundles.changeEvent.generic;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;
import static org.openmetadata.service.util.SubscriptionUtil.deliverTestWebhookMessage;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTarget;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import java.net.UnknownHostException;
import java.util.List;
import java.util.Objects;
import java.util.Set;
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
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

@Slf4j
public class GenericPublisher implements Destination<ChangeEvent> {
  private final Client client;
  private final Webhook webhook;
  private static final String TEST_MESSAGE_JSON =
      "{\"message\": \"This is a test message from OpenMetadata to confirm your webhook destination is configured correctly.\"}";

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public GenericPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == WEBHOOK) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.webhook = JsonUtils.convertValue(subscriptionDestination.getConfig(), Webhook.class);

      // Validate webhook URL to prevent SSRF
      if (this.webhook != null && this.webhook.getEndpoint() != null) {
        org.openmetadata.service.util.URLValidator.validateURL(
            this.webhook.getEndpoint().toString());
      }

      this.client =
          getClient(subscriptionDestination.getTimeout(), subscriptionDestination.getReadTimeout());
    } else {
      throw new IllegalArgumentException(
          "GenericWebhook Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent event, Set<Recipient> recipients)
      throws EventPublisherException {
    try {
      String eventJson = JsonUtils.pojoToJson(event);

      // Convert type-agnostic Recipient objects to configured webhook requests
      List<Invocation.Builder> targets =
          recipients.stream()
              .filter(WebhookRecipient.class::isInstance)
              .map(WebhookRecipient.class::cast)
              .map(r -> r.getConfiguredRequest(client, eventJson))
              .filter(Objects::nonNull)
              .toList();

      // Send webhook message to each target
      for (Invocation.Builder actionTarget : targets) {
        postWebhookMessage(this, actionTarget, eventJson);
      }
    } catch (Exception ex) {
      // Handle UnknownHostException with specific logging
      if (ex.getCause() instanceof UnknownHostException) {
        String message =
            String.format(
                "Unknown Host Exception for Generic Publisher : %s , WebhookEndpoint : %s",
                subscriptionDestination.getId(), webhook.getEndpoint());
        LOG.warn(message);
        setErrorStatus(System.currentTimeMillis(), 400, "UnknownHostException");
      }

      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, event, ex.getMessage());
      LOG.error(message);
      throw new EventPublisherException(
          CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, ex.getMessage()),
          Pair.of(subscriptionDestination.getId(), event));
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    try {
      Invocation.Builder target = getTarget(client, webhook, TEST_MESSAGE_JSON);
      deliverTestWebhookMessage(this, target, TEST_MESSAGE_JSON, webhook.getHttpMethod());
    } catch (Exception ex) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, ex.getMessage());
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
    if (client != null) {
      client.close();
    }
  }
}
