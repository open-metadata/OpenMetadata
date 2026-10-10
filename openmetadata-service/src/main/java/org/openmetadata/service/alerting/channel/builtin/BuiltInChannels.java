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

package org.openmetadata.service.alerting.channel.builtin;

import java.util.List;
import org.openmetadata.service.alerting.channel.Channel;
import org.openmetadata.service.alerting.channel.ChannelProvider;
import org.openmetadata.service.alerting.channel.Channels;
import org.openmetadata.service.alerting.channel.email.EmailChannel;
import org.openmetadata.service.alerting.channel.feed.FeedChannel;
import org.openmetadata.service.alerting.channel.gchat.GChatChannel;
import org.openmetadata.service.alerting.channel.slack.SlackChannel;
import org.openmetadata.service.alerting.channel.teams.TeamsChannel;
import org.openmetadata.service.alerting.channel.webhook.WebhookChannel;
import org.openmetadata.service.alerting.content.render.ChannelRenderer;

/**
 * The channels OpenMetadata ships, each registered under the value of its destination type and
 * built by its own package.
 */
public final class BuiltInChannels implements ChannelProvider {
  @Override
  public List<Channel> channels() {
    return List.of(
        EmailChannel.create(),
        SlackChannel.create(),
        TeamsChannel.create(),
        GChatChannel.create(),
        WebhookChannel.create(),
        FeedChannel.create());
  }

  /** How the channel whose rendering a template preview shows renders, which is HTML. */
  public static ChannelRenderer previewRenderer() {
    return Channels.of(EmailChannel.ID).flatMap(Channel::renderer).orElseThrow();
  }
}
