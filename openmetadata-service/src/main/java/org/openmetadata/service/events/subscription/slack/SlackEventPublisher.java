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

package org.openmetadata.service.events.subscription.slack;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.SLACK_WEBHOOK;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhook;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import java.util.List;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.Invocation;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SlackEventPublisher extends SubscriptionPublisher {
  private final MessageDecorator<SlackMessage> slackMessageFormatter = new SlackMessageDecorator();
  private final Webhook webhook;
  private Invocation.Builder target;
  private final Client client;
  private final CollectionDAO daoCollection;

  public SlackEventPublisher(EventSubscription eventSub, CollectionDAO dao) {
    super(eventSub);
    if (eventSub.getSubscriptionType() == SLACK_WEBHOOK) {
      this.daoCollection = dao;
      this.webhook = JsonUtils.convertValue(eventSub.getSubscriptionConfig(), Webhook.class);

      // Build Client
      client = getClient(eventSub.getTimeout(), eventSub.getReadTimeout());

      // Build Target
      if (webhook.getEndpoint() != null) {
        String slackWebhookURL = webhook.getEndpoint().toString();
        if (!CommonUtil.nullOrEmpty(slackWebhookURL)) {
          target = client.target(slackWebhookURL).request();
        }
      }
    } else {
      throw new IllegalArgumentException("Slack Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("Slack Webhook Publisher Started");
  }

  @Override
  public void onShutdownDelegate() {
    if (client != null) {
      client.close();
    }
  }

  @Override
  public void sendAlert(EventResource.EventList list) {
    for (ChangeEvent event : list.getData()) {
      try {
        SlackMessage slackMessage = slackMessageFormatter.buildMessage(event);
        List<Invocation.Builder> targets =
            getTargetsForWebhook(webhook, SLACK_WEBHOOK, client, daoCollection, event);
        if (target != null) {
          targets.add(target);
        }
        for (Invocation.Builder actionTarget : targets) {
          postWebhookMessage(this, actionTarget, slackMessage);
        }
      } catch (Exception e) {
        LOG.error("Failed to publish event {} to slack due to {} ", event, e.getMessage());
        throw new EventPublisherException(
            String.format("Failed to publish event %s to slack due to %s ", event, e.getMessage()));
      }
    }
  }
}
