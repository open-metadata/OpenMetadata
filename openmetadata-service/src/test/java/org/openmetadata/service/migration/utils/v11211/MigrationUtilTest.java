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
package org.openmetadata.service.migration.utils.v11211;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

class MigrationUtilTest {

  private static final Set<String> HIGHLIGHTABLE = Set.of("name", "displayName", "description");

  @Test
  void removesHighlightFieldsNotMarkedHighlightable() {
    GlobalSettings global = new GlobalSettings();
    global.setHighlightFields(new ArrayList<>(List.of("name", "extension.foo")));
    AssetTypeConfiguration table = new AssetTypeConfiguration();
    table.setAssetType("table");
    table.setHighlightFields(new ArrayList<>(List.of("name", "description", "columns.children.x")));
    SearchSettings settings = new SearchSettings();
    settings.setGlobalSettings(global);
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(table)));

    boolean changed = MigrationUtil.removeDisallowedHighlightFields(settings, HIGHLIGHTABLE);

    assertTrue(changed);
    assertEquals(List.of("name"), settings.getGlobalSettings().getHighlightFields());
    assertEquals(List.of("name", "description"), table.getHighlightFields());
  }

  @Test
  void noChangeWhenAllHighlightFieldsAreAllowed() {
    GlobalSettings global = new GlobalSettings();
    global.setHighlightFields(new ArrayList<>(List.of("name", "description")));
    SearchSettings settings = new SearchSettings();
    settings.setGlobalSettings(global);

    assertFalse(MigrationUtil.removeDisallowedHighlightFields(settings, HIGHLIGHTABLE));
    assertEquals(List.of("name", "description"), settings.getGlobalSettings().getHighlightFields());
  }
}
