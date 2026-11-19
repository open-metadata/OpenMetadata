package org.openmetadata.service.migration.utils.v208;

import org.jdbi.v3.core.Handle;

/** Adds the pending MCP consent fields on MySQL, including after a partially applied migration. */
public final class McpConsentColumns {
  public static final String STEP_NAME = "mcpConsentColumns";

  private static final String COLUMN_EXISTS =
      """
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'mcp_pending_auth_requests'
        AND column_name = :columnName
      """;

  private McpConsentColumns() {}

  public static void addOnMySql(final Handle handle) {
    addIfMissing(handle, "consent_token_hash", 64);
    addIfMissing(handle, "consent_user_name", 256);
  }

  private static void addIfMissing(final Handle handle, final String columnName, final int size) {
    final boolean exists =
        handle.createQuery(COLUMN_EXISTS).bind("columnName", columnName).mapTo(Integer.class).one()
            > 0;
    if (!exists) {
      handle.execute(
          "ALTER TABLE mcp_pending_auth_requests ADD COLUMN %s VARCHAR(%d)"
              .formatted(columnName, size));
    }
  }
}
