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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.events.subscription.channels.AddressDirectory;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;

final class Mailboxes implements AddressDirectory {
  @Override
  public Recipient ofUser(User user) {
    return EmailRecipient.fromUser(user);
  }

  @Override
  public Recipient ofTeam(Team team) {
    return EmailRecipient.fromTeam(team);
  }

  @Override
  public Set<Recipient> configured(SubscriptionAction action, SubscriptionDestination destination) {
    Set<Recipient> recipients = Set.of();
    if (action != null && !nullOrEmpty(action.getReceivers())) {
      recipients =
          action.getReceivers().stream()
              .map(EmailRecipient::new)
              .collect(Collectors.toUnmodifiableSet());
    }
    return recipients;
  }
}
