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

package org.openmetadata.service.migration.mysql.v202;

import static org.openmetadata.service.migration.utils.v202.SearchAllowedFieldsRepair.repairAllowedFields;
import static org.openmetadata.service.migration.utils.v202.SearchNameKeywordRepair.repairNameKeywordSearchFields;
import static org.openmetadata.service.migration.utils.v202.TableAliasesSearchSettingsMigration.addAliasesSearchSettings;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
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
    // Log and continue rather than abort: alias search degrades to not matching synonyms, which
    // is not worth failing an upgrade over. Matches v201's pattern.
    try {
      addAliasesSearchSettings();
    } catch (Exception e) {
      LOG.error("v202: failed to backfill the table 'aliases' search settings", e);
    }
  }
}
