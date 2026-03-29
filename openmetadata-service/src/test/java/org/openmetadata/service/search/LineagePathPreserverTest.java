package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

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
  void filterByColumnsWithMetadataReturnsOriginalResultForBlankFilters() {
    SearchLineageResult result = lineageResultWithChain();

    assertSame(
        result,
        LineagePathPreserver.filterByColumnsWithMetadata(
            result, " ", ROOT, new ColumnMetadataCache()));
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
