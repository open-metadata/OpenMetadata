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
package org.openmetadata.service.migration.utils.v11210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;

class FileExtensionAggregationScrubTest {

  private Aggregation agg(String field) {
    Aggregation a = new Aggregation();
    a.setField(field);
    a.setName(field);
    return a;
  }

  private FieldBoost searchField(String field) {
    FieldBoost fb = new FieldBoost();
    fb.setField(field);
    return fb;
  }

  private AssetTypeConfiguration assetConfig(String assetType, Aggregation... aggregations) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setAggregations(new ArrayList<>(List.of(aggregations)));
    return config;
  }

  @Test
  void scrubRemovesStaleExtensionAggregationAndSearchFieldFromFileConfig() {
    AssetTypeConfiguration fileConfig = new AssetTypeConfiguration();
    fileConfig.setAssetType("file");
    fileConfig.setAggregations(
        new ArrayList<>(List.of(agg("fileType"), agg("extension"), agg("fileExtension"))));
    fileConfig.setSearchFields(
        new ArrayList<>(
            List.of(searchField("name"), searchField("extension"), searchField("fileExtension"))));

    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(fileConfig)));

    boolean changed = MigrationUtil.stripStaleFileExtensionSettings(settings);

    assertTrue(changed);
    List<Aggregation> aggs = settings.getAssetTypeConfigurations().getFirst().getAggregations();
    assertEquals(2, aggs.size());
    assertTrue(aggs.stream().noneMatch(a -> "extension".equals(a.getField())));
    assertTrue(aggs.stream().anyMatch(a -> "fileExtension".equals(a.getField())));

    List<FieldBoost> sfs = settings.getAssetTypeConfigurations().getFirst().getSearchFields();
    assertEquals(2, sfs.size());
    assertTrue(sfs.stream().noneMatch(f -> "extension".equals(f.getField())));
    assertTrue(sfs.stream().anyMatch(f -> "fileExtension".equals(f.getField())));
  }

  @Test
  void scrubDoesNotTouchOtherAssetTypes() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                assetConfig("file", agg("extension"), agg("fileType")),
                assetConfig("table", agg("extension"), agg("columns.name")),
                assetConfig("topic", agg("extension"), agg("messageSchema.schemaType")))));

    boolean changed = MigrationUtil.stripStaleFileExtensionSettings(settings);

    assertTrue(changed);
    List<Aggregation> fileAggs = settings.getAssetTypeConfigurations().get(0).getAggregations();
    assertEquals(1, fileAggs.size());
    assertEquals("fileType", fileAggs.getFirst().getField());

    assertEquals(2, settings.getAssetTypeConfigurations().get(1).getAggregations().size());
    assertEquals(2, settings.getAssetTypeConfigurations().get(2).getAggregations().size());
  }

  @Test
  void scrubIsIdempotentWhenExtensionAlreadyAbsent() {
    AssetTypeConfiguration fileConfig = new AssetTypeConfiguration();
    fileConfig.setAssetType("file");
    fileConfig.setAggregations(
        new ArrayList<>(
            List.of(
                agg("fileType"),
                agg("fileExtension"),
                agg("directory.displayName.keyword"),
                agg("service.displayName.keyword"))));
    fileConfig.setSearchFields(
        new ArrayList<>(List.of(searchField("name"), searchField("fileExtension"))));

    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(fileConfig)));

    boolean changed = MigrationUtil.stripStaleFileExtensionSettings(settings);

    assertFalse(changed);
    assertEquals(4, settings.getAssetTypeConfigurations().getFirst().getAggregations().size());
    assertEquals(2, settings.getAssetTypeConfigurations().getFirst().getSearchFields().size());
  }

  @Test
  void scrubHandlesNullAndEmptyGracefully() {
    assertFalse(MigrationUtil.stripStaleFileExtensionSettings(null));

    assertFalse(MigrationUtil.stripStaleFileExtensionSettings(new SearchSettings()));

    SearchSettings nullFields = new SearchSettings();
    AssetTypeConfiguration fileConfig = new AssetTypeConfiguration();
    fileConfig.setAssetType("file");
    fileConfig.setAggregations(null);
    fileConfig.setSearchFields(null);
    nullFields.setAssetTypeConfigurations(new ArrayList<>(List.of(fileConfig)));
    assertFalse(MigrationUtil.stripStaleFileExtensionSettings(nullFields));
  }
}
