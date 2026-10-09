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

import jakarta.ws.rs.BadRequestException;
import java.util.Map;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/** What a channel expects of a destination's configuration. */
public interface ConfigRules {
  /** For a channel whose destination needs no configuration, such as the activity feed. */
  ConfigRules NONE =
      new ConfigRules() {
        @Override
        public void validate(SubscriptionDestination destination) {
          // Nothing to judge.
        }

        @Override
        public SubscriptionAction receiversOf(SubscriptionDestination destination) {
          return null;
        }
      };

  /**
   * Runs for every new or changed destination, whatever its category. Throws a 400 naming what is
   * wrong.
   */
  void validate(SubscriptionDestination destination);

  /** The configured receivers, or null for a channel that has none. */
  SubscriptionAction receiversOf(SubscriptionDestination destination);

  /** Encrypts, in place, whatever the configuration holds that must not be stored in the clear. */
  default void encryptSecrets(SubscriptionDestination destination) {}

  /**
   * A destination whose configuration names its receivers: External, or one saved before
   * destinations had a category. The others find their receivers from the event.
   */
  static boolean configuredByTheUser(SubscriptionDestination destination) {
    return destination.getCategory() == null
        || destination.getCategory() == SubscriptionDestination.SubscriptionCategory.EXTERNAL;
  }

  /** A destination the user configures must carry that configuration. Throws a 400 otherwise. */
  static void requireConfiguration(SubscriptionDestination destination) {
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
}
