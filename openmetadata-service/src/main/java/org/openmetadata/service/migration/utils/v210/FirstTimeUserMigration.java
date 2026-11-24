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
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Sets {@code isFirstTimeUser} to false for every user who signed in or was active before the
 * upgrade (ADR:2026-10-26-first-time-user-flag-is-stored-on-the-user).
 *
 * <p>Until 2.1.0 first-time access was remembered only in browser localStorage, so the server has
 * no record of it. A user with a login or activity time is not a first-time user. Public-client SSO
 * and token sessions set only {@code lastActivityTime}, so both are read. Walks the user ids in
 * batches and skips users who already have the field, so an interrupted run resumes.
 */
@Slf4j
public final class FirstTimeUserMigration {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "first-time-user-backfill";

  private static final String USER_TABLE = "user_entity";
  private static final String IDS_BIND = "ids";

  private FirstTimeUserMigration() {}

  public static void backfillFirstTimeUser(
      final Handle handle, final ConnectionType connectionType) {
    final String sql = backfillSql(connectionType);
    final int backfilled =
        IdBatches.fold(
            handle,
            USER_TABLE,
            0,
            (updated, batch) ->
                updated + handle.createUpdate(sql).bindList(IDS_BIND, batch).execute());
    LOG.info("Marked {} existing users as not first-time users", backfilled);
  }

  private static String backfillSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE user_entity SET json = JSON_SET(json, '$.isFirstTimeUser', false)"
          + " WHERE id IN (<ids>) AND COALESCE(lastLoginTime, lastActivityTime) IS NOT NULL"
          + " AND JSON_EXTRACT(json, '$.isFirstTimeUser') IS NULL";
      case POSTGRES -> "UPDATE user_entity SET json = jsonb_set(json, '{isFirstTimeUser}', 'false')"
          + " WHERE id IN (<ids>) AND COALESCE(lastLoginTime, lastActivityTime) IS NOT NULL"
          + " AND json->'isFirstTimeUser' IS NULL";
    };
  }
}
