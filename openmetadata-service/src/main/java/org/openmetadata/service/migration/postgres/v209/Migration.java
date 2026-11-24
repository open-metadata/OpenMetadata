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

package org.openmetadata.service.migration.postgres.v209;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.DataMigrationStep.runOnce;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v209.ServiceVersionSecretsMasking;
import org.openmetadata.service.migration.utils.v209.WorkflowEventTypeRedeployMigration;

public class Migration extends MigrationProcessImpl {

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    // Secrets below some oneOf branches were stored unencrypted; migrate re-saves the current
    // services, and this masks the plain text copies left in their version history.
    runOnce(
        migrationDAO,
        getVersion(),
        ServiceVersionSecretsMasking.STEP_NAME,
        () -> ServiceVersionSecretsMasking.maskPlainTextSecrets(handle, POSTGRES));
    // `migrate` runs data migrations before it starts Flowable, and this step deploys workflows.
    runOnce(
        migrationDAO,
        getVersion(),
        WorkflowEventTypeRedeployMigration.STEP_NAME,
        () -> {
          initializeWorkflowHandler();
          WorkflowEventTypeRedeployMigration.redeploy();
        });
  }
}
