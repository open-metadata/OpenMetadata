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

package org.openmetadata.service.util;

import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Write-time rule for {@link LifeCycle} timestamps.
 *
 * <p>A timestamp before the Unix epoch is the year-0001 placeholder older ingestion clients send for
 * a source that reported no time. It is dropped on every write so the 2.1.0 cleanup migration stays
 * in force for clients that still send it (ADR:2026-10-29-lifecycle-timestamps-before-the-epoch-are-dropped-on-write).
 */
public final class LifeCycles {

  static final long EARLIEST_RECORDED_TIMESTAMP = 0L;

  private LifeCycles() {}

  /** Returns the life cycle without placeholder aspects, or null when none remains. */
  public static LifeCycle withoutPlaceholderTimestamps(final LifeCycle lifeCycle) {
    LifeCycle result = null;
    if (lifeCycle != null) {
      lifeCycle.setCreated(recordedOrNull(lifeCycle.getCreated()));
      lifeCycle.setUpdated(recordedOrNull(lifeCycle.getUpdated()));
      lifeCycle.setAccessed(recordedOrNull(lifeCycle.getAccessed()));
      result = hasAnyAspect(lifeCycle) ? lifeCycle : null;
    }
    return result;
  }

  /**
   * Returns the patched life cycle without placeholder aspects. A patch that carried nothing but
   * placeholders returns a copy of the stored life cycle instead, so a client that replaces the
   * whole life cycle with the placeholder leaves the recorded times in place.
   */
  public static LifeCycle withoutPlaceholderTimestamps(
      final LifeCycle patched, final LifeCycle stored) {
    final LifeCycle recorded = withoutPlaceholderTimestamps(patched);
    final boolean onlyPlaceholders = patched != null && recorded == null;
    return onlyPlaceholders && stored != null
        ? JsonUtils.deepCopy(stored, LifeCycle.class)
        : recorded;
  }

  private static AccessDetails recordedOrNull(final AccessDetails details) {
    return isPlaceholder(details) ? null : details;
  }

  private static boolean isPlaceholder(final AccessDetails details) {
    return details != null
        && details.getTimestamp() != null
        && details.getTimestamp() < EARLIEST_RECORDED_TIMESTAMP;
  }

  private static boolean hasAnyAspect(final LifeCycle lifeCycle) {
    return lifeCycle.getCreated() != null
        || lifeCycle.getUpdated() != null
        || lifeCycle.getAccessed() != null;
  }
}
