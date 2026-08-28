package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchClient;

/**
 * Tests the SQL deduplication logic embedded in {@link SearchClient#ADD_UPDATE_LINEAGE}.
 *
 * <p>The Painless script runs server-side and cannot be executed in a unit test, so these tests
 * implement the equivalent logic in Java. Any change to the script must be mirrored here (and
 * vice versa) so regressions are caught before deployment.
 *
 * <p>The script must:
 * <ol>
 *   <li>Detect a non-empty {@code sqlQuery} on the incoming edge.
 *   <li>Store the SQL text once in the doc-level {@code lineageSqlQueries} map, keyed by a
 *       sequential integer.
 *   <li>Replace {@code sqlQuery} on the edge with a {@code sqlQueryKey} reference.
 *   <li>If the same SQL already exists in the map, reuse the existing key.
 *   <li>Add the edge to {@code upstreamLineage} or update the existing entry by {@code docUniqueId}.
 * </ol>
 */
class AddUpdateLineageScriptTest {

  /**
   * Java implementation of ADD_UPDATE_LINEAGE — mirrors the Painless script exactly.
   * Update this whenever the script in SearchClient.java is changed.
   */
  @SuppressWarnings("unchecked")
  private void runScript(Map<String, Object> doc, Map<String, Object> lineageData) {
    String rawSql = (String) lineageData.get("sqlQuery");
    Map<String, Object> edgeData;

    if (rawSql != null && !rawSql.isEmpty()) {
      Map<String, String> sqlMap =
          (Map<String, String>)
              doc.computeIfAbsent("lineageSqlQueries", k -> new LinkedHashMap<>());

      String sqlKey = null;
      for (Map.Entry<String, String> entry : sqlMap.entrySet()) {
        if (entry.getValue().equals(rawSql)) {
          sqlKey = entry.getKey();
          break;
        }
      }
      if (sqlKey == null) {
        int maxKey = 0;
        for (String k : sqlMap.keySet()) {
          int kInt = Integer.parseInt(k);
          if (kInt > maxKey) maxKey = kInt;
        }
        sqlKey = String.valueOf(maxKey + 1);
        sqlMap.put(sqlKey, rawSql);
      }
      edgeData = new HashMap<>(lineageData);
      edgeData.put("sqlQueryKey", sqlKey);
      edgeData.remove("sqlQuery");
    } else {
      edgeData = new HashMap<>(lineageData);
    }

    List<Map<String, Object>> upstreamLineage =
        (List<Map<String, Object>>) doc.get("upstreamLineage");
    String oldSqlQueryKey = null;
    boolean found = false;
    for (int i = 0; i < upstreamLineage.size(); i++) {
      String existingId = (String) upstreamLineage.get(i).get("docUniqueId");
      String incomingId = (String) lineageData.get("docUniqueId");
      if (existingId != null && existingId.equalsIgnoreCase(incomingId)) {
        oldSqlQueryKey = (String) upstreamLineage.get(i).get("sqlQueryKey");
        upstreamLineage.set(i, edgeData);
        found = true;
        break;
      }
    }
    if (!found) {
      upstreamLineage.add(edgeData);
    }
    // Prune old SQL key if it changed and is no longer used by any edge
    String newSqlQueryKey = (String) edgeData.get("sqlQueryKey");
    if (oldSqlQueryKey != null && !oldSqlQueryKey.equals(newSqlQueryKey)) {
      boolean stillUsed = false;
      for (Map<String, Object> lineage : upstreamLineage) {
        if (oldSqlQueryKey.equals(lineage.get("sqlQueryKey"))) {
          stillUsed = true;
          break;
        }
      }
      @SuppressWarnings("unchecked")
      Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");
      if (!stillUsed && sqlMap != null) {
        sqlMap.remove(oldSqlQueryKey);
      }
    }
  }

