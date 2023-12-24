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

package org.openmetadata.service.events.subscription.generic;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.GENERIC_WEBHOOK;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhook;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import java.net.UnknownHostException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.Invocation;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GenericPublisher extends SubscriptionPublisher {
  private final Client client;
  private final Webhook webhook;
  private final CollectionDAO daoCollection;

  public GenericPublisher(EventSubscription eventSub, CollectionDAO dao) {
    super(eventSub);
    if (eventSub.getSubscriptionType() == GENERIC_WEBHOOK) {
      this.daoCollection = dao;
      this.webhook = JsonUtils.convertValue(eventSub.getSubscriptionConfig(), Webhook.class);

      // Build Client
      client = getClient(eventSub.getTimeout(), eventSub.getReadTimeout());
    } else {
      throw new IllegalArgumentException(
          "GenericWebhook Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("Generic Webhook Publisher Started");
  }

  @Override
  public void onShutdownDelegate() {
    if (client != null) {
      client.close();
    }
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
  }

  @Override
  public void sendAlert(EventResource.EventList list) throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    try {
      // Post Message to default
      String json = JsonUtils.pojoToJson(list);
      if (webhook.getEndpoint() != null) {
        if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
          String hmac = "sha256=" + CommonUtil.calculateHMAC(webhook.getSecretKey(), json);
          postWebhookMessage(this, getTarget().header(RestUtil.SIGNATURE_HEADER, hmac), json);
        } else {
          postWebhookMessage(this, getTarget(), json);
        }
      }

      // Post to Generic Webhook with Actions
      for (ChangeEvent event : list.getData()) {
        String eventJson = JsonUtils.pojoToJson(event);
        List<Invocation.Builder> targets =
            getTargetsForWebhook(webhook, GENERIC_WEBHOOK, client, daoCollection, event);
        for (Invocation.Builder actionTarget : targets) {
          postWebhookMessage(this, actionTarget, eventJson);
        }
      }
    } catch (Exception ex) {
      Throwable cause = ex.getCause();
      if (cause != null && cause.getClass() == UnknownHostException.class) {
        LOG.warn(
            "Invalid webhook {} endpoint {}", eventSubscription.getName(), webhook.getEndpoint());
        setErrorStatus(attemptTime, 400, "UnknownHostException");
      } else {
        LOG.debug("Exception occurred while publishing webhook", ex);
      }
    }
  }
}
