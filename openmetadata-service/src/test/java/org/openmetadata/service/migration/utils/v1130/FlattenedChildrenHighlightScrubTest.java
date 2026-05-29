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
package org.openmetadata.service.migration.utils.v1130;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

class FlattenedChildrenHighlightScrubTest {

  private static final String CONTAINER_CHILDREN_HIGHLIGHT = "dataModel.columns.children.name";

  private AssetTypeConfiguration assetConfig(String assetType, String... highlightFields) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setHighlightFields(new ArrayList<>(List.of(highlightFields)));
    return config;
  }

  @Test
  void stripRemovesContainerChildrenHighlightAndPreservesValidFields() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                assetConfig(
                    "container",
                    "name",
                    "displayName",
                    "description",
                    "dataModel.columns.name",
                    CONTAINER_CHILDREN_HIGHLIGHT))));

    boolean changed = MigrationUtil.stripFlattenedChildrenHighlightFields(settings);

    assertTrue(changed, "Scrub should report a change when a children highlight field is present");
    List<String> highlights = settings.getAssetTypeConfigurations().getFirst().getHighlightFields();
    assertEquals(
        List.of("name", "displayName", "description", "dataModel.columns.name"),
        highlights,
        "Only the flattened children highlight field should be removed");
  }

  @Test
  void stripRemovesOnlySeedRemovedFieldAndPreservesOtherChildrenPaths() {
    SearchSettings settings = new SearchSettings();
    GlobalSettings global = new GlobalSettings();
    global.setHighlightFields(
        new ArrayList<>(List.of("name", "messageSchema.schemaFields.children.name")));
    settings.setGlobalSettings(global);
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                assetConfig("container", "name", CONTAINER_CHILDREN_HIGHLIGHT),
                assetConfig("table", "displayName", "columns.children.name"),
                assetConfig("topic", "name", "messageSchema.schemaFields.children.name"))));

    boolean changed = MigrationUtil.stripFlattenedChildrenHighlightFields(settings);

    assertTrue(changed);
    assertEquals(
        List.of("name"),
        settings.getAssetTypeConfigurations().get(0).getHighlightFields(),
        "Only the exact seed-removed container highlight field is scrubbed");
    assertEquals(
        List.of("displayName", "columns.children.name"),
        settings.getAssetTypeConfigurations().get(1).getHighlightFields(),
        "table columns.children.name was never removed from the seed - must be preserved");
    assertEquals(
        List.of("name", "messageSchema.schemaFields.children.name"),
        settings.getAssetTypeConfigurations().get(2).getHighlightFields(),
        "topic schemaFields.children.name was never removed from the seed - must be preserved");
    assertEquals(
        List.of("name", "messageSchema.schemaFields.children.name"),
        settings.getGlobalSettings().getHighlightFields(),
        "global children paths were never removed from the seed - must be preserved");
  }

  @Test
  void stripPreservesUserCustomHighlightFields() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(assetConfig("container", "name", "customExtension.value", "tags.tagFQN"))));

    boolean changed = MigrationUtil.stripFlattenedChildrenHighlightFields(settings);

    assertFalse(changed, "Scrub must not touch settings without flattened children references");
    assertEquals(
        List.of("name", "customExtension.value", "tags.tagFQN"),
        settings.getAssetTypeConfigurations().getFirst().getHighlightFields());
  }

  @Test
  void stripHandlesNullAndEmptyGracefully() {
    assertFalse(MigrationUtil.stripFlattenedChildrenHighlightFields(null));

    SearchSettings empty = new SearchSettings();
    assertFalse(MigrationUtil.stripFlattenedChildrenHighlightFields(empty));

    SearchSettings nullHighlights = new SearchSettings();
    nullHighlights.setAssetTypeConfigurations(new ArrayList<>(List.of(assetConfig("container"))));
    nullHighlights.getAssetTypeConfigurations().getFirst().setHighlightFields(null);
    assertFalse(MigrationUtil.stripFlattenedChildrenHighlightFields(nullHighlights));
  }
}
