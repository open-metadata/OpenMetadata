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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/** What a destination's configuration holds that must not be stored in the clear. */
public final class DestinationSecrets {

  private DestinationSecrets() {}

  /**
   * Encrypts, in place, the secrets each destination's channel keeps encrypted, and gives a
   * destination without an id one. A destination whose channel is not registered is left as it is.
   */
  public static List<SubscriptionDestination> encrypt(List<SubscriptionDestination> destinations) {
    List<SubscriptionDestination> result = new ArrayList<>();
    destinations.forEach(
        destination -> {
          if (nullOrEmpty(destination.getId())) {
            destination.withId(UUID.randomUUID());
          }
          ChannelResolution.of(destination)
              .channel()
              .ifPresent(channel -> channel.configRules().encryptSecrets(destination));
          result.add(destination);
        });
    return result;
  }
}
