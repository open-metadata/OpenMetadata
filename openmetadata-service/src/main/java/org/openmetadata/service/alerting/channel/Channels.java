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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.ServiceLoader;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * Every channel this server can send through, by id. Channels are registered, never enumerated:
 * whatever a {@link ChannelProvider} on the classpath lists is here, and a destination whose
 * channel is not registered is not sent anywhere else instead.
 */
@Slf4j
public final class Channels {
  private static final Map<String, Channel> REGISTERED = load();

  private Channels() {}

  public static Optional<Channel> of(String id) {
    return Optional.ofNullable(REGISTERED.get(id));
  }

  /** The channel that serves the destination, as {@link ChannelResolution} decides it. */
  public static Channel required(SubscriptionDestination destination) {
    ChannelResolution served = ChannelResolution.of(destination);
    return served
        .channel()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "No channel " + served.channelId() + " is registered on this server"));
  }

  /** Closes what the transports hold, once, when the server shuts down. */
  public static void closeTransports() {
    REGISTERED.values().stream()
        .map(Channel::transport)
        .flatMap(Optional::stream)
        .distinct()
        .forEach(Transport::close);
  }

  private static Map<String, Channel> load() {
    Map<String, Channel> channels = index(ServiceLoader.load(ChannelProvider.class));
    LOG.info("Alert channels registered: {}", channels.keySet());
    return channels;
  }

  static Map<String, Channel> index(Iterable<ChannelProvider> providers) {
    Map<String, Channel> channels = new LinkedHashMap<>();
    for (ChannelProvider provider : providers) {
      provider.channels().forEach(channel -> register(channels, channel));
    }
    return Map.copyOf(channels);
  }

  private static void register(Map<String, Channel> channels, Channel channel) {
    Channel other = channels.putIfAbsent(channel.id(), channel);
    if (other != null) {
      throw new IllegalStateException(
          "Two channels are registered as "
              + channel.id()
              + ": "
              + other.getClass().getName()
              + " and "
              + channel.getClass().getName());
    }
  }
}
