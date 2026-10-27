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

package org.openmetadata.service.migration.mysql.v207;

import static org.openmetadata.service.migration.utils.DataMigrationStep.runOnce;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v207.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    MigrationUtil.addWorkflowRunEntityLinkIndexOnMySql(handle);
    MigrationUtil.addMcpConsentColumnsOnMySql(handle);
    runOnce(
        migrationDAO,
        getVersion(),
        MigrationUtil.NEGATED_LIST_DATA_CONTRACT_STEP,
        () -> MigrationUtil.rewriteDataContractRules(collectionDAO));
    runOnce(
        migrationDAO,
        getVersion(),
        MigrationUtil.NEGATED_LIST_ENTITY_RULES_STEP,
        MigrationUtil::rewriteEntityRules);
    // `migrate` runs data migrations before it starts Flowable, and this step deploys workflows.
    runOnce(
        migrationDAO,
        getVersion(),
        MigrationUtil.NEGATED_LIST_WORKFLOW_STEP,
        () -> {
          initializeWorkflowHandler();
          MigrationUtil.rewriteWorkflowRules();
        });
  }
}
