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

package org.openmetadata.service.migration.utils.v210;

import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * How 1.13 and 2.0 read a destination's configuration when they built its destination, kept as it
 * was: strictly as its type defines it, so a field the type does not define was refused. The
 * server reads a stored configuration leniently now, so only this read can tell which alerts those
 * releases could not build.
 */
final class PreviousReleaseConfigRead {

  private PreviousReleaseConfigRead() {}

  /** Throws, as "Invalid {@code what} configuration: ...", when those releases refused it. */
  static <T> T read(SubscriptionDestination destination, Class<T> type, String what) {
    try {
      return JsonUtils.convertValue(destination.getConfig(), type);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          String.format("Invalid %s configuration: %s", what, e.getMessage()));
    }
  }
}
