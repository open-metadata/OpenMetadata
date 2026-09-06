package org.openmetadata.service.migration.mysql.v1120;

import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixApiCollectionFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixApiEndpointFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixChartFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDashboardDataModelFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDashboardFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDatabaseFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixDatabaseSchemaFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixMlModelFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixPipelineFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixStoredProcedureFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixTableFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.fixTopicFqnHash;
import static org.openmetadata.service.migration.utils.v1120.MigrationUtil.updateClassificationAndRecognizers;

import java.util.Map;
import lombok.SneakyThrows;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
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

    // Dashboard service hierarchy: Service -> Dashboard / Chart / DashboardDataModel
    fixDashboardFqnHash(handle, collectionDAO);
    fixChartFqnHash(handle, collectionDAO);
    fixDashboardDataModelFqnHash(handle, collectionDAO);

    // API service hierarchy: Service -> APICollection -> APIEndpoint
    fixApiCollectionFqnHash(handle, collectionDAO);
    fixApiEndpointFqnHash(handle, collectionDAO);

    // Pipeline service hierarchy: Service -> Pipeline
    fixPipelineFqnHash(handle, collectionDAO);

    // Messaging service hierarchy: Service -> Topic
    fixTopicFqnHash(handle, collectionDAO);

    // MlModel service hierarchy: Service -> MlModel
    fixMlModelFqnHash(handle, collectionDAO);
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    Map<String, QueryStatus> result = super.runPostDDLScripts(isForceMigration);
    result.putAll(
        updateClassificationAndRecognizers(
            "UPDATE classification SET json = JSON_MERGE_PATCH("
                + "json, JSON_OBJECT("
                + "'autoClassificationConfig', CAST(? AS JSON)"
                + ")) WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = ?",
            "UPDATE tag SET json = JSON_MERGE_PATCH("
                + "json, JSON_OBJECT("
                + "'autoClassificationEnabled', CAST(? AS JSON), "
                + "'autoClassificationPriority', CAST(? AS JSON), "
                + "'recognizers', CAST(? AS JSON)"
                + ")) WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = ?",
            handle,
            migrationDAO,
            getVersion(),
            isForceMigration));
    return result;
  }
}
