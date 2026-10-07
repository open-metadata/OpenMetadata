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

package org.openmetadata.service.migration.mysql.v205;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v205.OverrideMetadataRestore;

public class Migration extends MigrationProcessImpl {
  private final OverrideMetadataRestore.Window window;

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
    window = OverrideMetadataRestore.windowBeforeRun();
  }

  @Override
  public void runDataMigration() {
    OverrideMetadataRestore.restoreOnce(migrationDAO, window);
  }
}
