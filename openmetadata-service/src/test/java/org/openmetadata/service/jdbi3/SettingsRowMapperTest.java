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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.StartupChecksums;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;

class SettingsRowMapperTest {

  @Test
  void getSettings_deserializesStartupChecksums() {
    String json =
        """
        {
          "seedDataFingerprint": "seed-fingerprint",
          "searchTemplateFingerprint": "template-fingerprint",
          "serverVersion": "2.0.0"
        }
        """;

    Settings settings =
        CollectionDAO.SettingsRowMapper.getSettings(SettingsType.STARTUP_CHECKSUMS, json);

    StartupChecksums checksums =
        assertInstanceOf(StartupChecksums.class, settings.getConfigValue());
    assertEquals(SettingsType.STARTUP_CHECKSUMS, settings.getConfigType());
    assertEquals("seed-fingerprint", checksums.getSeedDataFingerprint());
    assertEquals("template-fingerprint", checksums.getSearchTemplateFingerprint());
    assertEquals("2.0.0", checksums.getServerVersion());
  }
}
