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
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhookAlert;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.Invocation;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GenericPublisher implements Destination<ChangeEvent> {
  private final Client client;
  private final Webhook webhook;

  @Getter private final SubscriptionDestination subscriptionDestination;
  private final EventSubscription eventSubscription;

  public GenericPublisher(
      EventSubscription eventSubscription, SubscriptionDestination subscriptionDestination) {
    if (subscriptionDestination.getType() == WEBHOOK) {
      this.eventSubscription = eventSubscription;
      this.subscriptionDestination = subscriptionDestination;
      this.webhook = JsonUtils.convertValue(subscriptionDestination.getConfig(), Webhook.class);

      // Build Client
      this.client =
          getClient(subscriptionDestination.getTimeout(), subscriptionDestination.getReadTimeout());
    } else {
      throw new IllegalArgumentException(
          "GenericWebhook Alert Invoked with Illegal Type and Settings.");
    }
  }

  public static String decryptWebhookSecretKey(String encryptedSecretkey) {

    if (encryptedSecretkey != null && encryptedSecretkey.startsWith("ENCRYPTED_")) {
      // Remove the "ENCRYPTED_" prefix
      encryptedSecretkey = encryptedSecretkey.substring("ENCRYPTED_".length());

      if (Fernet.getInstance().isKeyDefined()) {
        byte[] decodedKey = Base64.getDecoder().decode(encryptedSecretkey);
        String decodedKeyStr = new String(decodedKey, StandardCharsets.UTF_8);
        return Fernet.getInstance().decryptIfApplies(decodedKeyStr);
      }
    }
    return encryptedSecretkey;
  }

  @Override
  public void sendMessage(ChangeEvent event) throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      // Post Message to default
      String json = JsonUtils.pojoToJson(event);
      if (webhook.getEndpoint() != null) {
        if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
          String hmac =
              "sha256="
                  + CommonUtil.calculateHMAC(decryptWebhookSecretKey(webhook.getSecretKey()), json);
          postWebhookMessage(this, getTarget().header(RestUtil.SIGNATURE_HEADER, hmac), json);
        } else {
          postWebhookMessage(this, getTarget(), json);
        }
      }

      // Post to Generic Webhook with Actions
      String eventJson = JsonUtils.pojoToJson(event);
      List<Invocation.Builder> targets =
          getTargetsForWebhookAlert(
              webhook, subscriptionDestination.getCategory(), WEBHOOK, client, event);
      for (Invocation.Builder actionTarget : targets) {
        postWebhookMessage(this, actionTarget, eventJson);
      }
    } catch (Exception ex) {
      Throwable cause = ex.getCause();
      String message = "";
      if (cause != null && cause.getClass() == UnknownHostException.class) {
        message =
            String.format(
                "Unknown Host Exception for Generic Publisher : %s , WebhookEndpoint : %s",
                subscriptionDestination.getId(), webhook.getEndpoint());
        LOG.warn(message);
        setErrorStatus(attemptTime, 400, "UnknownHostException");
      } else {
        message =
            CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, event, ex.getMessage());
        LOG.error(message);
      }
      throw new EventPublisherException(message, Pair.of(subscriptionDestination.getId(), event));
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      // Post Message to default
      String json =
          "This is a test message from OpenMetadata to confirm your webhook destination is configured correctly.";
      if (webhook.getEndpoint() != null) {
        if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
          String hmac =
              "sha256="
                  + CommonUtil.calculateHMAC(decryptWebhookSecretKey(webhook.getSecretKey()), json);
          postWebhookMessage(this, getTarget().header(RestUtil.SIGNATURE_HEADER, hmac), json);
        } else {
          postWebhookMessage(this, getTarget(), json);
        }
      }
    } catch (Exception ex) {
      Throwable cause = ex.getCause();
      String message = "";
      if (cause != null && cause.getClass() == UnknownHostException.class) {
        message =
            String.format(
                "Unknown Host Exception for Generic Publisher : %s , WebhookEndpoint : %s",
                subscriptionDestination.getId(), webhook.getEndpoint());
        LOG.warn(message);
        setErrorStatus(attemptTime, 400, "UnknownHostException");
      } else {
        message = CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, ex.getMessage());
        LOG.error(message);
      }
      throw new EventPublisherException(message);
    }
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
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
