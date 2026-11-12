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

package org.openmetadata.service.fernet.rotation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LargeTablesTest {

  @Test
  void dataAssetsEventsAndTimeSeriesAreLeftOutWhateverTheCase() {
    assertTrue(LargeTables.isLarge("table_entity"));
    assertTrue(LargeTables.isLarge("change_event"));
    assertTrue(LargeTables.isLarge("Entity_Relationship"));
    assertTrue(LargeTables.isLarge("entity_extension_time_series"));
  }

  @Test
  void approvalRevisionsAreReadBecauseTheyKeepServiceConnectionSecretsEncrypted() {
    assertFalse(LargeTables.isLarge("change_revision"));
  }

  @Test
  void aTableNobodyListedIsRead() {
    assertFalse(LargeTables.isLarge("openmetadata_settings"));
    assertFalse(LargeTables.isLarge("a_table_a_distribution_adds"));
  }
}
