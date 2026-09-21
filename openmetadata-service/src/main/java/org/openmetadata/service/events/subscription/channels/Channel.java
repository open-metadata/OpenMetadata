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

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.notifications.channels.ChannelRenderer;

/**
 * One way an alert reaches people or systems. A channel is registered under an id and composed of
 * parts that vary independently: how content becomes its message, where a user, a team or a
 * destination is reached, how a destination's configuration is judged, and how a message is sent.
 * Nothing outside the registrations decides anything by destination type.
 */
public interface Channel {
  /** The id it is registered under. A built-in channel uses the value of its destination type. */
  String id();

  /** Empty while the channel can send, otherwise the reason it cannot. */
  default Optional<String> unavailableBecause() {
    return Optional.empty();
  }

  default boolean carriesFiles() {
    return false;
  }

  /**
   * A renderer of its own for the caller, because one may read what it needs when it is built, as
   * the email renderer reads its envelope. Empty for a channel that sends the event as it is.
   */
  Optional<ChannelRenderer> newRenderer();

  /** Empty for a channel that delivers inside the server, such as the activity feed. */
  Optional<Transport> transport();

  AddressDirectory directory();

  ConfigRules configRules();

  Destination<ChangeEvent> publisher(EventSubscription alert, SubscriptionDestination destination);
}
