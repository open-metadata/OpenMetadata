package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class SearchIndexUtilsTest {

  @Test
  void stripDocMapIfOversizedDropsColumnTreeWhenStillTooLargeAfterLineage() {
    Map<String, Object> doc = oversizedContainerDoc();
    int before = JsonUtils.pojoToJson(doc).getBytes(StandardCharsets.UTF_8).length;

    Map<String, Object> stripped =
        SearchIndexUtils.stripDocMapIfOversized(doc, 4096, "doc-1", "container");

    int after = JsonUtils.pojoToJson(stripped).getBytes(StandardCharsets.UTF_8).length;
    assertTrue(after < before, "doc should shrink");
    assertTrue(after <= 4096, "doc should fit under the cap after the column tree is stripped");
    assertColumnTreeStripped(stripped, 3);
  }

  @Test
  void stripLineageForSizeDropsColumnTreeWhenStillTooLargeAfterLineage() {
    String json = JsonUtils.pojoToJson(oversizedContainerDoc());

    String stripped = SearchIndexUtils.stripLineageForSize(json, 4096, "doc-2", "container");

    assertTrue(stripped.getBytes(StandardCharsets.UTF_8).length <= 4096);
    assertFalse(stripped.contains("\"children\""), "nested children stripped from JSON");
    assertFalse(stripped.contains("columnNamesFuzzy"), "derived columnNamesFuzzy stripped");
  }

  @Test
  void stripDocMapIfOversizedLeavesNormalContainerUntouched() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", UUID.randomUUID().toString());
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("columns", new ArrayList<>(List.of(columnWithChildren("c1", 2))));
    doc.put("dataModel", dataModel);
    doc.put("columnNames", List.of("c1"));

    Map<String, Object> result =
        SearchIndexUtils.stripDocMapIfOversized(doc, 10 * 1024 * 1024, "doc-3", "container");

    assertColumnsRetainChildren(result);
    assertTrue(result.containsKey("columnNames"), "normal doc keeps columnNames");
  }

  @Test
  @SuppressWarnings("unchecked")
  void stripColumnTreeForSizeAlsoHandlesTopLevelTableColumns() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("columns", new ArrayList<>(List.of(columnWithChildren("c1", 3))));
    doc.put("columnNames", List.of("c1", "c1.a"));
    doc.put("columnNamesFuzzy", "c1 c1.a");

    SearchIndexUtils.stripColumnTreeForSize(doc);

    List<Map<String, Object>> columns = (List<Map<String, Object>>) doc.get("columns");
    assertFalse(columns.get(0).containsKey("children"), "table columns lose children too");
    assertFalse(doc.containsKey("columnNames"));
    assertFalse(doc.containsKey("columnNamesFuzzy"));
  }

  @SuppressWarnings("unchecked")
  private static void assertColumnTreeStripped(Map<String, Object> doc, int expectedTopLevel) {
    Map<String, Object> dataModel = (Map<String, Object>) doc.get("dataModel");
    List<Map<String, Object>> columns = (List<Map<String, Object>>) dataModel.get("columns");
    assertEquals(expectedTopLevel, columns.size(), "top-level columns are kept");
    for (Map<String, Object> column : columns) {
      assertFalse(column.containsKey("children"), "nested children are stripped");
    }
    assertFalse(doc.containsKey("columnNames"), "derived columnNames is stripped");
    assertFalse(doc.containsKey("columnNamesFuzzy"), "derived columnNamesFuzzy is stripped");
  }

  @SuppressWarnings("unchecked")
  private static void assertColumnsRetainChildren(Map<String, Object> doc) {
    Map<String, Object> dataModel = (Map<String, Object>) doc.get("dataModel");
    List<Map<String, Object>> columns = (List<Map<String, Object>>) dataModel.get("columns");
    assertTrue(columns.get(0).containsKey("children"), "small doc keeps children");
  }

  private static Map<String, Object> oversizedContainerDoc() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", UUID.randomUUID().toString());
    doc.put("name", "huge_container");
    List<Map<String, Object>> columns = new ArrayList<>();
    List<String> flattened = new ArrayList<>();
    for (int c = 0; c < 3; c++) {
      columns.add(columnWithChildren("col" + c, 2000));
      for (int i = 0; i < 2000; i++) {
        flattened.add("col" + c + ".child" + i);
      }
    }
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("columns", columns);
    doc.put("dataModel", dataModel);
    doc.put("columnNames", flattened);
    doc.put("columnNamesFuzzy", String.join(" ", flattened));
    return doc;
  }

  private static Map<String, Object> columnWithChildren(String name, int childCount) {
    Map<String, Object> column = new HashMap<>();
    column.put("name", name);
    column.put("dataType", "STRUCT");
    List<Map<String, Object>> children = new ArrayList<>();
    for (int i = 0; i < childCount; i++) {
      Map<String, Object> child = new HashMap<>();
      child.put("name", "child" + i);
      child.put("dataType", "VARCHAR");
      child.put("description", "child column with descriptive text to add bytes " + i);
      children.add(child);
    }
    column.put("children", children);
    return column;
  }
}
