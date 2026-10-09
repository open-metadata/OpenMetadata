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

package org.openmetadata.service.events.subscription.channels.builtin;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.ACTIVITY_FEED;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.G_CHAT;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.MS_TEAMS;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.List;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.alerting.audience.AddressDirectory;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.feed.ActivityStreamPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.MSTeamsPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackEventPublisher;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.ChannelProvider;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;
import org.openmetadata.service.notifications.channels.ChannelRenderer;
import org.openmetadata.service.notifications.channels.email.EmailHtmlRenderer;
import org.openmetadata.service.notifications.channels.gchat.GChatCardRenderer;
import org.openmetadata.service.notifications.channels.slack.SlackBlockKitRenderer;
import org.openmetadata.service.notifications.channels.teams.TeamsAdaptiveCardRenderer;

/**
 * The channels OpenMetadata ships, each registered under the value of its destination type. This
 * package is the only place that names a destination type.
 */
public final class BuiltInChannels implements ChannelProvider {
  @Override
  public List<Channel> channels() {
    return List.of(email(), slack(), msTeams(), gChat(), webhook(), activityFeed(), workflows());
  }

  /** How the channel whose rendering a template preview shows renders, which is HTML. */
  public static ChannelRenderer previewRenderer() {
    return Channels.of(EMAIL.value()).flatMap(Channel::renderer).orElseThrow();
  }

  private static Channel email() {
    return new BuiltInChannel(
        EMAIL.value(),
        EmailHtmlRenderer::new,
        new SmtpTransport(),
        new Mailboxes(),
        new EmailConfigRules(),
        (alert, destination, renderer) ->
            new EmailPublisher(alert, destination, EmailConfigRules.stored(destination), renderer));
  }

  private static Channel slack() {
    return new BuiltInChannel(
        SLACK.value(),
        SlackBlockKitRenderer::create,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getSlack),
        new WebhookConfigRules(),
        (alert, destination, renderer) ->
            new SlackEventPublisher(
                alert, destination, WebhookConfigRules.stored(destination), renderer));
  }

  private static Channel msTeams() {
    return new BuiltInChannel(
        MS_TEAMS.value(),
        TeamsAdaptiveCardRenderer::create,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getMsTeams),
        new WebhookConfigRules(),
        (alert, destination, renderer) ->
            new MSTeamsPublisher(
                alert, destination, WebhookConfigRules.stored(destination), renderer));
  }

  private static Channel gChat() {
    return new BuiltInChannel(
        G_CHAT.value(),
        GChatCardRenderer::create,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getgChat),
        new WebhookConfigRules(),
        (alert, destination, renderer) ->
            new GChatPublisher(
                alert, destination, WebhookConfigRules.stored(destination), renderer));
  }

  private static Channel webhook() {
    return new BuiltInChannel(
        WEBHOOK.value(),
        null,
        HttpWebhookTransport.shared(),
        new WebhookAddresses(SubscriptionConfig::getGeneric),
        new SecretWebhookConfigRules(),
        (alert, destination, renderer) ->
            new GenericPublisher(alert, destination, WebhookConfigRules.stored(destination)));
  }

  private static Channel activityFeed() {
    return new BuiltInChannel(
        ACTIVITY_FEED.value(),
        null,
        null,
        AddressDirectory.NONE,
        new NoConfigRules(),
        (alert, destination, renderer) -> new ActivityStreamPublisher(alert, destination));
  }

  private static Channel workflows() {
    return new BuiltInChannel(
        GOVERNANCE_WORKFLOW_CHANGE_EVENT.value(),
        null,
        null,
        AddressDirectory.NONE,
        new NoConfigRules(),
        (alert, destination, renderer) -> new WorkflowEventConsumer(alert, destination));
  }
}
