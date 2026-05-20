package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.FullyQualifiedName;

// Mirror of EXCLUDED_FIELDS — can't reference it directly
// because SearchIndex has a static initializer that requires Entity to be bootstrapped.

class SearchIndexTest {

  private static final Set<String> EXCLUDED_FIELDS =
      Set.of(
          "changeDescription",
          "incrementalChangeDescription",
          "upstreamLineage.pipeline.changeDescription",
          "upstreamLineage.pipeline.incrementalChangeDescription",
          "connection",
          "changeSummary");

  private static final Set<String> BANNED_FIELDS =
      Set.of("changeDescription", "incrementalChangeDescription", "changeSummary");

  // Test the getFQNParts logic directly without instantiating SearchIndex
  private Set<String> getFQNParts(String fqn) {
    var parts = FullyQualifiedName.split(fqn);
    var entityName = parts[parts.length - 1];

    return FullyQualifiedName.getAllParts(fqn).stream()
        .filter(part -> !part.equals(entityName))
        .collect(Collectors.toSet());
  }

  @Test
  void testGetFQNParts_excludesEntityName() {
    String tableFqn = "service.database.schema.table";
    Set<String> parts = getFQNParts(tableFqn);
    assertFalse(parts.contains("table"), "Entity name 'table' should not be included in FQN parts");

    assertTrue(parts.contains("service"));
    assertTrue(parts.contains("database"));
    assertTrue(parts.contains("schema"));
    assertTrue(parts.contains("service.database"));
    assertTrue(parts.contains("service.database.schema"));
    assertTrue(parts.contains("service.database.schema.table"));
    assertTrue(parts.contains("database.schema"));
    assertTrue(parts.contains("schema.table"));
    assertTrue(parts.contains("database.schema.table"));
    assertEquals(9, parts.size());
  }

  @Test
  void testGetFQNParts_withDifferentPatterns() {
    // Test pipeline pattern: service.pipeline
    String pipelineFqn = "airflow.my_pipeline";
    Set<String> pipelineParts = getFQNParts(pipelineFqn);
    assertFalse(pipelineParts.contains("my_pipeline"), "Entity name should not be included");
    assertTrue(pipelineParts.contains("airflow"));
    assertEquals(2, pipelineParts.size());

    // Test dashboard pattern: service.dashboard
    String dashboardFqn = "looker.sales_dashboard";
    Set<String> dashboardParts = getFQNParts(dashboardFqn);
    assertFalse(dashboardParts.contains("sales_dashboard"), "Entity name should not be included");
    assertTrue(dashboardParts.contains("looker"));
    assertEquals(2, dashboardParts.size());

    // Test dashboard chart pattern: service.dashboard.chart
    String chartFqn = "tableau.analytics.revenue_chart";
    Set<String> chartParts = getFQNParts(chartFqn);
    assertFalse(chartParts.contains("revenue_chart"), "Entity name should not be included");
    assertTrue(chartParts.contains("tableau"));
    assertTrue(chartParts.contains("analytics"));
    assertTrue(chartParts.contains("tableau.analytics"));
    assertEquals(5, chartParts.size());
  }

  @Test
  void testGetFQNParts_withQuotedNames() {
    // Test with quoted names that contain dots
    String quotedFqn = "\"service.v1\".database.\"schema.prod\".\"table.users\"";
    Set<String> parts = getFQNParts(quotedFqn);

    // Verify that the entity name is not included
    assertFalse(parts.contains("\"table.users\""), "Entity name should not be included");
    assertFalse(parts.contains("table.users"), "Entity name should not be included");

    // Verify other parts are included
    assertTrue(parts.contains("\"service.v1\""));
    assertTrue(parts.contains("database"));
    assertTrue(parts.contains("\"schema.prod\""));
  }

  @Test
  void testGetFQNParts_withSinglePart() {
    // Test with a single part FQN (edge case)
    String singlePartFqn = "standalone_entity";
    Set<String> parts = getFQNParts(singlePartFqn);

    // Should return empty set since we exclude the entity name
    assertTrue(parts.isEmpty(), "Single part FQN should return empty set");
  }

  @Test
  void testChangeDescriptionWithStringNewValueIsRemoved() {
    Map<String, Object> doc = buildDocWithChangeDescription("some text value");

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    assertFalse(
        doc.containsKey("changeDescription"),
        "changeDescription should be removed from top-level doc");
    assertEquals("test-query", doc.get("name"));
  }

