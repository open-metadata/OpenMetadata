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

import static org.openmetadata.common.utils.CommonUtil.calculateHMAC;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;
import static org.openmetadata.service.util.SubscriptionUtil.deliverTestWebhookMessage;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhookAlert;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import java.net.UnknownHostException;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.RestUtil;

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
  public void sendMessage(ChangeEvent event) throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      String eventJson = JsonUtils.pojoToJson(event);
      Invocation.Builder target = getTarget();

      prepareHeaders(target, eventJson);
      postWebhookMessage(this, target, eventJson, webhook.getHttpMethod());

      sendActionsToTargets(event);

    } catch (Exception ex) {
      handleException(attemptTime, event, ex);
    }
  }

  @Override
  public void sendTestMessage() throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      Invocation.Builder target = getTarget();
      prepareHeaders(target, TEST_MESSAGE_JSON);
      deliverTestWebhookMessage(this, target, TEST_MESSAGE_JSON, webhook.getHttpMethod());

    } catch (Exception ex) {
      handleException(attemptTime, ex);
    }
  }

  private void sendActionsToTargets(ChangeEvent event) {
    List<Invocation.Builder> targets =
        getTargetsForWebhookAlert(
            webhook, subscriptionDestination.getCategory(), WEBHOOK, client, event);
    String eventJson = JsonUtils.pojoToJson(event);

    for (Invocation.Builder actionTarget : targets) {
      postWebhookMessage(this, actionTarget, eventJson);
    }
  }

  private void prepareHeaders(Invocation.Builder target, String json) {
    if (!nullOrEmpty(webhook.getSecretKey())) {
      String hmac =
          "sha256=" + calculateHMAC(decryptWebhookSecretKey(webhook.getSecretKey()), json);
      target.header(RestUtil.SIGNATURE_HEADER, hmac);
    }

    Map<String, String> headers = webhook.getHeaders();
    if (!nullOrEmpty(headers)) {
      headers.forEach(target::header);
    }
  }

  public static WebTarget addQueryParams(WebTarget target, Map<String, String> queryParams) {
    if (!CommonUtil.nullOrEmpty(queryParams)) {
      for (Map.Entry<String, String> entry : queryParams.entrySet()) {
        target = target.queryParam(entry.getKey(), entry.getValue());
      }
    }
    return target;
  }

  private void handleException(long attemptTime, ChangeEvent event, Exception ex)
      throws EventPublisherException {
    handleCommonException(attemptTime, ex);
    String message =
        CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, event, ex.getMessage());
    LOG.error(message);
    throw new EventPublisherException(
        CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, ex.getMessage()),
        Pair.of(subscriptionDestination.getId(), event));
  }

  private void handleException(long attemptTime, Exception ex) throws EventPublisherException {
    handleCommonException(attemptTime, ex);
    String message =
        CatalogExceptionMessage.eventPublisherFailedToPublish(WEBHOOK, ex.getMessage());
    LOG.error(message);
    throw new EventPublisherException(message);
  }

  private void handleCommonException(long attemptTime, Exception ex)
      throws EventPublisherException {
    Throwable cause = ex.getCause();
    if (cause instanceof UnknownHostException) {
      String message =
          String.format(
              "Unknown Host Exception for Generic Publisher : %s , WebhookEndpoint : %s",
              subscriptionDestination.getId(), webhook.getEndpoint());
      LOG.warn(message);
      setErrorStatus(attemptTime, 400, "UnknownHostException");
      throw new EventPublisherException(message);
    }
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget target = client.target(webhook.getEndpoint());
    target = addQueryParams(target, webhook.getQueryParams());
    return SecurityUtil.addHeaders(target, authHeaders);
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

  public static String decryptWebhookSecretKey(String encryptedSecretkey) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSecretkey = Fernet.getInstance().decryptIfApplies(encryptedSecretkey);
    }
    return encryptedSecretkey;
  }
}
