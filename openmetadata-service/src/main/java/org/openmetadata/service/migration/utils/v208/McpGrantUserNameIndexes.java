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

package org.openmetadata.service.migration.utils.v208;

import java.util.List;
import org.jdbi.v3.core.Handle;

/**
 * Indexes the user name of the MySQL MCP grant tables, so deleting a user locks only that user's
 * grants instead of scanning and locking everyone's (OAuthRefreshTokenDAO.revokeAllGrantsOfUser).
 * PostgreSQL locks only the rows a statement changes, so it needs none. Pending sign-ins are left
 * out: they are few and short-lived, and a 2.0.x database may not have their consent column yet
 * when this runs.
 *
 * <p>The refresh-token index also covers {@code revoked}. Rotation leaves every old token of a
 * user revoked, so for a user who refreshes often a plain user-name index looks costlier than the
 * revoked index, and MySQL would take that one again: the plan that deadlocked.
 *
 * <p>Runs from the Java migration per
 * ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration. 2.1.0 runs it again for a
 * database that recorded 2.0.8 before this step was added to it. Each index is created only when
 * missing.
 */
public final class McpGrantUserNameIndexes {
  public static final String STEP_NAME = "mcpGrantUserNameIndexes";

  private record UserNameIndex(String table, String columns, String name) {}

  private static final List<UserNameIndex> INDEXES =
      List.of(
          new UserNameIndex(
              "oauth_authorization_codes", "user_name", "idx_oauth_authz_codes_user_name"),
          new UserNameIndex(
              "oauth_refresh_tokens",
              "user_name, revoked",
              "idx_oauth_refresh_tokens_user_name_revoked"),
          new UserNameIndex(
              "oauth_access_tokens", "user_name", "idx_oauth_access_tokens_user_name"));

  private static final String INDEX_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :name
      """;

  private McpGrantUserNameIndexes() {}

  public static void addOnMySql(final Handle handle) {
    INDEXES.stream()
        .filter(index -> !exists(handle, index))
        .forEach(
            index ->
                // InnoDB builds a secondary index in place and keeps accepting writes meanwhile.
                handle.execute(
                    String.format(
                        "CREATE INDEX %s ON %s (%s)",
                        index.name(), index.table(), index.columns())));
  }

  private static boolean exists(final Handle handle, final UserNameIndex index) {
    return handle
            .createQuery(INDEX_EXISTS)
            .bind("table", index.table())
            .bind("name", index.name())
            .mapTo(Integer.class)
            .one()
        > 0;
  }
}
