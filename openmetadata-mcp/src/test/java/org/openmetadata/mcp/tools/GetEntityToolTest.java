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
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.utils.JsonUtils;

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

  private static Map<String, Object> wideEntity(int columnCount, int descriptionChars) {
    List<Map<String, Object>> columns = new ArrayList<>();
    for (int i = 0; i < columnCount; i++) {
      columns.add(column("col_" + i, "d".repeat(descriptionChars)));
    }
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "wide_table");
    entity.put("fullyQualifiedName", "svc.db.schema.wide_table");
    entity.put("description", "table level description");
    entity.put("columns", columns);
    return entity;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> columnsOf(Map<String, Object> entity) {
    return (List<Object>) entity.get("columns");
  }

  @Test
  void smallEntityGetsNoWindowMarkers() {
    Map<String, Object> entity = wideEntity(3, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(windowed)).hasSize(3);
    assertThat(windowed)
        .doesNotContainKeys(
            "columnsTruncated",
            "totalColumns",
            "returnedColumns",
            "hasMoreColumns",
            "columnOffset");
  }

  @Test
  void explicitLimitAndOffsetPageColumnsWithMarkers() {
    Map<String, Object> entity = wideEntity(20, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 5, 4);

    List<Object> cols = columnsOf(windowed);
    assertThat(cols).hasSize(4);
    assertThat(castMap(cols.get(0)).get("name")).isEqualTo("col_5");
    assertThat(windowed.get("totalColumns")).isEqualTo(20);
    assertThat(windowed.get("returnedColumns")).isEqualTo(4);
    assertThat(windowed.get("columnOffset")).isEqualTo(5);
    assertThat(windowed.get("columnsTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void lastPageReportsNoMoreColumns() {
    Map<String, Object> entity = wideEntity(10, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 8, 5);

    assertThat(columnsOf(windowed)).hasSize(2);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
    assertThat(windowed.get("returnedColumns")).isEqualTo(2);
  }

  @Test
  void oversizedColumnsAreAutoCappedUnderBudgetKeepingMetadata() {
    Map<String, Object> entity = wideEntity(2_000, 400);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    List<Object> cols = columnsOf(windowed);
    assertThat(cols).isNotEmpty().hasSizeLessThan(2_000);
    assertThat(windowed.get("columnsTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("totalColumns")).isEqualTo(2_000);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("name")).isEqualTo("wide_table");
    assertThat(windowed.get("description")).isEqualTo("table level description");
    assertThat(JsonUtils.pojoToJson(windowed).length())
        .isLessThan(McpResponseTrim.MAX_RESPONSE_CHARS);
  }

  @Test
  void explicitZeroColumnLimitReturnsNoColumnsAndStopsPaging() {
    Map<String, Object> entity = wideEntity(20, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, 0);

    assertThat(columnsOf(windowed)).isEmpty();
    assertThat(windowed.get("returnedColumns")).isEqualTo(0);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
  }

  @Test
  void entityOverheadExceedingBudgetReturnsNoColumnsAndStopsPaging() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "huge_meta_table");
    entity.put("description", "z".repeat((int) (McpResponseTrim.MAX_RESPONSE_CHARS * 0.85)));
    entity.put("columns", new ArrayList<>(List.of(column("a", "x"), column("b", "y"))));

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(windowed)).isEmpty();
    assertThat(windowed.get("returnedColumns")).isEqualTo(0);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
  }

  @Test
  void singleColumnLargerThanBudgetStillAdvancesPaging() {
    Map<String, Object> bigColumn = column("big_struct", "x");
    bigColumn.put("blob", "z".repeat((int) (McpResponseTrim.MAX_RESPONSE_CHARS * 0.85)));
    List<Map<String, Object>> columns = new ArrayList<>();
    columns.add(bigColumn);
    columns.add(column("normal", "y"));
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "wide_table");
    entity.put("columns", columns);

    Map<String, Object> firstPage = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(firstPage)).hasSize(1);
    assertThat(castMap(columnsOf(firstPage).get(0)).get("name")).isEqualTo("big_struct");
    assertThat(firstPage.get("returnedColumns")).isEqualTo(1);
    assertThat(firstPage.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void nonTableEntityWithoutColumnsPassesThrough() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "my_dashboard");
    entity.put("description", "dash");

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, 50);

    assertThat(windowed).isEqualTo(entity).doesNotContainKey("columnsTruncated");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Object value) {
    return (Map<String, Object>) value;
  }
}
