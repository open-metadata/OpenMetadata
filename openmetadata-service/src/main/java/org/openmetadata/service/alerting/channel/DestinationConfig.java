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

import jakarta.ws.rs.BadRequestException;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads a destination's configuration into the type its channel defines. It is the one place that
 * does, so a configuration is judged the same way whichever part of a channel reads it: strictly
 * when it is submitted, new or changed, and as it was accepted when it is stored. A stored one may
 * carry fields a release or another client allowed, and they are ignored, so a channel's newer
 * rules never stop a destination from being sent as it was configured.
 */
public final class DestinationConfig {
  private DestinationConfig() {}

  /** Throws a 400 that names what is wrong, as "Invalid {@code what} configuration: ...". */
  public static <T> T submitted(SubscriptionDestination destination, Class<T> type, String what) {
    try {
      return JsonUtils.convertValue(destination.getConfig(), type);
    } catch (IllegalArgumentException e) {
      throw new BadRequestException(
          String.format("Invalid %s configuration: %s", what, e.getMessage()));
    }
  }

  /**
   * Ignores the fields the type does not define. A value of the wrong kind, such as a list given as
   * text or a malformed address, is never guessed at: it throws, saying why.
   */
  public static <T> T stored(SubscriptionDestination destination, Class<T> type) {
    return JsonUtils.convertValueLenient(destination.getConfig(), type);
  }
}
