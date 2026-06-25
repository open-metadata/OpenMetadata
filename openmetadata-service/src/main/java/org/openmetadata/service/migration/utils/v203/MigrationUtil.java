/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.migration.utils.v203;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexMappingsSeeder;

@Slf4j
public final class MigrationUtil {

  private MigrationUtil() {}

  /**
   * Seeds the default, field-safety-hardened search index mappings into settings if absent. Runs as
   * part of {@code migrate} so the {@code searchIndexMappings} row exists before the migrate step
   * updates indexes/templates. Insert-if-absent — never clobbers admin-customized mappings.
   */
  public static void seedSearchIndexMappings() {
    try {
      Settings stored =
          Entity.getSystemRepository()
              .getConfigWithKey(SettingsType.SEARCH_INDEX_MAPPINGS.toString());
      if (stored == null) {
        Settings setting =
            new Settings()
                .withConfigType(SettingsType.SEARCH_INDEX_MAPPINGS)
                .withConfigValue(SearchIndexMappingsSeeder.buildDefaultBlob());
        Entity.getSystemRepository().createNewSetting(setting);
        LOG.info("Seeded default search index mappings setting");
      }
    } catch (Exception seedFailed) {
      LOG.error("Failed to seed search index mappings during migration", seedFailed);
    }
  }
}
