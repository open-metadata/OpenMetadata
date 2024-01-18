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

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.MS_TEAMS_WEBHOOK;
import static org.openmetadata.service.util.SubscriptionUtil.getClient;
import static org.openmetadata.service.util.SubscriptionUtil.getTargetsForWebhook;
import static org.openmetadata.service.util.SubscriptionUtil.postWebhookMessage;

import java.util.List;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.Invocation;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.formatter.decorators.MSTeamsMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class MSTeamsPublisher extends AbstractEventConsumer {
  private final MessageDecorator<TeamsMessage> teamsMessageFormatter =
      new MSTeamsMessageDecorator();
  private Webhook webhook;
  private Invocation.Builder target;
  private Client client;

  @Override
  protected void doInit(JobExecutionContext context) {
    if (eventSubscription.getSubscriptionType() == MS_TEAMS_WEBHOOK) {
      this.webhook =
          JsonUtils.convertValue(eventSubscription.getSubscriptionConfig(), Webhook.class);

      // Build Client
      client = getClient(eventSubscription.getTimeout(), eventSubscription.getReadTimeout());

      // Build Target
      if (webhook.getEndpoint() != null) {
        String msTeamsWebhookURL = webhook.getEndpoint().toString();
        if (!CommonUtil.nullOrEmpty(msTeamsWebhookURL)) {
          target = client.target(msTeamsWebhookURL).request();
        }
      }
    } else {
      throw new IllegalArgumentException("MsTeams Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void sendAlert(ChangeEvent event) throws EventPublisherException {
    try {
      TeamsMessage teamsMessage = teamsMessageFormatter.buildMessage(event);
      List<Invocation.Builder> targets =
          getTargetsForWebhook(webhook, MS_TEAMS_WEBHOOK, client, event);
      if (target != null) {
        targets.add(target);
      }
      for (Invocation.Builder actionTarget : targets) {
        postWebhookMessage(this, actionTarget, teamsMessage);
      }
    } catch (Exception e) {
      String message =
          CatalogExceptionMessage.eventPublisherFailedToPublish(
              MS_TEAMS_WEBHOOK, event, e.getMessage());
      LOG.error(message);
      throw new EventPublisherException(message, event);
    }
  }

  @Override
  public void stop() {
    if (null != client) {
      client.close();
    }
  }
}
