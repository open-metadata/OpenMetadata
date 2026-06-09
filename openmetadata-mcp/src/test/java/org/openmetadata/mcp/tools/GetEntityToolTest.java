/*
 *  Copyright 2025 Collate
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

package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Pins {@link GetEntityTool#cleanEntityResponse}. The entity-level description must always be
 * returned in full (this is the detail tool — the one place full text is reachable after search
 * truncates), while per-column descriptions, schema DDL and dbt SQL — the wide-table multipliers —
 * are truncated. The {@code extension} field (custom properties, #28594 contract) must survive at
 * both table and column level.
 */
class GetEntityToolTest {

  private static Map<String, Object> column(String name, String description) {
    Map<String, Object> column = new HashMap<>();
    column.put("name", name);
    column.put("dataType", "VARCHAR");
    if (description != null) {
      column.put("description", description);
    }
    return column;
  }

  @Test
  void entityDescriptionIsNeverTruncated() {
    Map<String, Object> entity = new HashMap<>();
    String longDescription = "d".repeat(5_000);
    entity.put("description", longDescription);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("description")).isEqualTo(longDescription);
    assertThat(cleaned).doesNotContainKey("columnDescriptionsTruncated");
  }

  @Test
  void longColumnDescriptionIsTruncatedWithTopLevelFlag() {
    Map<String, Object> entity = new HashMap<>();
    List<Map<String, Object>> columns = new ArrayList<>();
    columns.add(column("a", "x".repeat(900)));
    columns.add(column("b", "short"));
    entity.put("columns", columns);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat((String) columns.get(0).get("description")).hasSize(503).endsWith("...");
    assertThat(columns.get(1).get("description")).isEqualTo("short");
    assertThat(cleaned.get("columnDescriptionsTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void shortColumnDescriptionsProduceNoFlag() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("columns", List.of(column("a", "short"), column("b", null)));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned).doesNotContainKey("columnDescriptionsTruncated");
  }

  @Test
  void nestedChildColumnDescriptionsAreTruncatedRecursively() {
    Map<String, Object> child = column("inner", "y".repeat(700));
    Map<String, Object> parent = column("outer", "short");
    parent.put("children", List.of(child));
    Map<String, Object> entity = new HashMap<>();
    entity.put("columns", List.of(parent));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat((String) child.get("description")).hasSize(503).endsWith("...");
    assertThat(cleaned.get("columnDescriptionsTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void extensionSurvivesAtTableAndColumnLevel() {
    Map<String, Object> column = column("a", "short");
    column.put("extension", Map.of("colProp", "v"));
    Map<String, Object> entity = new HashMap<>();
    entity.put("extension", Map.of("tableProp", "v"));
    entity.put("columns", List.of(column));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("extension")).isEqualTo(Map.of("tableProp", "v"));
    assertThat(column.get("extension")).isEqualTo(Map.of("colProp", "v"));
  }

  @Test
  void noiseAndVectorFieldsAreRemoved() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("incrementalChangeDescription", Map.of("fieldsAdded", List.of()));
    entity.put("changeDescription", Map.of());
    entity.put("embedding", List.of(0.1, 0.2));
    entity.put("textToEmbed", "blob");
    entity.put("name", "orders");

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned)
        .doesNotContainKeys(
            "incrementalChangeDescription", "changeDescription", "embedding", "textToEmbed")
        .containsKey("name");
  }

  @Test
  void schemaDefinitionIsTruncatedWithFlag() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", "CREATE TABLE orders (".repeat(60));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat((String) cleaned.get("schemaDefinition")).hasSize(503).endsWith("...");
    assertThat(cleaned.get("schemaDefinitionTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void dataModelSqlAndRawSqlAreTruncatedWithFlag() {
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("sql", "SELECT 1 FROM t ".repeat(60));
    dataModel.put("rawSql", "SELECT 2 FROM t ".repeat(60));
    Map<String, Object> entity = new HashMap<>();
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    Map<String, Object> cleanedModel = castMap(cleaned.get("dataModel"));
    assertThat((String) cleanedModel.get("sql")).hasSize(503).endsWith("...");
    assertThat((String) cleanedModel.get("rawSql")).hasSize(503).endsWith("...");
    assertThat(cleanedModel.get("sqlTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void shortSchemaAndModelSqlAreUntouched() {
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("sql", "SELECT 1");
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", "CREATE TABLE t (id INT)");
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("schemaDefinition")).isEqualTo("CREATE TABLE t (id INT)");
    assertThat(cleaned).doesNotContainKey("schemaDefinitionTruncated");
    assertThat(castMap(cleaned.get("dataModel"))).doesNotContainKey("sqlTruncated");
  }

  @Test
  void nullEntityYieldsEmptyResponse() {
    assertThat(GetEntityTool.cleanEntityResponse(null)).isEmpty();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Object value) {
    return (Map<String, Object>) value;
  }
}
