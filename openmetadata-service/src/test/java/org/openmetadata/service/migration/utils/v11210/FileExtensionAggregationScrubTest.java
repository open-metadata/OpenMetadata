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
import org.openmetadata.schema.api.search.SearchSettings;

class FileExtensionAggregationScrubTest {

  private Aggregation agg(String field) {
    Aggregation a = new Aggregation();
    a.setField(field);
    a.setName(field);
    return a;
  }

  private AssetTypeConfiguration assetConfig(String assetType, Aggregation... aggregations) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setAggregations(new ArrayList<>(List.of(aggregations)));
    return config;
  }

  @Test
  void scrubRemovesStaleExtensionAggregationFromFileConfig() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                assetConfig(
                    "file",
                    agg("fileType"),
                    agg("extension"),
                    agg("fileExtension"),
                    agg("service.displayName.keyword")))));

    boolean changed = MigrationUtil.stripStaleFileExtensionAggregation(settings);

    assertTrue(
        changed, "Scrub should report a change when the stale extension aggregation is present");
    List<Aggregation> aggs = settings.getAssetTypeConfigurations().getFirst().getAggregations();
    assertEquals(3, aggs.size());
    assertTrue(
        aggs.stream().noneMatch(a -> "extension".equals(a.getField())),
        "Stale 'extension' aggregation must be removed");
    assertTrue(
        aggs.stream().anyMatch(a -> "fileExtension".equals(a.getField())),
        "Current 'fileExtension' aggregation must be preserved");
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

    boolean changed = MigrationUtil.stripStaleFileExtensionAggregation(settings);

    assertTrue(changed, "Scrub should report change for the file asset type");
    List<Aggregation> fileAggs = settings.getAssetTypeConfigurations().get(0).getAggregations();
    assertEquals(1, fileAggs.size(), "Only file aggregations should be modified");
    assertEquals("fileType", fileAggs.getFirst().getField());

    List<Aggregation> tableAggs = settings.getAssetTypeConfigurations().get(1).getAggregations();
    assertEquals(2, tableAggs.size(), "table aggregations must not be touched");

    List<Aggregation> topicAggs = settings.getAssetTypeConfigurations().get(2).getAggregations();
    assertEquals(2, topicAggs.size(), "topic aggregations must not be touched");
  }

  @Test
  void scrubIsIdempotentWhenExtensionAlreadyAbsent() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                assetConfig(
                    "file",
                    agg("fileType"),
                    agg("fileExtension"),
                    agg("directory.displayName.keyword"),
                    agg("service.displayName.keyword")))));

    boolean changed = MigrationUtil.stripStaleFileExtensionAggregation(settings);

    assertFalse(changed, "Scrub must not report a change when extension is already absent");
    assertEquals(4, settings.getAssetTypeConfigurations().getFirst().getAggregations().size());
  }

  @Test
  void scrubHandlesNullAndEmptyGracefully() {
    assertFalse(MigrationUtil.stripStaleFileExtensionAggregation(null));

    SearchSettings empty = new SearchSettings();
    assertFalse(MigrationUtil.stripStaleFileExtensionAggregation(empty));

    SearchSettings nullAggs = new SearchSettings();
    AssetTypeConfiguration fileConfig = new AssetTypeConfiguration();
    fileConfig.setAssetType("file");
    fileConfig.setAggregations(null);
    nullAggs.setAssetTypeConfigurations(new ArrayList<>(List.of(fileConfig)));
    assertFalse(MigrationUtil.stripStaleFileExtensionAggregation(nullAggs));
  }
}
