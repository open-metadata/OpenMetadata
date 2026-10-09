/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.alerting.channel.teams;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.MS_TEAMS;

import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.alerting.channel.ComposedChannel;
import org.openmetadata.service.alerting.channel.webhook.HttpWebhookTransport;
import org.openmetadata.service.alerting.channel.webhook.WebhookAddresses;
import org.openmetadata.service.alerting.channel.webhook.WebhookConfigRules;
import org.openmetadata.service.events.subscription.channels.Channel;

/** Microsoft Teams messages, posted through an incoming webhook as adaptive cards. */
public final class TeamsChannel {
  private TeamsChannel() {}

  public static Channel create() {
    return new ComposedChannel(
        MS_TEAMS.value(),
        TeamsAdaptiveCardRenderer::create,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getMsTeams),
        new WebhookConfigRules(),
        (alert, destination, renderer) ->
            new MSTeamsPublisher(
                alert, destination, WebhookConfigRules.stored(destination), renderer));
  }
}
