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
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

/**
 * The recursive column/schema {@code children} subtree is mapped {@code object} with {@code
 * "enabled": false} (stored, not indexed) so an oversized leaf can no longer trip Lucene's per-term
 * limit. Every reference to its leaves is therefore dead and must be scrubbed from the DB-stored
 * SearchSettings on upgrade — across highlightFields, searchFields, and the allowedFields catalog —
 * while every non-children field is preserved.
 */
class FlattenedChildrenScrubTest {

  private FieldBoost searchField(String field) {
    return new FieldBoost().withField(field).withBoost(1.0);
  }

  private AllowedSearchFields allowedFields(String entityType, String... fieldNames) {
    List<Field> fields = new ArrayList<>();
    for (String name : fieldNames) {
      fields.add(new Field().withName(name));
    }
    return new AllowedSearchFields().withEntityType(entityType).withFields(fields);
  }

  private List<String> fieldNames(AllowedSearchFields allowedFields) {
    return allowedFields.getFields().stream().map(Field::getName).toList();
  }

  private List<String> searchFieldNames(AssetTypeConfiguration config) {
    return config.getSearchFields().stream().map(FieldBoost::getField).toList();
  }

  @Test
  void stripRemovesChildrenFromHighlightSearchAndAllowedFields() {
    GlobalSettings global = new GlobalSettings();
    global.setHighlightFields(new ArrayList<>(List.of("name", "columns.children.name")));

    AssetTypeConfiguration table = new AssetTypeConfiguration();
    table.setAssetType("table");
    table.setHighlightFields(new ArrayList<>(List.of("displayName", "columns.children.name")));
    table.setSearchFields(
        new ArrayList<>(
            List.of(
                searchField("name"),
                searchField("columns.children.name"),
                searchField("columnNamesFuzzy"))));

    AssetTypeConfiguration apiEndpoint = new AssetTypeConfiguration();
    apiEndpoint.setAssetType("apiEndpoint");
    apiEndpoint.setSearchFields(
        new ArrayList<>(
            List.of(
                searchField("requestSchema.schemaFields.children.name"),
                searchField("responseSchema.schemaFields.children.name"))));

    SearchSettings settings = new SearchSettings();
    settings.setGlobalSettings(global);
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(table, apiEndpoint)));
    settings.setAllowedFields(
        new ArrayList<>(
            List.of(
                allowedFields(
                    "table", "name", "columns.children.name", "columns.children.description"),
                allowedFields("topic", "messageSchema.schemaFields.children.name"))));

    boolean changed = MigrationUtil.stripFlattenedChildrenReferences(settings);

    assertTrue(changed, "Scrub must report a change when any children reference is present");
    assertEquals(List.of("name"), global.getHighlightFields());
    assertEquals(List.of("displayName"), table.getHighlightFields());
    assertEquals(List.of("name", "columnNamesFuzzy"), searchFieldNames(table));
    assertEquals(
        List.of(),
        searchFieldNames(apiEndpoint),
        "Both request/response schemaFields children search fields must be removed");
    assertEquals(List.of("name"), fieldNames(settings.getAllowedFields().get(0)));
    assertEquals(List.of(), fieldNames(settings.getAllowedFields().get(1)));
  }

  @Test
  void stripReturnsFalseWhenNoChildrenReferences() {
    AssetTypeConfiguration table = new AssetTypeConfiguration();
    table.setAssetType("table");
    table.setHighlightFields(new ArrayList<>(List.of("name", "columns.name")));
    table.setSearchFields(
        new ArrayList<>(List.of(searchField("name"), searchField("columns.name"))));

    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(table)));
    settings.setAllowedFields(
        new ArrayList<>(List.of(allowedFields("table", "name", "columns.name"))));

    boolean changed = MigrationUtil.stripFlattenedChildrenReferences(settings);

    assertFalse(changed, "Scrub must not touch settings without any flattened children reference");
    assertEquals(List.of("name", "columns.name"), table.getHighlightFields());
    assertEquals(List.of("name", "columns.name"), searchFieldNames(table));
  }

  @Test
  void stripHandlesNullAndEmptyGracefully() {
    assertFalse(MigrationUtil.stripFlattenedChildrenReferences(null));
    assertFalse(MigrationUtil.stripFlattenedChildrenReferences(new SearchSettings()));

    AssetTypeConfiguration nullLists = new AssetTypeConfiguration();
    nullLists.setAssetType("table");
    nullLists.setHighlightFields(null);
    nullLists.setSearchFields(null);
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(nullLists)));
    assertFalse(MigrationUtil.stripFlattenedChildrenReferences(settings));
  }
}
