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

package org.openmetadata.service.migration.postgres.v205;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v205.OverrideMetadataRestore;

@Slf4j
public class Migration extends MigrationProcessImpl {
  private final Long since;

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
    since = OverrideMetadataRestore.windowStartBeforeRun();
  }

  @Override
  public void runDataMigration() {
    try {
      DataMigrationStep.runOnce(
          migrationDAO,
          "2.0.5",
          OverrideMetadataRestore.STEP_NAME,
          () -> OverrideMetadataRestore.restore(since));
    } catch (Exception e) {
      LOG.error("v205: failed to restore metadata removed by 2.0.x ingestion runs", e);
    }
  }
}
