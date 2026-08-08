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
package org.openmetadata.it.tests.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;

/**
 * One-shot exporter that turns the system Data Insight charts — built programmatically by the
 * pre-2.0 Java migrations {@code v150.createSystemDICharts} / {@code v170.createServiceCharts} —
 * into ordinary seed JSON under {@code json/data/dataInsight/custom/}.
 *
 * <p>{@code DataInsightSystemChartResource.initialize()} already globs exactly that path and
 * creates anything missing via {@code initializeEntity} (create-if-missing), but the directory has
 * never existed, so the charts only ever appeared on databases that ran the migrations. Exporting
 * them as seed content makes the application own them: fresh installs get them at boot, existing
 * clusters are untouched because the charts already exist, and the pre-2.0 chart-building code
 * becomes deletable.
 *
 * <p>Run once (dialect-independent) from the baseline generator; the output is normal reviewable
 * seed content, not a frozen snapshot.
 */
class DataInsightChartSeedExporter {

  /** Server-assigned fields — the seed loader stamps its own on create. */
  private static final Set<String> VOLATILE_FIELDS =
      Set.of(
          "id",
          "version",
          "updatedAt",
          "updatedBy",
          "href",
          "changeDescription",
          "incrementalChangeDescription");

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final ObjectWriter WRITER = MAPPER.writerWithDefaultPrettyPrinter();

  private final ScratchDatabase database;

  DataInsightChartSeedExporter(ScratchDatabase database) {
    this.database = database;
  }

  int export(Path seedDirectory) throws IOException {
    Files.createDirectories(seedDirectory);
    List<String> chartJsons =
        database
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM di_chart_entity ORDER BY 1")
                        .mapTo(String.class)
                        .list());
    for (String chartJson : chartJsons) {
      writeChart(seedDirectory, chartJson);
    }
    return chartJsons.size();
  }

  private void writeChart(Path seedDirectory, String chartJson) throws IOException {
    ObjectNode chart = (ObjectNode) MAPPER.readTree(chartJson);
    String name = chart.get("name").asText();
    VOLATILE_FIELDS.forEach(chart::remove);
    Path target = seedDirectory.resolve(name + ".json");
    Files.writeString(
        target, WRITER.writeValueAsString(withSortedKeys(chart)) + "\n", StandardCharsets.UTF_8);
  }

  /** Alphabetical key order so re-exporting the same charts produces byte-identical files. */
  private ObjectNode withSortedKeys(ObjectNode node) {
    List<String> fieldNames = new ArrayList<>();
    node.fieldNames().forEachRemaining(fieldNames::add);
    Collections.sort(fieldNames);
    ObjectNode result = MAPPER.createObjectNode();
    fieldNames.forEach(field -> result.set(field, sortedValue(node.get(field))));
    return result;
  }

  /**
   * Recurses through arrays as well as objects: MySQL JSON and PostgreSQL jsonb each impose their
   * own key order, including on objects nested inside arrays, so both dialects must normalize to
   * the same bytes or regenerating from the other dialect would churn every file.
   */
  private JsonNode sortedValue(JsonNode value) {
    JsonNode result = value;
    if (value instanceof ObjectNode objectNode) {
      result = withSortedKeys(objectNode);
    } else if (value instanceof ArrayNode arrayNode) {
      ArrayNode sortedArray = MAPPER.createArrayNode();
      arrayNode.forEach(element -> sortedArray.add(sortedValue(element)));
      result = sortedArray;
    }
    return result;
  }
}
