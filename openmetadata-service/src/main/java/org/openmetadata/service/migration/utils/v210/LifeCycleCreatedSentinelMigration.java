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

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Removes the placeholder {@code lifeCycle.created} that earlier ingestion runs stored for tables
 * whose source reported no creation time.
 *
 * <p>The database life-cycle ingestion mixin used to substitute {@code datetime.min} for a missing
 * creation time, which was stored as a large negative epoch (about -62135596800000) and rendered as
 * the year 0001. The mixin now leaves the aspect unset; this repairs the rows already written. Only
 * tables receive life-cycle data from that mixin, and no real table predates 1970, so any negative
 * creation timestamp is the placeholder. Re-running is a no-op.
 */
@Slf4j
public final class LifeCycleCreatedSentinelMigration {

  private LifeCycleCreatedSentinelMigration() {}

  public static void removeCreatedSentinel(
      final Handle handle, final ConnectionType connectionType) {
    final int repaired = handle.createUpdate(removeSentinelSql(connectionType)).execute();
    LOG.info("Removed the placeholder lifeCycle.created from {} tables", repaired);
  }

  private static String removeSentinelSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE table_entity SET json = JSON_REMOVE(json, '$.lifeCycle.created')"
          + " WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.lifeCycle.created.timestamp'))"
          + " AS SIGNED) < 0";
      case POSTGRES -> "UPDATE table_entity SET json = json #- '{lifeCycle,created}'"
          + " WHERE (json -> 'lifeCycle' -> 'created' ->> 'timestamp')::bigint < 0";
    };
  }
}
