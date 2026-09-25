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

package org.openmetadata.service.events.subscription.channels;

import java.util.Set;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/** Where a channel reaches a user or a team. Null means it has no address for them. */
public interface AddressDirectory {
  Recipient ofUser(User user);

  Recipient ofTeam(Team team);

  /** What the destination's own configuration names: its endpoint, or its list of receivers. */
  Set<Recipient> configured(SubscriptionAction action, SubscriptionDestination destination);

  /** For a channel whose destination is its own target, such as the activity feed. */
  AddressDirectory NONE =
      new AddressDirectory() {
        @Override
        public Recipient ofUser(User user) {
          return null;
        }

        @Override
        public Recipient ofTeam(Team team) {
          return null;
        }

        @Override
        public Set<Recipient> configured(
            SubscriptionAction action, SubscriptionDestination destination) {
          return Set.of();
        }
      };
}
