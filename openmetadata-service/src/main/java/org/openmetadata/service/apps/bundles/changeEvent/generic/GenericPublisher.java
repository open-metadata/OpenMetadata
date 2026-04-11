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
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.util.OAuth2TokenManager;
import org.openmetadata.service.util.branding.MessageBrandingResolver;

@Slf4j
public class GenericPublisher implements Destination<ChangeEvent> {
  private final Client client;
  private final Webhook webhook;

  private static String buildTestMessageJson() {
    return "{\"message\": \"This is a test message from "
        + MessageBrandingResolver.get().getProductName()
        + " to confirm your webhook destination is configured correctly.\"}";
  }

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

      List<WebhookRecipient> webhookRecipients =
          recipients.stream()
              .filter(WebhookRecipient.class::isInstance)
              .map(WebhookRecipient.class::cast)
              .toList();

      for (WebhookRecipient recipient : webhookRecipients) {
        Invocation.Builder target = recipient.getConfiguredRequest(client, eventJson);
        if (target == null) {
          continue;
        }
        try {
          postWebhookMessage(this, target, eventJson);
        } catch (EventPublisherException ex) {
          if (isOAuth2Configured() && ex.getMessage().contains("HTTP 401")) {
            LOG.debug("OAuth2 token rejected (401), invalidating and retrying");
            invalidateOAuth2Token();
            Invocation.Builder retryTarget = recipient.getConfiguredRequest(client, eventJson);
            postWebhookMessage(this, retryTarget, eventJson);
          } else {
            throw ex;
          }
        }
      }
    } catch (EventPublisherException ex) {
      throw ex;
    } catch (Exception ex) {
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
      String testJson = buildTestMessageJson();
      Invocation.Builder target = getTarget(client, webhook, testJson);
      deliverTestWebhookMessage(this, target, testJson, webhook.getHttpMethod());
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

  private boolean isOAuth2Configured() {
    return webhook != null
        && webhook.getAuthType() instanceof Map<?, ?> authMap
        && WebhookOAuth2Config.Type.OAUTH_2.value().equals(authMap.get("type"));
  }

  private void invalidateOAuth2Token() {
    WebhookOAuth2Config oauth2Config =
        JsonUtils.convertValue(webhook.getAuthType(), WebhookOAuth2Config.class);
    if (oauth2Config != null) {
      OAuth2TokenManager.getInstance().invalidateToken(oauth2Config);
    }
  }

  public void close() {
    if (client != null) {
      client.close();
    }
  }
}
