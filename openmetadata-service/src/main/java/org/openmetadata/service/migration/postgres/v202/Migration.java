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

package org.openmetadata.service.migration.postgres.v202;

import static org.openmetadata.service.migration.utils.v202.SearchAllowedFieldsRepair.repairAllowedFields;
import static org.openmetadata.service.migration.utils.v202.SearchNameKeywordRepair.repairNameKeywordSearchFields;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {
  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    // Backfill the name.keyword search field on existing installs; the seed default alone never
    // reaches already-migrated clusters. Idempotent.
    repairNameKeywordSearchFields();
    // Complete allowedFields from the seed so removed search fields stay re-addable on upgraded
    // clusters (SettingsCache refreshes it in memory but never persists it). Idempotent.
    repairAllowedFields();
  }
}
