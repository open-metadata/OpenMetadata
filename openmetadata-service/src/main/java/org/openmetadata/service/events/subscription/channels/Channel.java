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

  /**
   * Empty while the channel can send, otherwise the reason it cannot. Asked once for each event
   * before anything is looked up or rendered, and a channel that cannot send is not attempted,
   * which is not a delivery failure.
   */
  default Optional<String> unavailableBecause() {
    return Optional.empty();
  }

  /**
   * True for a channel that carries the file an alert produces, such as a report's PDF. Only such
   * a channel sends nothing when a required file could not be produced; the others send their
   * message as they always do.
   */
  default boolean acceptsFiles() {
    return false;
  }

  /**
   * How content becomes this channel's message. Every caller shares it, alert ticks and template
   * previews at the same time, so it must be safe to use from many threads. Empty for a channel
   * that sends the event as it is.
   */
  Optional<ChannelRenderer> renderer();

  /** Empty for a channel that delivers inside the server, such as the activity feed. */
  Optional<Transport> transport();

  AddressDirectory directory();

  ConfigRules configRules();

  Destination<ChangeEvent> publisher(EventSubscription alert, SubscriptionDestination destination);
}
