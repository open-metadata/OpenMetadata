package org.openmetadata.service.migration.utils.v159;

import jakarta.json.JsonObject;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {

  // Just list status to make this ignore the new `limits` extension if it ever runs again
  private static final String SELECT_ALL_APP_EXTENSION_TIME_SERIES =
      "SELECT appId, json FROM apps_extension_time_series where extension = 'status'";
  private static final String UPDATE_MYSQL_APP_EXTENSION =
      "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.appName', :appName) WHERE appId = :appId AND extension = 'status'";
  private static final String UPDATE_PG_APP_EXTENSION =
      "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{appName}', to_jsonb(:appName)) WHERE appId = :appId AND extension = 'status'";

  // We'll list the entries in app_extension_time_series, clean those whose appId
  // is not installed, and for those that appId matches from installed Apps, we'll
  // add the appName to the JSON data.
  // Note that we only want to clean up old status data.
  public static void addAppExtensionName(
      Handle handle,
      CollectionDAO daoCollection,
      AuthenticationConfiguration config,
      boolean postgres) {
    LOG.info("Migrating app extension name...");
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

    try {
      handle
          .createQuery(SELECT_ALL_APP_EXTENSION_TIME_SERIES)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  UUID appId = UUID.fromString(row.get("appid").toString());
                  // Ignore if this has already been migrated
                  JsonObject json = JsonUtils.readJson(row.get("json").toString()).asJsonObject();
                  if (json.containsKey("appName")) {
                    return;
                  }
                  // Else, update the name
                  App app = appRepository.find(appId, Include.ALL);
                  updateAppExtension(handle, app, postgres);
                } catch (EntityNotFoundException ex) {
                  // Clean up the old status data
                  daoCollection
                      .appExtensionTimeSeriesDao()
                      .delete(
                          row.get("appid").toString(),
                          AppExtension.ExtensionType.STATUS.toString());
                } catch (Exception ex) {
                  // Propagate so the migration step is recorded as FAILED and the workflow stops
                  // before the post-DDL `ALTER ... appName ... GENERATED ALWAYS AS ... NOT NULL`,
                  // which would otherwise fail for a row left without `appName` in its JSON.
                  LOG.error("Error migrating app extension [{}] due to ", row, ex);
                  throw new RuntimeException(
                      "Failed to migrate app extension for appId " + row.get("appid"), ex);
                }
              });
    } catch (Exception ex) {
      // Propagate iteration-level errors (mid-loop ResultSet failures or exceptions escaping the
      // orphan-cleanup delete) for the same reason as the per-row catch above.
      LOG.error("Error running app extension migration ", ex);
      throw ex;
    }
  }

  private static void updateAppExtension(Handle handle, App app, boolean postgres) {
    Update update;
    if (postgres) {
      update = handle.createUpdate(UPDATE_PG_APP_EXTENSION);
    } else {
      update = handle.createUpdate(UPDATE_MYSQL_APP_EXTENSION);
    }
    update.bind("appId", app.getId().toString()).bind("appName", app.getName()).execute();
  }
}
