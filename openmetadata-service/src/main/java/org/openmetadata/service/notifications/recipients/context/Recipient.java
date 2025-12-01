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

/**
 * Base class for notification recipients.
 *
 * Subclasses implement different recipient types: EmailRecipient for email notifications and
 * WebhookRecipient for webhook-based notifications (Slack, MS Teams, Google Chat, etc.).
 */
@Slf4j
public abstract sealed class Recipient permits EmailRecipient, WebhookRecipient {

  /**
   * Create a recipient from a user based on notification type.
   *
   * @param user the user to create a recipient from
   * @param notificationType the notification type
   * @return an EmailRecipient or WebhookRecipient instance
   */
  public static Recipient fromUser(
      User user, SubscriptionDestination.SubscriptionType notificationType) {
    if (notificationType == SubscriptionDestination.SubscriptionType.EMAIL) {
      return EmailRecipient.fromUser(user);
    }
    return WebhookRecipient.fromUser(user, notificationType);
  }

  /**
   * Create a recipient from a team based on notification type.
   *
   * @param team the team to create a recipient from
   * @param notificationType the notification type
   * @return an EmailRecipient or WebhookRecipient instance
   */
  public static Recipient fromTeam(
      Team team, SubscriptionDestination.SubscriptionType notificationType) {
    if (notificationType == SubscriptionDestination.SubscriptionType.EMAIL) {
      return EmailRecipient.fromTeam(team);
    }
    return WebhookRecipient.fromTeam(team, notificationType);
  }
}
