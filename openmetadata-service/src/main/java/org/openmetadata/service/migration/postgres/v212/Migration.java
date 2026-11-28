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

package org.openmetadata.service.migration.postgres.v212;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.DataMigrationStep.runOnce;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v212.DataProductLineageRebuild;
import org.openmetadata.service.migration.utils.v212.DataProductLineageSelfLoopRepair;
import org.openmetadata.service.migration.utils.v212.LogicalTestSuitePipelineMigration;

public class Migration extends MigrationProcessImpl {

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    runOnce(
        migrationDAO,
        getVersion(),
        LogicalTestSuitePipelineMigration.STEP_NAME,
        () -> LogicalTestSuitePipelineMigration.migrate(handle, POSTGRES));
    // Released versions wrote data product lineage edges from a product to itself.
    runOnce(
        migrationDAO,
        getVersion(),
        DataProductLineageSelfLoopRepair.STEP_NAME,
        () -> DataProductLineageSelfLoopRepair.deleteAll(handle));
    runOnce(
        migrationDAO,
        getVersion(),
        DataProductLineageRebuild.STEP_NAME,
        () -> DataProductLineageRebuild.rebuildAll(handle, POSTGRES));
  }
}
