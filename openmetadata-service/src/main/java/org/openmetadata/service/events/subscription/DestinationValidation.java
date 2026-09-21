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

package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.subscription.channels.ChannelResolution;

/**
 * Checks a destination with the channel that serves it, when the destination is new or was
 * changed, on every path that saves an alert. A stored destination that a channel's newer rules
 * would reject is left alone, so an alert can still be renamed; it is sent as configured, and a
 * send that fails is recorded like any other.
 */
public final class DestinationValidation {
  private static final List<String> NOT_PART_OF_WHAT_A_USER_CONFIGURES =
      List.of("id", "statusDetails");

  private DestinationValidation() {}

  public static void ofANewAlert(EventSubscription alert) {
    Map<String, String> declared = AbstractEventConsumer.declaredChannelsOf(alert);
    listOrEmpty(alert.getDestinations()).forEach(destination -> validate(destination, declared));
  }

  public static void ofWhatChanged(EventSubscription original, EventSubscription updated) {
    Map<String, String> declared = AbstractEventConsumer.declaredChannelsOf(updated);
    List<JsonNode> stored =
        listOrEmpty(original.getDestinations()).stream()
            .map(DestinationValidation::whatAUserConfigures)
            .toList();
    listOrEmpty(updated.getDestinations()).stream()
        .filter(destination -> !stored.contains(whatAUserConfigures(destination)))
        .forEach(destination -> validate(destination, declared));
  }

  /** Throws a 400 that says what is wrong with the destination. */
  public static void validate(SubscriptionDestination destination, Map<String, String> declared) {
    boolean configuredByTheUser =
        destination.getCategory() == null
            || destination.getCategory() == SubscriptionDestination.SubscriptionCategory.EXTERNAL;
    if (configuredByTheUser) {
      requireAConfiguration(destination);
      ChannelResolution.of(destination, declared)
          .channel()
          .ifPresent(channel -> channel.configRules().validate(destination));
    }
  }

  private static void requireAConfiguration(SubscriptionDestination destination) {
    Object config = destination.getConfig();
    if (config == null) {
      throw new BadRequestException(
          String.format(
              "Destination configuration is required for %s type", destination.getType()));
    }
    if (config instanceof Map<?, ?> map && map.isEmpty()) {
      throw new BadRequestException(
          String.format("Destination configuration is empty for %s type", destination.getType()));
    }
  }

  // Compared by content, never by id: a PUT carries no ids, so every destination of one gets a
  // new id, and that alone must not make an unchanged destination look new.
  private static JsonNode whatAUserConfigures(SubscriptionDestination destination) {
    ObjectNode content = (ObjectNode) JsonUtils.valueToTree(destination);
    content.remove(NOT_PART_OF_WHAT_A_USER_CONFIGURES);
    return content;
  }
}
