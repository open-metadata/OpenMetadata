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

package org.openmetadata.service.alerting.channel;

import com.google.common.base.Suppliers;
import java.util.Optional;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.audience.AddressDirectory;
import org.openmetadata.service.alerting.content.render.ChannelRenderer;

/**
 * A channel put together from its parts: how content becomes its message, where it reaches people,
 * how a destination's configuration is judged, how a message leaves the server, and the publisher
 * of each destination. Every channel OpenMetadata ships is one; a plugin may compose its own.
 */
public record ComposedChannel(
    String id,
    Supplier<ChannelRenderer> rendererOrNull,
    Transport transportOrNull,
    AddressDirectory directory,
    ConfigRules configRules,
    Publishers publishers)
    implements Channel {

  /** Builds a destination's publisher, handed the channel's renderer, or null when it has none. */
  @FunctionalInterface
  public interface Publishers {
    Destination<ChangeEvent> of(
        EventSubscription alert, SubscriptionDestination destination, ChannelRenderer renderer);
  }

  // Built once, when first asked for: the email renderer reads its envelope as it is built.
  public ComposedChannel {
    rendererOrNull = rendererOrNull == null ? null : Suppliers.memoize(rendererOrNull::get);
  }

  @Override
  public Optional<ChannelRenderer> renderer() {
    return Optional.ofNullable(rendererOrNull).map(Supplier::get);
  }

  @Override
  public Optional<Transport> transport() {
    return Optional.ofNullable(transportOrNull);
  }

  @Override
  public Optional<String> unavailableBecause() {
    return transport().flatMap(Transport::unavailableBecause);
  }

  @Override
  public Destination<ChangeEvent> publisher(
      EventSubscription alert, SubscriptionDestination destination) {
    return publishers.of(alert, destination, renderer().orElse(null));
  }
}
