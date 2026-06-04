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

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Pins the in-memory slimming that {@link RootCauseAnalysisTool} applies to the raw {@code
 * EsLineageData} edges and full ES node documents returned by the data-quality lineage search. The
 * integration test {@code McpToolsValidationIT#testRootCauseAnalysis} only exercises the
 * no-failure ({@code status:"success"}) path, so the downstream node/edge slim and the size budget
 * are covered here against hand-built fixtures.
 */
class RootCauseAnalysisToolTest {

  private static Map<String, Object> edgeWithSql(String sql) {
    Map<String, Object> edge = new HashMap<>();
    edge.put("fromEntity", refMap("up-id", "svc.db.raw", "table", "raw-hash"));
    edge.put("toEntity", refMap("down-id", "svc.db.orders", "table", "orders-hash"));
    edge.put("sqlQuery", sql);
    edge.put("source", "QueryLineage");
    edge.put("docId", "doc-1");
    edge.put("docUniqueId", "doc-unique-1");
    edge.put("createdBy", "ingestion-bot");
    edge.put("updatedAt", 1700000000000L);
    return edge;
  }

  private static Map<String, Object> refMap(String id, String fqn, String type, String fqnHash) {
    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("id", id);
    ref.put("fullyQualifiedName", fqn);
    ref.put("type", type);
    ref.put("fqnHash", fqnHash);
    return ref;
  }

  @Test
  void slimEdgeTruncatesLongSqlAndFlagsIt() {
    String longSql = "SELECT * FROM orders WHERE ".repeat(80);

    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(edgeWithSql(longSql), false);

    String sql = (String) slim.get("sqlQuery");
    assertThat(sql).hasSize(503).endsWith("...");
    assertThat(slim.get("sqlTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void slimEdgeKeepsShortSqlWithoutTruncationFlag() {
    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(edgeWithSql("SELECT 1"), false);

    assertThat(slim.get("sqlQuery")).isEqualTo("SELECT 1");
    assertThat(slim).doesNotContainKey("sqlTruncated");
  }

  @Test
  void slimEdgeDropsNoiseAndSlimsEndpoints() {
    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(edgeWithSql("SELECT 1"), false);

    assertThat(slim)
        .doesNotContainKeys("docId", "docUniqueId", "createdBy", "updatedAt", "pipeline");

    Map<String, Object> from = asMap(slim.get("fromEntity"));
    assertThat(from).containsKeys("id", "fullyQualifiedName", "type").doesNotContainKey("fqnHash");
  }

  @Test
  void slimEdgeDefaultsRelationshipToSqlAndBuildsFromPipeline() {
    Map<String, Object> sqlEdge = RootCauseAnalysisTool.slimEdge(edgeWithSql("SELECT 1"), false);
    assertThat(sqlEdge.get("relationshipType")).isEqualTo("sql");

    Map<String, Object> pipelined = edgeWithSql("SELECT 1");
    pipelined.put("pipeline", Map.of("type", "pipeline", "name", "daily_etl"));
    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(pipelined, false);
    assertThat(slim.get("relationshipType")).isEqualTo("pipeline:daily_etl");
  }

  @Test
  void slimEdgeOmitsColumnsByDefaultAndIncludesWhenRequested() {
    Map<String, Object> edge = edgeWithSql("SELECT 1");
    edge.put("columns", List.of(Map.of("fromColumns", List.of("a"), "toColumn", "b")));

    assertThat(RootCauseAnalysisTool.slimEdge(edge, false)).doesNotContainKey("columns");
    assertThat(RootCauseAnalysisTool.slimEdge(edge, true)).containsKey("columns");
  }

  @Test
  void slimNodeEntityRemovesColumnsAndTruncatesDescription() {
    Map<String, Object> node = new HashMap<>();
    node.put("name", "orders");
    node.put("fullyQualifiedName", "svc.db.orders");
    node.put("entityType", "table");
    node.put("columns", List.of(Map.of("name", "id"), Map.of("name", "amount")));
    node.put("schemaDefinition", "CREATE TABLE orders ...");
    node.put("embedding", List.of(0.1, 0.2, 0.3));
    node.put("textToEmbed", "concatenated text used to build the vector ...");
    node.put("textToLLMContext", "rag context blob ...");
    node.put("fingerprint", "abc123");
    node.put("chunkCount", 4);
    node.put("chunkIndex", 0);
    node.put("description", "x".repeat(900));

    Map<String, Object> slim = RootCauseAnalysisTool.slimNodeEntity(node);

    assertThat(slim)
        .doesNotContainKeys(
            "columns",
            "schemaDefinition",
            "embedding",
            "textToEmbed",
            "textToLLMContext",
            "fingerprint",
            "chunkCount",
            "chunkIndex");
    assertThat(slim).containsKeys("name", "fullyQualifiedName", "entityType");
    assertThat((String) slim.get("description")).hasSize(503).endsWith("...");
  }

  @Test
  void slimDownstreamNodesPreservesIdKeysAndSlimsEntity() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "orders");
    entity.put("columns", List.of(Map.of("name", "id")));
    Map<String, Object> nodeInfo = new HashMap<>();
    nodeInfo.put("entity", entity);
    nodeInfo.put("nodeDepth", 2);

    Map<String, Object> slim =
        RootCauseAnalysisTool.slimDownstreamNodes(Map.of("node-id", nodeInfo));

    assertThat(slim).containsOnlyKeys("node-id");
    Map<String, Object> slimNode = asMap(slim.get("node-id"));
    assertThat(slimNode.get("nodeDepth")).isEqualTo(2);
    assertThat(asMap(slimNode.get("entity"))).doesNotContainKey("columns");
  }

  @Test
  void slimEdgeMatchesRealEsLineageDataKeysAfterRoundTrip() {
    Map<String, Object> raw = new HashMap<>();
    raw.put(
        "fromEntity",
        refMap("11111111-1111-1111-1111-111111111111", "svc.db.raw", "table", "raw-hash"));
    raw.put(
        "toEntity",
        refMap("22222222-2222-2222-2222-222222222222", "svc.db.orders", "table", "orders-hash"));
    raw.put("pipeline", Map.of("type", "pipeline", "name", "daily_etl"));
    raw.put("sqlQuery", "SELECT * FROM raw ".repeat(60));
    raw.put("source", "QueryLineage");
    raw.put("docId", "doc-1");
    raw.put(
        "columns", List.of(Map.of("toColumn", "svc.db.orders.id", "fromColumns", List.of("a"))));

    EsLineageData typed = JsonUtils.convertValue(raw, EsLineageData.class);
    Map<String, Object> edgeMap = JsonUtils.getMap(typed);

    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(edgeMap, false);
    assertThat(slim.get("relationshipType")).isEqualTo("pipeline:daily_etl");
    assertThat((String) slim.get("sqlQuery")).hasSize(503).endsWith("...");
    assertThat(slim.get("sqlTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(slim.get("source")).isEqualTo("QueryLineage");
    assertThat(asMap(slim.get("fromEntity")).get("fullyQualifiedName")).isEqualTo("svc.db.raw");
    assertThat(slim).doesNotContainKeys("docId", "columns");
    assertThat(RootCauseAnalysisTool.slimEdge(edgeMap, true)).containsKey("columns");
  }

  @Test
  void slimEdgeCarriesSqlQueryKeyForDeduplicatedSql() {
    Map<String, Object> edge = edgeWithSql("");
    edge.put("sqlQueryKey", "3");

    Map<String, Object> slim = RootCauseAnalysisTool.slimEdge(edge, false);

    assertThat(slim.get("sqlQueryKey")).isEqualTo("3");
    assertThat(slim).doesNotContainKey("sqlQuery");
  }

  @Test
  void slimEdgeHandlesNullEdgeWithoutThrowing() {
    assertThat(RootCauseAnalysisTool.slimEdge(null, false)).isEmpty();
  }

  @Test
  void slimDownstreamNodesHandlesNullNodeInfoWithoutThrowing() {
    Map<String, Object> withNull = new LinkedHashMap<>();
    withNull.put("node-id", null);

    Map<String, Object> slim = RootCauseAnalysisTool.slimDownstreamNodes(withNull);

    assertThat(slim).containsOnlyKeys("node-id");
    assertThat(asMap(slim.get("node-id"))).isEmpty();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return (Map<String, Object>) value;
  }

  @Test
  void enforceSizeBudgetPassesThroughSmallResult() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("fqn", "svc.db.orders");
    result.put("status", "success");

    assertThat(RootCauseAnalysisTool.enforceSizeBudget(result)).isSameAs(result);
  }

  @Test
  void enforceSizeBudgetReturnsHintWhenOversized() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("fqn", "svc.db.orders");
    result.put("status", "failed");
    result.put("summary", "Found 1 upstream failure(s).");
    result.put("downstreamAnalysis", Map.of("blob", "z".repeat(200_000)));

    result.put("upstreamDepth", 3);
    result.put("downstreamDepth", 3);
    Map<String, Object> output = RootCauseAnalysisTool.enforceSizeBudget(result);

    assertThat(output.get("truncated")).isEqualTo(Boolean.TRUE);
    assertThat(output)
        .containsKeys("fqn", "upstreamDepth", "downstreamDepth", "status", "summary", "message");
    assertThat(output).doesNotContainKey("downstreamAnalysis");
  }
}
