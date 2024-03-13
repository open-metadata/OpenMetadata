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

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.GENERIC;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhookAlert;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import java.net.UnknownHostException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.Invocation;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GenericPublisher implements Destination<ChangeEvent> {
  private final Client client;
  private final Webhook webhook;

  @Getter private final SubscriptionDestination subscriptionDestination;

  public GenericPublisher(SubscriptionDestination subscription) {
    if (subscription.getType() == GENERIC) {
      this.subscriptionDestination = subscription;
      this.webhook = JsonUtils.convertValue(subscription.getConfig(), Webhook.class);

      // Build Client
      this.client = getClient(subscription.getTimeout(), subscription.getReadTimeout());
    } else {
      throw new IllegalArgumentException(
          "GenericWebhook Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendMessage(ChangeEvent event) throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      // Post Message to default
      String json = JsonUtils.pojoToJson(event);
      if (webhook.getEndpoint() != null) {
        if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
          String hmac = "sha256=" + CommonUtil.calculateHMAC(webhook.getSecretKey(), json);
          postWebhookMessage(this, getTarget().header(RestUtil.SIGNATURE_HEADER, hmac), json);
        } else {
          postWebhookMessage(this, getTarget(), json);
        }
      }

      // Post to Generic Webhook with Actions
      String eventJson = JsonUtils.pojoToJson(event);
      List<Invocation.Builder> targets =
          getTargetsForWebhookAlert(
              webhook, subscriptionDestination.getCategory(), GENERIC, client, event);
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
            CatalogExceptionMessage.eventPublisherFailedToPublish(GENERIC, event, ex.getMessage());
        LOG.error(message);
      }
      throw new EventPublisherException(message, Pair.of(subscriptionDestination.getId(), event));
    }
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
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
