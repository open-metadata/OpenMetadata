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

package org.openmetadata.it.factories;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * The seed script's manifest is the interface the lineage benchmark attaches through
 * (ADR:2026-10-09-nightly-latency-is-trended-on-a-history-branch-and-gated-on-recent-nights). The
 * Python side pins the same keys in {@code scripts/lineage_seed/tests/test_seed.py}.
 */
class SeededLineageGraphTest {

  private static final String MANIFEST =
      """
      {
        "identity": {"assets": 20000, "prefix": "acme", "seed": 32050},
        "benchmark": {
          "cohortFqnPrefix": "acme_",
          "services": 37,
          "databases": 58,
          "schemas": 105,
          "tables": 17700,
          "edges": 30461,
          "columnEdges": 25513,
          "focus": {
            "serviceFqn": "acme_snowflake_prod_amer",
            "databaseFqn": "acme_snowflake_prod_amer.sales_core",
            "schemaFqn": "acme_snowflake_prod_amer.sales_core.commercial",
            "hubTableFqn": "acme_snowflake_prod_amer.sales_core.commercial.dim_sales_rep",
            "leafTableFqn": "acme_snowflake_prod_amer.sales_marts.revenue.mart_orders_daily",
            "hubColumnFqn": "acme_snowflake_prod_amer.sales_core.commercial.dim_sales_rep.id"
          }
        }
      }
      """;

  @TempDir Path directory;

  @Test
  void readsTheGraphShapeAndFocusPointsFromTheBenchmarkSection() throws IOException {
    final LineageGraphSummary graph = SeededLineageGraph.read(write(MANIFEST));

    assertThat(graph.cohortFqnPrefix()).isEqualTo("acme_");
    assertThat(graph.tables()).isEqualTo(17700);
    assertThat(graph.edges()).isEqualTo(30461);
    assertThat(graph.columnEdges()).isEqualTo(25513);
    assertThat(graph.focusPoints().hubTableFqn())
        .isEqualTo("acme_snowflake_prod_amer.sales_core.commercial.dim_sales_rep");
  }

  @Test
  void namesTheMissingKeyWhenTheSeedScriptStopsWritingOne() throws IOException {
    final Path manifest = write(MANIFEST.replace("\"columnEdges\": 25513,", ""));

    assertThatThrownBy(() -> SeededLineageGraph.read(manifest))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("columnEdges");
  }

  @Test
  void refusesAManifestFromBeforeTheBenchmarkSectionExisted() throws IOException {
    final Path manifest = write("{\"identity\": {}}");

    assertThatThrownBy(() -> SeededLineageGraph.read(manifest))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("re-run the seed script");
  }

  private Path write(final String content) throws IOException {
    final Path manifest = directory.resolve("manifest.json");
    Files.writeString(manifest, content);
    return manifest;
  }
}
