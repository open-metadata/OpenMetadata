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

package org.openmetadata.service.alerting.channel.webhook;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.alerting.channel.ComposedChannel;
import org.openmetadata.service.events.subscription.channels.Channel;

/** The raw change event, posted as JSON to an endpoint, with the authentication it names. */
public final class WebhookChannel {
  private WebhookChannel() {}

  public static Channel create() {
    return new ComposedChannel(
        WEBHOOK.value(),
        null,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getGeneric),
        new SecretWebhookConfigRules(),
        (alert, destination, renderer) ->
            new GenericPublisher(alert, destination, WebhookConfigRules.stored(destination)));
  }
}
