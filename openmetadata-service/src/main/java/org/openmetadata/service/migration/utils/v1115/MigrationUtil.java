package org.openmetadata.service.migration.utils.v1115;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  /**
   * Removes deprecated samlConfiguration.idp.authorityUrl from the persisted authenticationConfiguration
   * in openmetadata_settings. This is needed because the SAML schema uses additionalProperties:false
   * and older persisted configs may still contain authorityUrl.
   *
   * Idempotent:
   * - Does nothing if samlConfiguration/idp/authorityUrl doesn't exist.
   * - Works for both MySQL and Postgres.
   */
  public static void removeDeprecatedSamlAuthorityUrl(
      Handle handle, ConnectionType connectionType) {
    try {
      LOG.info(
          "Running migration: remove deprecated samlConfiguration.idp.authorityUrl from authenticationConfiguration");

      String updateQuery =
          switch (connectionType) {
            case MYSQL -> """
                                UPDATE openmetadata_settings
                                SET json = JSON_REMOVE(json, '$.samlConfiguration.idp.authorityUrl')
                                WHERE configType = 'authenticationConfiguration'
                                  AND JSON_CONTAINS_PATH(json, 'one', '$.samlConfiguration.idp.authorityUrl')
                                """;

            case POSTGRES -> """
                                UPDATE openmetadata_settings
                                SET json = jsonb_set(
                                    json::jsonb,
                                    '{samlConfiguration,idp}',
                                    (json::jsonb #> '{samlConfiguration,idp}') - 'authorityUrl',
                                    true
                                )
                                WHERE configType = 'authenticationConfiguration'
                                  AND (json::jsonb #> '{samlConfiguration,idp}') ? 'authorityUrl'
                                """;
          };

      int updated = handle.createUpdate(updateQuery).execute();
      LOG.info("Removed deprecated authorityUrl from {} row(s)", updated);

    } catch (Exception e) {
      LOG.error("Failed to remove deprecated SAML authorityUrl: {}", e.getMessage(), e);
      throw new RuntimeException("Failed migration: removeDeprecatedSamlAuthorityUrl", e);
    }
  }
}
