/*
 *  Copyright 2024 Collate
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
package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;

/**
 * Full lifecycle coverage for the metric → asset relationship ({@code Metric.assets}, an APPLIED_TO
 * edge): adding on create, adding/replacing/removing/clearing via PATCH, and referential cleanup
 * when an asset is deleted. Complements AIContextMcpIT, which covers how the edge surfaces as
 * context; this class exercises the CRUD mechanics of the edge itself.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MetricAssetsIT extends McpTestBase {

  private static Table assetA;
  private static Table assetB;
  private static Table assetC;
  private static String suffix;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    suffix = UUID.randomUUID().toString().substring(0, 8);
    assetA = createServiceDatabaseSchemaTable("metricassets_a_" + suffix);
    assetB = createServiceDatabaseSchemaTable("metricassets_b_" + suffix);
    assetC = createServiceDatabaseSchemaTable("metricassets_c_" + suffix);
  }

  private static Metric createMetric(String name, Table... assets) throws Exception {
    CreateMetric create =
        new CreateMetric().withName(name).withDescription("Metric assets lifecycle: " + name);
    if (assets.length > 0) {
      create.withAssets(List.of(assets).stream().map(MetricAssetsIT::assetRef).toList());
    }
    return post("metrics", create, Metric.class);
  }

  private static EntityReference assetRef(Table table) {
    return new EntityReference().withId(table.getId()).withType("table");
  }

  private static JsonNode assetsOf(Metric metric) throws Exception {
    return get("metrics/name/" + metric.getName() + "?fields=assets", JsonNode.class).get("assets");
  }

  private static void patchAssets(Metric metric, Table... assets) throws Exception {
    StringBuilder value = new StringBuilder("[");
    for (int i = 0; i < assets.length; i++) {
      if (i > 0) {
        value.append(',');
      }
      value.append(String.format("{\"id\":\"%s\",\"type\":\"table\"}", assets[i].getId()));
    }
    value.append(']');
    patch(
        "metrics/" + metric.getId(),
        String.format("[{\"op\":\"add\",\"path\":\"/assets\",\"value\":%s}]", value));
  }

  private static boolean containsAsset(JsonNode assets, Table table) {
    return assets != null
        && StreamSupport.stream(assets.spliterator(), false)
            .anyMatch(a -> a.get("id").asText().equals(table.getId().toString()));
  }

  @Test
  void create_withAssets_persistsTheEdges() throws Exception {
    Metric metric = createMetric("metricassets_create_" + suffix, assetA, assetB);
    JsonNode assets = assetsOf(metric);
    assertThat(assets.size()).isEqualTo(2);
    assertThat(containsAsset(assets, assetA)).isTrue();
    assertThat(containsAsset(assets, assetB)).isTrue();
  }

  @Test
  void create_withoutAssets_isEmpty() throws Exception {
    Metric metric = createMetric("metricassets_none_" + suffix);
    JsonNode assets = assetsOf(metric);
    assertThat(assets == null || assets.isEmpty()).isTrue();
  }

  @Test
  void update_addAssetViaPatch() throws Exception {
    Metric metric = createMetric("metricassets_add_" + suffix, assetA);
    patchAssets(metric, assetA, assetB);
    JsonNode assets = assetsOf(metric);
    assertThat(assets.size()).isEqualTo(2);
    assertThat(containsAsset(assets, assetA)).isTrue();
    assertThat(containsAsset(assets, assetB)).isTrue();
  }

  @Test
  void update_replaceAssetsViaPatch() throws Exception {
    Metric metric = createMetric("metricassets_replace_" + suffix, assetA);
    patchAssets(metric, assetB);
    JsonNode assets = assetsOf(metric);
    assertThat(assets.size()).isEqualTo(1);
    assertThat(containsAsset(assets, assetB)).isTrue();
    assertThat(containsAsset(assets, assetA)).isFalse();
  }

  @Test
  void update_removeOneAssetViaPatch() throws Exception {
    Metric metric = createMetric("metricassets_remove_" + suffix, assetA, assetB);
    patchAssets(metric, assetA);
    JsonNode assets = assetsOf(metric);
    assertThat(assets.size()).isEqualTo(1);
    assertThat(containsAsset(assets, assetA)).isTrue();
    assertThat(containsAsset(assets, assetB)).isFalse();
  }

  @Test
  void update_clearAllAssetsViaPatch() throws Exception {
    Metric metric = createMetric("metricassets_clear_" + suffix, assetA, assetB);
    patchAssets(metric);
    JsonNode assets = assetsOf(metric);
    assertThat(assets == null || assets.isEmpty()).isTrue();
  }

  @Test
  void csvImport_withoutAssetsColumn_preservesExistingAssets() throws Exception {
    // The metric CSV has no assets column, so exporting then re-importing round-trips the metric
    // with its asset list unset. The batch import path (storeMany →
    // clearEntitySpecificRelationshipsForMany) must treat an absent asset list as "unchanged" and
    // leave the APPLIED_TO edges intact — clearing them here would silently wipe the metric's
    // assets on every CSV import.
    Metric metric = createMetric("metricassets_csv_" + suffix, assetA, assetB);
    assertThat(assetsOf(metric).size()).isEqualTo(2);

    String csv = getResponse("metrics/name/" + metric.getName() + "/export", authToken).body();
    HttpResponse<String> importResponse =
        putText("metrics/name/" + metric.getName() + "/import?dryRun=false", csv);
    assertThat(importResponse.statusCode()).isEqualTo(200);
    assertThat(OBJECT_MAPPER.readTree(importResponse.body()).path("numberOfRowsProcessed").asInt())
        .isGreaterThanOrEqualTo(1);

    JsonNode assets = assetsOf(metric);
    assertThat(assets.size()).isEqualTo(2);
    assertThat(containsAsset(assets, assetA)).isTrue();
    assertThat(containsAsset(assets, assetB)).isTrue();
  }

  @Test
  void delete_asset_removesItFromMetric() throws Exception {
    Table disposable = createServiceDatabaseSchemaTable("metricassets_del_" + suffix);
    Metric metric = createMetric("metricassets_delcascade_" + suffix, assetC, disposable);
    assertThat(containsAsset(assetsOf(metric), disposable)).isTrue();

    delete("tables/" + disposable.getId() + "?hardDelete=true&recursive=true");

    JsonNode assets = assetsOf(metric);
    assertThat(containsAsset(assets, disposable)).isFalse();
    assertThat(containsAsset(assets, assetC)).isTrue();
  }
}
