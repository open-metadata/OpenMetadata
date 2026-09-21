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

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * Which channel serves a destination: the one its {@code channel} field names, otherwise the one
 * its alert's consumer declares for the destination's type, otherwise the one registered for that
 * type. A named or declared channel that is not registered on this server is never replaced by the
 * type's channel, because a destination meant for one channel must not be sent through another.
 *
 * @param channelId the id the destination resolved to, registered or not
 * @param channel empty when that id is not registered on this server
 */
@Slf4j
public record ChannelResolution(String channelId, Optional<Channel> channel) {
  private static final int REMEMBERED_DESTINATIONS = 10_000;
  private static final Set<String> LOGGED = ConcurrentHashMap.newKeySet();

  /**
   * @param declaredByConsumer channel id by destination type value. Deprecated from the start: it
   *     exists only until destinations name their channel themselves.
   */
  public static ChannelResolution of(
      SubscriptionDestination destination, Map<String, String> declaredByConsumer) {
    String type = destination.getType().value();
    String named = destination.getChannel();
    String declared = declaredByConsumer.get(type);
    String channelId = firstNonNull(named, declared, type);
    ChannelResolution resolution = new ChannelResolution(channelId, Channels.of(channelId));
    logOnce(destination, resolution, resolvedBy(named, declared));
    return resolution;
  }

  private static String firstNonNull(String named, String declared, String type) {
    String declaredOrType = declared == null ? type : declared;
    return named == null ? declaredOrType : named;
  }

  private static String resolvedBy(String named, String declared) {
    String declaredOrType = declared == null ? "its type" : "its alert's consumer";
    return named == null ? declaredOrType : "its channel field";
  }

  private static void logOnce(
      SubscriptionDestination destination, ChannelResolution resolution, String resolvedBy) {
    if (LOGGED.size() >= REMEMBERED_DESTINATIONS) {
      LOGGED.clear();
    }
    if (LOGGED.add(destination.getId() + ":" + resolution.channelId())) {
      LOG.info(
          "Destination {} is served by channel {} (resolved by {}, registered: {})",
          destination.getId(),
          resolution.channelId(),
          resolvedBy,
          resolution.channel().isPresent());
    }
  }
}