  @Test
  void testChangeDescriptionWithBooleanNewValueIsRemoved() {
    Map<String, Object> doc = buildDocWithChangeDescription(true);

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    assertFalse(
        doc.containsKey("changeDescription"),
        "changeDescription with boolean newValue should be removed");
  }

  @Test
  void testChangeDescriptionWithMixedTypesInFieldsUpdated() {
    // Simulates the exact scenario from the ES/OS error: first doc has string newValue,
    // second doc has boolean newValue. Both should be stripped.
    Map<String, Object> doc1 = buildDocWithChangeDescription("text value");
    Map<String, Object> doc2 = buildDocWithChangeDescription(false);

    SearchIndexUtils.removeNonIndexableFields(doc1, EXCLUDED_FIELDS);
    SearchIndexUtils.removeNonIndexableFields(doc2, EXCLUDED_FIELDS);

    assertFalse(doc1.containsKey("changeDescription"));
    assertFalse(doc2.containsKey("changeDescription"));
  }

  @Test
  void testIncrementalChangeDescriptionIsAlsoRemoved() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test-query");
    doc.put(
        "incrementalChangeDescription",
        Map.of("fieldsUpdated", List.of(Map.of("name", "deleted", "newValue", true))));

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    assertFalse(
        doc.containsKey("incrementalChangeDescription"),
        "incrementalChangeDescription should be removed");
  }

  @Test
  void testNestedChangeDescriptionMustNotLeakIntoDoc() {
    // Nested entities (e.g., a Query inside QueryCostRecord) must have
    // changeDescription stripped BEFORE being placed into the doc.
    // The index code (e.g., QueryCostRecordIndex) is responsible for
    // nulling out changeDescription on nested entities. This test
    // verifies that if someone forgets, findBannedFields catches it.
    Map<String, Object> nestedEntity = new HashMap<>();
    nestedEntity.put("id", "ref-1");
    nestedEntity.put(
        "changeDescription",
        Map.of("fieldsUpdated", List.of(Map.of("name", "field", "newValue", true))));

    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test-query");
    doc.put("someNestedRef", nestedEntity);

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    assertFalse(
        doc.containsKey("changeDescription"), "Top-level changeDescription should be removed");

    List<String> violations = findBannedFields(doc, BANNED_FIELDS);
    assertFalse(
        violations.isEmpty(),
        "Nested changeDescription should be detected — index code must null it before doc.put()");
    assertTrue(violations.get(0).contains("someNestedRef.changeDescription"));
  }

  @Test
  void testNoBannedFieldsAfterProperCleanup() {
    Map<String, Object> nestedEntity = new HashMap<>();
    nestedEntity.put("id", "ref-1");
    nestedEntity.put("name", "clean-entity");

    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test-record");
    doc.put("changeDescription", Map.of("fieldsUpdated", List.of()));
    doc.put("incrementalChangeDescription", Map.of("fieldsUpdated", List.of()));
    doc.put("changeSummary", Map.of());
    doc.put("nestedRef", nestedEntity);

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    List<String> violations = findBannedFields(doc, BANNED_FIELDS);
    assertTrue(violations.isEmpty(), "No banned fields should remain after cleanup: " + violations);
  }

  @Test
  void testBannedFieldsDetectedAtMultipleNestingLevels() {
    Map<String, Object> level2 = new HashMap<>();
    level2.put("id", "deep");
    level2.put("changeDescription", Map.of("fieldsUpdated", List.of()));

    Map<String, Object> level1 = new HashMap<>();
    level1.put("id", "mid");
    level1.put("incrementalChangeDescription", Map.of("fieldsUpdated", List.of()));
    level1.put("child", level2);

    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test");
    doc.put("nested", level1);

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    List<String> violations = findBannedFields(doc, BANNED_FIELDS);
    assertEquals(2, violations.size(), "Should detect banned fields at both nesting levels");
  }

  @Test
  void testBannedFieldsDetectedInsideLists() {
    Map<String, Object> listItem = new HashMap<>();
    listItem.put("id", "item-1");
    listItem.put("changeDescription", Map.of("fieldsUpdated", List.of()));

    List<Object> items = new ArrayList<>();
    items.add(listItem);

    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test");
    doc.put("entities", items);

    SearchIndexUtils.removeNonIndexableFields(doc, EXCLUDED_FIELDS);

    List<String> violations = findBannedFields(doc, BANNED_FIELDS);
    assertFalse(violations.isEmpty(), "Should detect changeDescription inside list items");
  }

  @SuppressWarnings("unchecked")
  private static List<String> findBannedFields(Map<String, Object> doc, Set<String> bannedKeys) {
    List<String> violations = new ArrayList<>();
    findBannedFieldsRecursive(doc, bannedKeys, "", violations);
    return violations;
  }

  @SuppressWarnings("unchecked")
  private static void findBannedFieldsRecursive(
      Map<String, Object> map, Set<String> bannedKeys, String path, List<String> violations) {
    for (Map.Entry<String, Object> entry : map.entrySet()) {
      String fullPath = path.isEmpty() ? entry.getKey() : path + "." + entry.getKey();
      if (bannedKeys.contains(entry.getKey())) {
        violations.add(fullPath);
      }
      Object value = entry.getValue();
      if (value instanceof Map) {
        findBannedFieldsRecursive((Map<String, Object>) value, bannedKeys, fullPath, violations);
      } else if (value instanceof List) {
        int i = 0;
        for (Object item : (List<?>) value) {
          if (item instanceof Map) {
            findBannedFieldsRecursive(
                (Map<String, Object>) item, bannedKeys, fullPath + "[" + i + "]", violations);
          }
          i++;
        }
      }
    }
  }

  // ── SQL deduplication tests ──────────────────────────────────────────────

  @Test
  void testDeduplicateSql_noEdges_returnsEmptyMap() {
    Map<String, String> result =
        SearchIndexUtils.deduplicateSqlAcrossEdges(Collections.emptyList());
    assertTrue(result.isEmpty());
  }

  @Test
  void testDeduplicateSql_edgesWithNoSql_untouched() {
    EsLineageData e1 = new EsLineageData();
    EsLineageData e2 = new EsLineageData();

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(List.of(e1, e2));

    assertTrue(result.isEmpty(), "no SQL means no dedup map entries");
    assertNull(e1.getSqlQueryKey());
    assertNull(e2.getSqlQueryKey());
  }

  @Test
  void testDeduplicateSql_singleEdgeWithSql_getsKeyOne() {
    EsLineageData edge = new EsLineageData().withSqlQuery("SELECT 1");

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(List.of(edge));

    assertEquals(Map.of("1", "SELECT 1"), result);
    assertEquals("1", edge.getSqlQueryKey());
    assertNull(edge.getSqlQuery(), "sql text should be cleared after keying");
  }

  @Test
  void testDeduplicateSql_identicalSqlAcrossEdges_sameKey() {
    String sql = "CREATE OR REPLACE VIEW analytics AS SELECT * FROM source";
    List<EsLineageData> edges =
        List.of(
            new EsLineageData().withSqlQuery(sql),
            new EsLineageData().withSqlQuery(sql),
            new EsLineageData().withSqlQuery(sql));

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(edges);

    assertEquals(1, result.size(), "identical SQL stored exactly once");
    assertEquals("1", result.keySet().iterator().next());
    for (EsLineageData edge : edges) {
      assertEquals("1", edge.getSqlQueryKey(), "all edges should reference the same key");
      assertNull(edge.getSqlQuery(), "sql text cleared on all edges");
    }
  }

  @Test
  void testDeduplicateSql_distinctSqls_getSequentialKeys() {
    EsLineageData e1 = new EsLineageData().withSqlQuery("SELECT a FROM t1");
    EsLineageData e2 = new EsLineageData().withSqlQuery("SELECT b FROM t2");
    EsLineageData e3 = new EsLineageData().withSqlQuery("SELECT c FROM t3");

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(List.of(e1, e2, e3));

    assertEquals(3, result.size());
    assertEquals("SELECT a FROM t1", result.get("1"));
    assertEquals("SELECT b FROM t2", result.get("2"));
    assertEquals("SELECT c FROM t3", result.get("3"));
    assertEquals("1", e1.getSqlQueryKey());
    assertEquals("2", e2.getSqlQueryKey());
    assertEquals("3", e3.getSqlQueryKey());
  }

  @Test
  void testDeduplicateSql_mixedEdgesSomeSqlSomeNot() {
    String sql = "SELECT id FROM src";
    EsLineageData withSql1 = new EsLineageData().withSqlQuery(sql);
    EsLineageData noSql = new EsLineageData();
    EsLineageData withSql2 = new EsLineageData().withSqlQuery(sql);

    Map<String, String> result =
        SearchIndexUtils.deduplicateSqlAcrossEdges(List.of(withSql1, noSql, withSql2));

    assertEquals(Map.of("1", sql), result);
    assertEquals("1", withSql1.getSqlQueryKey());
    assertNull(withSql1.getSqlQuery());
    assertNull(noSql.getSqlQueryKey(), "edge without SQL should not get a key");
    assertEquals("1", withSql2.getSqlQueryKey());
  }

  @Test
  void testDeduplicateSql_batchRunScenario_660EdgesSameSql() {
    // Mirrors the real-world scenario: a BATCH_RUN VIEW has 660+ upstream tables,
    // each edge carrying the same ~30 KB CREATE VIEW SQL.
    // After dedup the map should have exactly 1 entry and all edges share key "1".
    String largeSql =
        "CREATE OR REPLACE VIEW batch_view AS " + "SELECT * FROM source_table ".repeat(500);
    int edgeCount = 660;

    List<EsLineageData> edges =
        IntStream.range(0, edgeCount)
            .mapToObj(i -> new EsLineageData().withSqlQuery(largeSql))
            .collect(Collectors.toList());

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(edges);

    assertEquals(1, result.size(), "660 identical SQLs deduplicated to 1 entry");
    assertEquals(largeSql, result.get("1"));
    for (EsLineageData edge : edges) {
      assertEquals("1", edge.getSqlQueryKey());
      assertNull(edge.getSqlQuery());
    }
  }

  @Test
  void testDeduplicateSql_partialDuplication_correctGrouping() {
    // sqlA appears on 3 edges, sqlB appears on 2 edges, sqlC appears once.
    String sqlA = "SELECT a FROM tA";
    String sqlB = "SELECT b FROM tB";
    String sqlC = "SELECT c FROM tC";

    List<EsLineageData> edges =
        List.of(
            new EsLineageData().withSqlQuery(sqlA),
            new EsLineageData().withSqlQuery(sqlB),
            new EsLineageData().withSqlQuery(sqlA),
            new EsLineageData().withSqlQuery(sqlC),
            new EsLineageData().withSqlQuery(sqlA),
            new EsLineageData().withSqlQuery(sqlB));

    Map<String, String> result = SearchIndexUtils.deduplicateSqlAcrossEdges(edges);

    assertEquals(3, result.size());
    // Keys assigned in first-seen order
    String keyA = edges.get(0).getSqlQueryKey();
    String keyB = edges.get(1).getSqlQueryKey();
    String keyC = edges.get(3).getSqlQueryKey();

    assertNotEquals(keyA, keyB);
    assertNotEquals(keyA, keyC);
    assertNotEquals(keyB, keyC);

    // All edges with the same SQL share the same key
    assertEquals(keyA, edges.get(2).getSqlQueryKey());
    assertEquals(keyA, edges.get(4).getSqlQueryKey());
    assertEquals(keyB, edges.get(5).getSqlQueryKey());

    // The map stores the correct SQL for each key
    assertEquals(sqlA, result.get(keyA));
    assertEquals(sqlB, result.get(keyB));
    assertEquals(sqlC, result.get(keyC));
  }

  private Map<String, Object> buildDocWithChangeDescription(Object newValue) {
    Map<String, Object> fieldChange = new HashMap<>();
    fieldChange.put("name", "deleted");
    fieldChange.put("oldValue", "oldVal");
    fieldChange.put("newValue", newValue);

    List<Object> fieldsUpdated = new ArrayList<>();
    fieldsUpdated.add(fieldChange);

    Map<String, Object> changeDesc = new HashMap<>();
    changeDesc.put("fieldsUpdated", fieldsUpdated);
    changeDesc.put("previousVersion", 0.1);

    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "test-query");
    doc.put("fullyQualifiedName", "service.test-query");
    doc.put("changeDescription", changeDesc);
    return doc;
  }
}
