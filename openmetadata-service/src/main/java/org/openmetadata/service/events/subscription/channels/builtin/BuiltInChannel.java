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

import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.subscription.channels.AddressDirectory;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.ConfigRules;
import org.openmetadata.service.events.subscription.channels.Transport;
import org.openmetadata.service.notifications.channels.ChannelRenderer;

/** A channel put together from its parts. */
record BuiltInChannel(
    String id,
    Supplier<ChannelRenderer> rendererOrNull,
    Transport transportOrNull,
    AddressDirectory directory,
    ConfigRules configRules,
    BiFunction<EventSubscription, SubscriptionDestination, Destination<ChangeEvent>> publishers)
    implements Channel {

  @Override
  public Optional<ChannelRenderer> newRenderer() {
    return Optional.ofNullable(rendererOrNull).map(Supplier::get);
  }

  @Override
  public Optional<Transport> transport() {
    return Optional.ofNullable(transportOrNull);
  }

  @Override
  public Destination<ChangeEvent> publisher(
      EventSubscription alert, SubscriptionDestination destination) {
    return publishers.apply(alert, destination);
  }
}
