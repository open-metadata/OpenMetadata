package org.openmetadata.service.migration.mysql.v1120;

import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixApiCollectionFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixApiEndpointFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDashboardDataModelFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDatabaseFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDatabaseSchemaFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixStoredProcedureFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixTableFqnHash;

import java.util.Map;
import lombok.SneakyThrows;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {
  private final org.openmetadata.service.migration.utils.v1110.MigrationUtil migrationUtil;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
    this.migrationUtil =
        new org.openmetadata.service.migration.utils.v1110.MigrationUtil(
            ConnectionType.MYSQL, migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Fix FQN and hash for entities with services that have dots in their names.
    // Order matters - parent entities must be fixed before child entities.

    // Database service hierarchy: Service -> Database -> Schema -> Table/StoredProcedure
    fixDatabaseFqnHash(handle, collectionDAO);
    fixDatabaseSchemaFqnHash(handle, collectionDAO);
    fixTableFqnHash(handle, collectionDAO);
    fixStoredProcedureFqnHash(handle, collectionDAO);

    // Dashboard service hierarchy: Service -> DashboardDataModel
    fixDashboardDataModelFqnHash(handle, collectionDAO);

    // API service hierarchy: Service -> APICollection -> APIEndpoint
    fixApiCollectionFqnHash(handle, collectionDAO);
    fixApiEndpointFqnHash(handle, collectionDAO);
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    Map<String, QueryStatus> result = super.runPostDDLScripts(isForceMigration);
    result.putAll(
        migrationUtil.setRecognizersForSensitiveTags(
            "UPDATE tag SET json = JSON_SET(json, '$.recognizers', CAST(? AS JSON)) "
                + "WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = ?",
            handle,
            migrationDAO,
            isForceMigration));
    return result;
  }
}
