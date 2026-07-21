/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.SymlinkIdentifier;
import org.openmetadata.schema.api.lineage.openlineage.SymlinksFacet;

class OpenLineageDatasetNameNormalizerTest {

  private DatasetFacets facetsWithSymlinks(SymlinkIdentifier... identifiers) {
    return new DatasetFacets()
        .withSymlinks(new SymlinksFacet().withIdentifiers(List.of(identifiers)));
  }

  @Test
  void extractCandidates_glueSymlinkForm_normalizesToDotForm() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("arn:aws:glue:us-west-2:181882839756")
                .withName("table/db_refined_55586/dr_564_pdudrik_3829")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "s3://bucket",
            "refined_zone/cloud_city/db_refined_55586.db/dr_564_pdudrik_3829",
            facets);

    assertEquals("db_refined_55586.dr_564_pdudrik_3829", candidates.get(0));
  }

  @Test
  void extractCandidates_glueFormWithoutArnNamespace_stillNormalized() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("some-namespace")
                .withName("table/my_db/my_table")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("ns", "irrelevant", facets);

    assertEquals("my_db.my_table", candidates.get(0));
  }

  @Test
  void extractCandidates_dotFormSymlink_passedThrough() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("hive://metastore:9083")
                .withName("my_db.my_table")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("hdfs://nn", "path", facets);

    assertEquals("my_db.my_table", candidates.get(0));
  }

  @Test
  void extractCandidates_threePartUnityCatalogSymlink_passedThrough() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("databricks://adb-1234.azuredatabricks.net")
                .withName("main_catalog.sales.orders")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("dbfs", "path", facets);

    assertEquals("main_catalog.sales.orders", candidates.get(0));
  }

  @Test
  void extractCandidates_multipleSymlinks_allKeptInOrder() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("arn:aws:glue:us-east-1:123")
                .withName("table/glue_db/glue_table")
                .withType("TABLE"),
            new SymlinkIdentifier()
                .withNamespace("hive://metastore:9083")
                .withName("hive_db.hive_table")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "s3://bucket", "a/deep/opaque/storage/path", facets);

    assertEquals(List.of("glue_db.glue_table", "hive_db.hive_table"), candidates);
  }

  @Test
  void extractCandidates_datasetNameAppendedAsFallback() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("hive://metastore:9083")
                .withName("hive_db.hive_table")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "postgresql://host:5432", "public.users", facets);

    assertEquals(List.of("hive_db.hive_table", "public.users"), candidates);
  }

  @Test
  void extractCandidates_duplicateCandidates_deduplicated() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier()
                .withNamespace("hive://metastore:9083")
                .withName("public.users")
                .withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "postgresql://host:5432", "public.users", facets);

    assertEquals(List.of("public.users"), candidates);
  }

  @Test
  void extractCandidates_hiveWarehousePath_derivesSchemaAndTable() {
    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "s3://bucket", "refined_zone/cloud_city/db_refined_55586.db/dr_564_pdudrik_3829", null);

    assertEquals(List.of("db_refined_55586.dr_564_pdudrik_3829"), candidates);
  }

  @Test
  void extractCandidates_shortSlashFormWithoutDots_convertedToDots() {
    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("hdfs://nn", "my_db/my_table", null);

    assertEquals(List.of("my_db.my_table"), candidates);
  }

  @Test
  void extractCandidates_deepPathWithoutDbMarker_skipped() {
    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(
            "s3://bucket", "a/very/deep/storage/path", null);

    assertTrue(candidates.isEmpty());
  }

  @Test
  void extractCandidates_singleTokenName_skipped() {
    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("ns", "orders", null);

    assertTrue(candidates.isEmpty());
  }

  @Test
  void extractCandidates_nullAndEmptyInputs_handledGracefully() {
    assertTrue(OpenLineageDatasetNameNormalizer.extractCandidates("ns", null, null).isEmpty());
    assertTrue(OpenLineageDatasetNameNormalizer.extractCandidates(null, "", null).isEmpty());
  }

  @Test
  void extractCandidates_blankSymlinkName_skipped() {
    DatasetFacets facets =
        facetsWithSymlinks(
            new SymlinkIdentifier().withNamespace("ns").withName("").withType("TABLE"));

    List<String> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates("pg://h", "public.users", facets);

    assertEquals(List.of("public.users"), candidates);
  }
}
