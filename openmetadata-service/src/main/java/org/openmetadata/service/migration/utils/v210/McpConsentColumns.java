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

import org.jdbi.v3.core.Handle;

/**
 * Adds the MCP consent columns to mcp_pending_auth_requests on MySQL. PostgreSQL adds them in the
 * 2.1.0 schemaChanges.sql with IF NOT EXISTS.
 *
 * <p>The consent feature ships in 2.1.0, so 2.1.0 adds its columns: every database upgrading to
 * 2.1 runs 2.1.0, whichever 2.0.x it comes from. Runs from the Java migration per
 * ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration: each column is added only when
 * missing, so a database that already has them is left as it is.
 * ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip
 */
public final class McpConsentColumns {
  /** Kept from the step's first name, so a marker already recorded by runOnce still matches. */
  public static final String STEP_NAME = "mcpPendingAuthConsentColumns";

  private static final String CONSENT_TOKEN_HASH_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'mcp_pending_auth_requests'
        AND column_name = 'consent_token_hash'
      """;
  private static final String ADD_CONSENT_TOKEN_HASH =
      "ALTER TABLE mcp_pending_auth_requests ADD COLUMN consent_token_hash VARCHAR(64)";
  private static final String CONSENT_USER_NAME_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'mcp_pending_auth_requests'
        AND column_name = 'consent_user_name'
      """;
  private static final String ADD_CONSENT_USER_NAME =
      "ALTER TABLE mcp_pending_auth_requests ADD COLUMN consent_user_name VARCHAR(256)";

  private McpConsentColumns() {}

  public static void addOnMySql(final Handle handle) {
    executeUnless(handle, CONSENT_TOKEN_HASH_EXISTS, ADD_CONSENT_TOKEN_HASH);
    executeUnless(handle, CONSENT_USER_NAME_EXISTS, ADD_CONSENT_USER_NAME);
  }

  private static void executeUnless(final Handle handle, final String exists, final String ddl) {
    final boolean alreadyDone = handle.createQuery(exists).mapTo(Integer.class).one() > 0;
    if (!alreadyDone) {
      handle.execute(ddl);
    }
  }
}
