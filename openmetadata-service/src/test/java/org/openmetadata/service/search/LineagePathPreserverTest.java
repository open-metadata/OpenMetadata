package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.lineage.NodeInformation;

class LineagePathPreserverTest {

  private static final String ROOT = "svc.db.schema.root";
  private static final String MID_ONE = "svc.db.schema.midOne";
  private static final String MID_TWO = "svc.db.schema.midTwo";
  private static final String LEAF = "svc.db.schema.leaf";

  @Test
  void preservePathsWithEdgesAddsIntermediateNodesAndKeepsConnectingEdges() {
    SearchLineageResult result = lineageResultWithChain();

    SearchLineageResult preserved =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of(LEAF));

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), preserved.getNodes().keySet());
    assertEquals(
        Set.of("root-mid1", "mid1-mid2", "mid2-leaf"), preserved.getUpstreamEdges().keySet());
  }

  @Test
  void filterByColumnsPreservesRootPathForMatchingLeafEdge() {
    SearchLineageResult result = lineageResultWithChain();

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "toColumn:ssn", ROOT);

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), filtered.getNodes().keySet());
    assertEquals(
        Set.of("root-mid1", "mid1-mid2", "mid2-leaf"), filtered.getUpstreamEdges().keySet());
    assertNotSame(result, filtered);
    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), result.getNodes().keySet());
  }

  @Test
  void filterByColumnsWithMetadataPreservesRootPathForTagMatches() {
    SearchLineageResult result = lineageResultWithChain();
    ColumnMetadataCache metadataCache = new ColumnMetadataCache();
    metadataCache.loadColumnMetadata(
        Set.of(LEAF + ".ssn"),
        fqn ->
            Map.of(
                "fullyQualifiedName",
                LEAF,
                "columns",
                List.of(
                    Map.of("name", "ssn", "tags", List.of(Map.of("tagFQN", "PII.Sensitive"))))));

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumnsWithMetadata(
            result, "tag:Sensitive", ROOT, metadataCache);

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), filtered.getNodes().keySet());
    assertEquals(
        Set.of("root-mid1", "mid1-mid2", "mid2-leaf"), filtered.getUpstreamEdges().keySet());
    assertNotSame(result, filtered);
    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), result.getNodes().keySet());
  }

  @Test
  void filterByColumnsReturnsOriginalResultForBlankFilters() {
    SearchLineageResult result = lineageResultWithChain();

    assertSame(result, LineagePathPreserver.filterByColumns(result, "   ", ROOT));
  }

  @Test
  void preservePathsRestoresFilteredAncestorsFromUnfilteredNodeMap() {
    SearchLineageResult filteredResult = new SearchLineageResult();
    filteredResult.setNodes(Map.of(ROOT, node(ROOT), LEAF, node(LEAF)));
    filteredResult.setUpstreamEdges(
        Map.of(
            "root-mid1", edge(ROOT, MID_ONE, null),
            "mid1-mid2", edge(MID_ONE, MID_TWO, null),
            "mid2-leaf", edge(MID_TWO, LEAF, leafColumn())));

    SearchLineageResult preserved =
        LineagePathPreserver.preservePaths(
            filteredResult, ROOT, lineageResultWithChain().getNodes());

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), preserved.getNodes().keySet());
  }

  @Test
  void preservePathsWithEdgesKeepsMatchingDownstreamConnections() {
    SearchLineageResult result = lineageResultWithChain();
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(
        Map.of(
            "root-mid1", edge(ROOT, MID_ONE, null),
            "mid1-mid2", edge(MID_ONE, MID_TWO, null),
            "mid2-leaf", edge(MID_TWO, LEAF, leafColumn())));

    SearchLineageResult preserved =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of(LEAF));

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), preserved.getNodes().keySet());
    assertEquals(
        Set.of("root-mid1", "mid1-mid2", "mid2-leaf"), preserved.getDownstreamEdges().keySet());
  }

  @Test
  void preservePathsWithEdgesHandlesDiamondTopology() {
    String left = "svc.db.schema.left";
    String right = "svc.db.schema.right";

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(
        Map.of(
            ROOT, node(ROOT),
            left, node(left),
            right, node(right),
            LEAF, node(LEAF)));
    result.setDownstreamEdges(
        Map.of(
            "root-left", edge(ROOT, left, null),
            "root-right", edge(ROOT, right, null),
            "left-leaf", edge(left, LEAF, leafColumn()),
            "right-leaf", edge(right, LEAF, leafColumn())));
    result.setUpstreamEdges(new HashMap<>());

    SearchLineageResult preserved =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of(LEAF));

    assertEquals(Set.of(ROOT, left, right, LEAF), preserved.getNodes().keySet());
    assertEquals(
        Set.of("root-left", "root-right", "left-leaf", "right-leaf"),
        preserved.getDownstreamEdges().keySet());
  }

  @Test
  void preservePathsWithEdgesHandlesCyclesWithoutInfiniteRecursion() {
    String nodeA = "svc.db.schema.a";
    String nodeB = "svc.db.schema.b";

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(Map.of(ROOT, node(ROOT), nodeA, node(nodeA), nodeB, node(nodeB)));
    result.setDownstreamEdges(
        Map.of(
            "root-a", edge(ROOT, nodeA, null),
            "a-b", edge(nodeA, nodeB, leafColumn()),
            "b-a", edge(nodeB, nodeA, null)));
    result.setUpstreamEdges(new HashMap<>());

    SearchLineageResult preserved =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of(nodeB));

    assertEquals(Set.of(ROOT, nodeA, nodeB), preserved.getNodes().keySet());
    assertEquals(Set.of("root-a", "a-b", "b-a"), preserved.getDownstreamEdges().keySet());
  }

  @Test
  void filterByColumnsDownstreamEdgesPreservesPath() {
    // Same chain but with downstream edges instead of upstream
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(MID_TWO, node(MID_TWO));
    nodes.put(LEAF, node(LEAF));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, null));
    downstreamEdges.put("mid1-mid2", edge(MID_ONE, MID_TWO, null));
    downstreamEdges.put("mid2-leaf", edge(MID_TWO, LEAF, leafColumn()));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "toColumn:ssn", ROOT);

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), filtered.getNodes().keySet());
  }

  @Test
  void filterByColumnsWithMetadataDownstreamPreservesPath() throws Exception {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(MID_TWO, node(MID_TWO));
    nodes.put(LEAF, node(LEAF));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, null));
    downstreamEdges.put("mid1-mid2", edge(MID_ONE, MID_TWO, null));
    downstreamEdges.put("mid2-leaf", edge(MID_TWO, LEAF, leafColumn()));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    ColumnMetadataCache metadataCache = new ColumnMetadataCache();
    metadataCache.loadColumnMetadata(
        Set.of(LEAF + ".ssn"),
        fqn ->
            Map.of(
                "fullyQualifiedName",
                LEAF,
                "columns",
                List.of(
                    Map.of("name", "ssn", "tags", List.of(Map.of("tagFQN", "PII.Sensitive"))))));

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumnsWithMetadata(
            result, "tag:Sensitive", ROOT, metadataCache);

    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), filtered.getNodes().keySet());
  }

  @Test
  void filterByColumnsReturnsNullForNullResult() {
    assertNull(LineagePathPreserver.filterByColumns(null, "toColumn:ssn", ROOT));
  }

  @Test
  void filterByColumnsWithMetadataReturnsNullForNullResult() {
    assertNull(
        LineagePathPreserver.filterByColumnsWithMetadata(
            null, "tag:PII", ROOT, new ColumnMetadataCache()));
  }

  @Test
  void filterByColumnsWithMetadataReturnsOriginalResultForBlankFilters() {
    SearchLineageResult result = lineageResultWithChain();

    assertSame(
        result,
        LineagePathPreserver.filterByColumnsWithMetadata(
            result, " ", ROOT, new ColumnMetadataCache()));
  }

  @Test
  void filterByColumnsWithDownstreamOnlyEdgesPreservesMatchingNodes() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(LEAF, node(LEAF));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, null));
    downstreamEdges.put(
        "mid1-leaf",
        edge(
            MID_ONE,
            LEAF,
            new ColumnLineage()
                .withFromColumns(List.of(MID_ONE + ".col_a"))
                .withToColumn(LEAF + ".col_a")));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "columnName:col_a", ROOT);

    assertEquals(Set.of(ROOT, MID_ONE, LEAF), filtered.getNodes().keySet());
  }

  @Test
  void filterByColumnsWithMetadataDownstreamEdgesPreservesMatchingNodes() throws Exception {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(LEAF, node(LEAF));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put(
        "root-leaf",
        edge(
            ROOT,
            LEAF,
            new ColumnLineage()
                .withFromColumns(List.of(ROOT + ".email"))
                .withToColumn(LEAF + ".email")));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    ColumnMetadataCache metadataCache = new ColumnMetadataCache();
    metadataCache.loadColumnMetadata(
        Set.of(ROOT + ".email", LEAF + ".email"),
        fqn ->
            Map.of(
                "fullyQualifiedName",
                fqn,
                "columns",
                List.of(Map.of("name", "email", "tags", List.of(Map.of("tagFQN", "PII.Email"))))));

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumnsWithMetadata(result, "tag:PII", ROOT, metadataCache);

    assertEquals(Set.of(ROOT, LEAF), filtered.getNodes().keySet());
  }

  @Test
  void filterByColumnsNarrowsMatchingColumnsAndEmptiesNonMatching() {
    // root→mid has columns [phone, address], mid→leaf has columns [email]
    // Filter: columnName:email → root→mid columns should be emptied, mid→leaf kept
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(LEAF, node(LEAF));

    ColumnLineage phoneCol =
        new ColumnLineage()
            .withFromColumns(List.of(ROOT + ".phone"))
            .withToColumn(MID_ONE + ".phone");
    ColumnLineage emailCol =
        new ColumnLineage()
            .withFromColumns(List.of(MID_ONE + ".email"))
            .withToColumn(LEAF + ".email");

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, phoneCol));
    upstreamEdges.put("mid1-leaf", edge(MID_ONE, LEAF, emailCol));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(upstreamEdges);
    result.setDownstreamEdges(new HashMap<>());

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "columnName:email", ROOT);

    // root→mid1 edge has columns but none match → columns emptied to []
    EsLineageData rootMidEdge = filtered.getUpstreamEdges().get("root-mid1");
    assertNotNull(rootMidEdge);
    assertTrue(rootMidEdge.getColumns().isEmpty());

    // mid1→leaf edge matches → columns narrowed to [email]
    EsLineageData midLeafEdge = filtered.getUpstreamEdges().get("mid1-leaf");
    assertNotNull(midLeafEdge);
    assertEquals(1, midLeafEdge.getColumns().size());
    assertEquals(LEAF + ".email", midLeafEdge.getColumns().get(0).getToColumn());
  }

  @Test
  void filterByColumnsPreservesEmptyColumnsOnPathOnlyEdges() {
    // root→mid has no columns (path-only), mid→leaf has columns [email]
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(LEAF, node(LEAF));

    ColumnLineage emailCol =
        new ColumnLineage()
            .withFromColumns(List.of(MID_ONE + ".email"))
            .withToColumn(LEAF + ".email");

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, null)); // no columns set
    upstreamEdges.put("mid1-leaf", edge(MID_ONE, LEAF, emailCol));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(upstreamEdges);
    result.setDownstreamEdges(new HashMap<>());

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "columnName:email", ROOT);

    // root→mid1 has no columns → not modified by column narrowing
    EsLineageData rootMidEdge = filtered.getUpstreamEdges().get("root-mid1");
    assertNotNull(rootMidEdge);
    // Columns should be empty (null or []), not filled with non-matching data
    assertTrue(rootMidEdge.getColumns() == null || rootMidEdge.getColumns().isEmpty());
  }

  @Test
  void filterByColumnsDoesNotMutateOriginalEdgesOrNodes() {
    SearchLineageResult original = lineageResultWithChain();

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(original, "columnName:ssn", ROOT);

    assertNotSame(original, filtered);
    assertEquals(Set.of(ROOT, MID_ONE, MID_TWO, LEAF), original.getNodes().keySet());
    assertNotNull(original.getUpstreamEdges().get("mid2-leaf").getColumns());
    assertFalse(original.getUpstreamEdges().get("mid2-leaf").getColumns().isEmpty());
  }

  @Test
  void filterByColumnsWithMetadataNarrowsColumnsCorrectly() throws Exception {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(LEAF, node(LEAF));

    ColumnLineage phoneCol =
        new ColumnLineage()
            .withFromColumns(List.of(ROOT + ".phone"))
            .withToColumn(MID_ONE + ".phone");
    ColumnLineage emailCol =
        new ColumnLineage()
            .withFromColumns(List.of(MID_ONE + ".email"))
            .withToColumn(LEAF + ".email");

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, phoneCol));
    upstreamEdges.put("mid1-leaf", edge(MID_ONE, LEAF, emailCol));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(upstreamEdges);
    result.setDownstreamEdges(new HashMap<>());

    ColumnMetadataCache metadataCache = new ColumnMetadataCache();
    metadataCache.loadColumnMetadata(
        Set.of(LEAF + ".email"),
        fqn ->
            Map.of(
                "fullyQualifiedName",
                LEAF,
                "columns",
                List.of(Map.of("name", "email", "tags", List.of(Map.of("tagFQN", "PII.Email"))))));

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumnsWithMetadata(result, "tag:PII", ROOT, metadataCache);

    // root→mid1 has columns but none match tag → emptied
    EsLineageData rootMidEdge = filtered.getUpstreamEdges().get("root-mid1");
    assertNotNull(rootMidEdge);
    assertTrue(rootMidEdge.getColumns().isEmpty());

    // mid1→leaf matches → kept
    EsLineageData midLeafEdge = filtered.getUpstreamEdges().get("mid1-leaf");
    assertNotNull(midLeafEdge);
    assertEquals(1, midLeafEdge.getColumns().size());
  }

  @Test
  void filterByColumnsHandlesEdgesWithNullEntities() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));

    EsLineageData edgeWithNullFrom = new EsLineageData();
    edgeWithNullFrom.setFromEntity(null);
    edgeWithNullFrom.setToEntity(
        new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(ROOT));
    edgeWithNullFrom.setColumns(
        List.of(
            new ColumnLineage()
                .withFromColumns(List.of("unknown.col"))
                .withToColumn(ROOT + ".col")));

    EsLineageData edgeWithNullTo = new EsLineageData();
    edgeWithNullTo.setFromEntity(
        new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(ROOT));
    edgeWithNullTo.setToEntity(null);
    edgeWithNullTo.setColumns(
        List.of(
            new ColumnLineage()
                .withFromColumns(List.of(ROOT + ".col"))
                .withToColumn("unknown.col")));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("e1", edgeWithNullFrom);
    downstreamEdges.put("e2", edgeWithNullTo);

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "columnName:col", ROOT);

    assertEquals(Set.of(ROOT), filtered.getNodes().keySet());
  }

  // --- Edge case: cycle detection ---

  @Test
  void tracePathToRootHandlesCycleWithoutInfiniteLoop() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put("A", node("A"));
    nodes.put("B", node("B"));

    // Create a cycle: ROOT -> A -> B -> A (cycle between A and B)
    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("e1", edge(ROOT, "A", null));
    downstreamEdges.put("e2", edge("A", "B", null));
    downstreamEdges.put("e3", edge("B", "A", null));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(downstreamEdges);

    // Should not hang or throw — the visitedNodes set prevents infinite recursion
    SearchLineageResult preserved =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of("B"));

    assertTrue(preserved.getNodes().containsKey(ROOT));
    assertTrue(preserved.getNodes().containsKey("B"));
  }

  // --- Edge case: no edges match column filter ---

  @Test
  void filterByColumnsReturnsOnlyRootWhenNoEdgesMatch() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put("other", node("other"));

    Map<String, EsLineageData> upstream = new HashMap<>();
    upstream.put(
        "e1",
        edge(
            ROOT,
            "other",
            new ColumnLineage().withFromColumns(List.of(ROOT + ".id")).withToColumn("other.id")));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(upstream);
    result.setDownstreamEdges(new HashMap<>());

    SearchLineageResult filtered =
        LineagePathPreserver.filterByColumns(result, "columnName:nonexistent", ROOT);

    assertEquals(Set.of(ROOT), filtered.getNodes().keySet());
  }

  // --- Edge case: null guards on preservePathsWithEdges ---

  @Test
  void preservePathsWithEdgesReturnsOriginalForNullMatchingNodes() {
    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(new HashMap<>());
    SearchLineageResult out = LineagePathPreserver.preservePathsWithEdges(result, ROOT, null);
    assertSame(result, out);
  }

  @Test
  void preservePathsWithEdgesReturnsOriginalForNullNodes() {
    SearchLineageResult result = new SearchLineageResult();
    SearchLineageResult out =
        LineagePathPreserver.preservePathsWithEdges(result, ROOT, Set.of("x"));
    assertSame(result, out);
  }

  // --- Edge case: preservePaths null guards ---

  @Test
  void preservePathsReturnsOriginalForNullAllNodes() {
    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(new HashMap<>());
    SearchLineageResult out = LineagePathPreserver.preservePaths(result, ROOT, null);
    assertSame(result, out);
  }

  @Test
  void preservePathsReturnsOriginalForNullResultNodes() {
    SearchLineageResult result = new SearchLineageResult();
    SearchLineageResult out = LineagePathPreserver.preservePaths(result, ROOT, new HashMap<>());
    assertSame(result, out);
  }

  private SearchLineageResult lineageResultWithChain() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(MID_ONE, node(MID_ONE));
    nodes.put(MID_TWO, node(MID_TWO));
    nodes.put(LEAF, node(LEAF));

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("root-mid1", edge(ROOT, MID_ONE, null));
    upstreamEdges.put("mid1-mid2", edge(MID_ONE, MID_TWO, null));
    upstreamEdges.put("mid2-leaf", edge(MID_TWO, LEAF, leafColumn()));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(upstreamEdges);
    result.setDownstreamEdges(new HashMap<>());
    return result;
  }

  private NodeInformation node(String fqn) {
    return new NodeInformation().withEntity(Map.of("fullyQualifiedName", fqn));
  }

  private EsLineageData edge(String fromFqn, String toFqn, ColumnLineage columnLineage) {
    EsLineageData edge = new EsLineageData();
    edge.setFromEntity(
        new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(fromFqn));
    edge.setToEntity(new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(toFqn));
    if (columnLineage != null) {
      edge.setColumns(List.of(columnLineage));
    }
    return edge;
  }

  private ColumnLineage leafColumn() {
    return new ColumnLineage()
        .withFromColumns(List.of(MID_TWO + ".source_ssn"))
        .withToColumn(LEAF + ".ssn");
  }
}
