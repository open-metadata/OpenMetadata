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

package org.openmetadata.service.notifications.recipients.context;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.events.subscription.channels.Channels;

/**
 * Base class for notification recipients.
 *
 * Subclasses implement different recipient types: EmailRecipient for email notifications and
 * WebhookRecipient for webhook-based notifications (Slack, MS Teams, Google Chat, etc.).
 */
@Slf4j
public abstract sealed class Recipient permits EmailRecipient, WebhookRecipient {

  /** Where the destination's channel reaches this user, or null when it has no address. */
  public static Recipient fromUser(User user, SubscriptionDestination destination) {
    return Channels.required(destination).directory().ofUser(user);
  }

  /** Where the destination's channel reaches this team, or null when it has no address. */
  public static Recipient fromTeam(Team team, SubscriptionDestination destination) {
    return Channels.required(destination).directory().ofTeam(team);
  }
}
