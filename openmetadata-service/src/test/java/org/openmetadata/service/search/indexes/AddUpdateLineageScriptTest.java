package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Collections;
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
 *   <li>Copy {@code params.lineageData} before mutating it — Painless script params are read-only.
 *   <li>Initialize {@code upstreamLineage} when the matched doc carries no such field.
 * </ol>
 */
class AddUpdateLineageScriptTest {

  /**
   * Java implementation of ADD_UPDATE_LINEAGE — mirrors the Painless script exactly.
   * Update this whenever the script in SearchClient.java is changed.
   *
   * <p>The incoming edge is wrapped read-only to reproduce Painless' immutable script params: a
   * mirror that writes through to it would throw here exactly as the script does in OpenSearch.
   */
  @SuppressWarnings("unchecked")
  private void runScript(Map<String, Object> doc, Map<String, Object> incomingEdge) {
    Map<String, Object> lineageData = Collections.unmodifiableMap(incomingEdge);
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
    if (upstreamLineage == null) {
      upstreamLineage = new ArrayList<>();
      doc.put("upstreamLineage", upstreamLineage);
    }
    String oldSqlQueryKey = null;
    boolean found = false;
    for (int i = 0; i < upstreamLineage.size(); i++) {
      Map<String, Object> existing = upstreamLineage.get(i);
      String existingId = (String) existing.get("docUniqueId");
      String incomingId = (String) lineageData.get("docUniqueId");
      if (existingId != null && existingId.equalsIgnoreCase(incomingId)) {
        oldSqlQueryKey = (String) existing.get("sqlQueryKey");
        carryForwardCreation(existing, edgeData);
        carryForwardLastUpdate(existing, edgeData);
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

  /** The stored edge keeps the earliest creation stamp when an update carries a later one. */
  private void carryForwardCreation(Map<String, Object> old, Map<String, Object> edgeData) {
    Long carryCreatedAt = asEpochMillis(old.get("createdAt"));
    Long newCreatedAt = asEpochMillis(edgeData.get("createdAt"));
    if (carryCreatedAt == null || (newCreatedAt != null && carryCreatedAt >= newCreatedAt)) {
      return;
    }
    edgeData.put("createdAt", carryCreatedAt);
    Object carryCreatedBy = old.get("createdBy");
    if (carryCreatedBy != null) {
      edgeData.put("createdBy", carryCreatedBy);
    }
  }

  /** The stored edge keeps the latest update stamp when an update carries an earlier one. */
  private void carryForwardLastUpdate(Map<String, Object> old, Map<String, Object> edgeData) {
    Long carryUpdatedAt = asEpochMillis(old.get("updatedAt"));
    Long newUpdatedAt = asEpochMillis(edgeData.get("updatedAt"));
    if (carryUpdatedAt == null || (newUpdatedAt != null && carryUpdatedAt <= newUpdatedAt)) {
      return;
    }
    edgeData.put("updatedAt", carryUpdatedAt);
    Object carryUpdatedBy = old.get("updatedBy");
    if (carryUpdatedBy != null) {
      edgeData.put("updatedBy", carryUpdatedBy);
    }
  }

  private Long asEpochMillis(Object value) {
    return value == null ? null : ((Number) value).longValue();
  }

  private Map<String, Object> emptyDoc() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("upstreamLineage", new ArrayList<>());
    return doc;
  }

  private Map<String, Object> auditedEdge(String docUniqueId, long createdAt, long updatedAt) {
    Map<String, Object> edge = edge(docUniqueId, null);
    edge.put("createdAt", createdAt);
    edge.put("createdBy", "user-" + createdAt);
    edge.put("updatedAt", updatedAt);
    edge.put("updatedBy", "user-" + updatedAt);
    return edge;
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

  @Test
  void scriptConstantCopiesParamsAndGuardsMissingLineage() {
    assertFalse(
        SearchClient.ADD_UPDATE_LINEAGE.contains("edgeData = params.lineageData"),
        "Script must copy params.lineageData before mutating it — Painless params are read-only");
    assertTrue(
        SearchClient.ADD_UPDATE_LINEAGE.contains("ctx._source.upstreamLineage == null"),
        "Script must initialize upstreamLineage before dereferencing it");
  }

  // ── read-only params and missing-field guards ─────────────────────────────

  @Test
  @SuppressWarnings("unchecked")
  void missingUpstreamLineageField_initializedBeforeUse() {
    Map<String, Object> doc = new HashMap<>();

    runScript(doc, edge("edge-1", null));

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    assertNotNull(edges, "upstreamLineage must be initialized when the doc carries no such field");
    assertEquals(1, edges.size());
    assertEquals("edge-1", edges.get(0).get("docUniqueId"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void updateEdgeWithoutSql_carriesAuditForwardWithoutTouchingParams() {
    Map<String, Object> doc = emptyDoc();
    runScript(doc, auditedEdge("edge-1", 1_000L, 5_000L));

    Map<String, Object> update = auditedEdge("edge-1", 9_000L, 2_000L);
    runScript(doc, update);

    List<Map<String, Object>> edges = (List<Map<String, Object>>) doc.get("upstreamLineage");
    assertEquals(1, edges.size(), "update must not add a second entry");
    assertEquals(1_000L, edges.get(0).get("createdAt"), "earliest createdAt is preserved");
    assertEquals("user-1000", edges.get(0).get("createdBy"));
    assertEquals(5_000L, edges.get(0).get("updatedAt"), "latest updatedAt is preserved");
    assertEquals("user-5000", edges.get(0).get("updatedBy"));
    assertEquals(9_000L, update.get("createdAt"), "incoming edge params must not be mutated");
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