  private Map<String, Object> emptyDoc() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("upstreamLineage", new ArrayList<>());
    return doc;
  }

  private Map<String, Object> edge(String docUniqueId, String sql) {
    Map<String, Object> edge = new HashMap<>();
    edge.put("docUniqueId", docUniqueId);
    if (sql != null) {
      edge.put("sqlQuery", sql);
    }
    return edge;
  }

  // ── script constant smoke test ────────────────────────────────────────────

  @Test
  void scriptConstantContainsDedupFields() {
    assertTrue(
        SearchClient.ADD_UPDATE_LINEAGE.contains("lineageSqlQueries"),
        "Script must reference lineageSqlQueries");
    assertTrue(
        SearchClient.ADD_UPDATE_LINEAGE.contains("sqlQueryKey"),
        "Script must set sqlQueryKey on the edge");
    assertTrue(
        SearchClient.ADD_UPDATE_LINEAGE.contains("sqlQuery"),
        "Script must read sqlQuery from the incoming edge");
  }

  // ── deduplication logic tests ─────────────────────────────────────────────

  @Test
  @SuppressWarnings("unchecked")
  void firstEdgeWithSql_storedInMapAndKeySet() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", "SELECT * FROM src"));

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(1, edges.size());
    assertEquals("1", edges.get(0).get("sqlQueryKey"));
    assertNull(edges.get(0).get("sqlQuery"), "sqlQuery must be cleared from edge");
    assertEquals(Map.of("1", "SELECT * FROM src"), sqlMap);
  }

  @Test
  @SuppressWarnings("unchecked")
  void secondEdgeWithSameSql_reusesKey() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", "SELECT * FROM src"));
    runScript(doc, edge("edge-2", "SELECT * FROM src"));

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(2, edges.size());
    assertEquals("1", edges.get(0).get("sqlQueryKey"));
    assertEquals("1", edges.get(1).get("sqlQueryKey"), "same SQL must reuse the same key");
    assertEquals(1, sqlMap.size(), "SQL stored exactly once even with 2 edges");
  }

  @Test
  @SuppressWarnings("unchecked")
  void edgesWithDistinctSqls_getSequentialKeys() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", "SELECT a FROM t1"));
    runScript(doc, edge("edge-2", "SELECT b FROM t2"));
    runScript(doc, edge("edge-3", "SELECT c FROM t3"));

    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(3, sqlMap.size());
    assertEquals("SELECT a FROM t1", sqlMap.get("1"));
    assertEquals("SELECT b FROM t2", sqlMap.get("2"));
    assertEquals("SELECT c FROM t3", sqlMap.get("3"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void edgeWithNoSql_notModified_noMapEntry() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", null));

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");

    assertEquals(1, edges.size());
    assertNull(edges.get(0).get("sqlQueryKey"), "edge without SQL must not get a key");
    assertFalse(doc.containsKey("lineageSqlQueries"), "no SQL map created when no SQL present");
  }

  @Test
  @SuppressWarnings("unchecked")
  void updateExistingEdge_replacesInPlace() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", "SELECT old FROM t"));

    Map<String, Object> updatedEdge = edge("edge-1", "SELECT new FROM t");
    runScript(doc, updatedEdge);

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(1, edges.size(), "update must not add a second entry");
    assertEquals(1, sqlMap.size(), "old unused SQL key is pruned");
    assertEquals("2", edges.get(0).get("sqlQueryKey"), "updated edge points to new SQL key");
    assertEquals("SELECT new FROM t", sqlMap.get("2"), "map contains only the new SQL");
  }

  @Test
  @SuppressWarnings("unchecked")
  void batchRunScenario_660EdgesSameSql_oneMapEntry() {
    String largeSql = "CREATE OR REPLACE VIEW v AS " + "SELECT id FROM src ".repeat(200);
    Map<String, Object> doc = emptyDoc();

    for (int i = 1; i <= 660; i++) {
      runScript(doc, edge("edge-" + i, largeSql));
    }

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(660, edges.size());
    assertEquals(1, sqlMap.size(), "660 identical SQLs must produce exactly 1 map entry");
    assertTrue(edges.stream().allMatch(e -> "1".equals(e.get("sqlQueryKey"))));
    assertTrue(edges.stream().noneMatch(e -> e.get("sqlQuery") != null));
  }

  @Test
  @SuppressWarnings("unchecked")
  void mixedEdges_onlySqlEdgesDeduplicated() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, edge("edge-1", "SELECT 1"));
    runScript(doc, edge("edge-2", null));
    runScript(doc, edge("edge-3", "SELECT 1"));

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    Map<String, String> sqlMap = (Map<String, String>) doc.get("lineageSqlQueries");

    assertEquals(3, edges.size());
    assertEquals("1", edges.get(0).get("sqlQueryKey"));
    assertNull(edges.get(1).get("sqlQueryKey"));
    assertEquals("1", edges.get(2).get("sqlQueryKey"));
    assertEquals(1, sqlMap.size());
  }
}
