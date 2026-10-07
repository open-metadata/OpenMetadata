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

import jakarta.ws.rs.BadRequestException;
import java.util.Map;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/** A destination the user configures must carry that configuration. */
final class RequiredConfig {
  private RequiredConfig() {}

  static void require(SubscriptionDestination destination) {
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
