package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.DependencyType;
import org.openmetadata.schema.type.lineage.NodeInformation;

class LineageDependencyResolverTest {
  private static final String ROOT = "svc.db.schema.root";
  private static final String TABLE_A = "svc.db.schema.table_a";
  private static final String TABLE_B = "svc.db.schema.table_b";
  private static final String TABLE_C = "svc.db.schema.table_c";
  private static final String TABLE_D = "svc.db.schema.table_d";

  @Test
  void parseDependencyTypeFilterSupportsValidValuesAndRejectsInvalid() {
    assertNull(LineageDependencyResolver.parseDependencyTypeFilter(null));
    assertNull(LineageDependencyResolver.parseDependencyTypeFilter(""));
    assertNull(LineageDependencyResolver.parseDependencyTypeFilter("   "));
    assertNull(LineageDependencyResolver.parseDependencyTypeFilter("ALL"));
    assertNull(LineageDependencyResolver.parseDependencyTypeFilter("all"));
    assertEquals(
        DependencyType.DIRECT, LineageDependencyResolver.parseDependencyTypeFilter("DIRECT"));
    assertEquals(
        DependencyType.DIRECT, LineageDependencyResolver.parseDependencyTypeFilter(" direct "));
    assertEquals(
        DependencyType.INDIRECT, LineageDependencyResolver.parseDependencyTypeFilter("INDIRECT"));
    assertEquals(
        DependencyType.INDIRECT, LineageDependencyResolver.parseDependencyTypeFilter("indirect"));
    assertThrows(
        IllegalArgumentException.class,
        () -> LineageDependencyResolver.parseDependencyTypeFilter("UNKNOWN"));
  }

  @Test
  void nullOrUnsetDependencyTypeIsTreatedAsDirect() {
    EsLineageData unsetEdge = edge(ROOT, TABLE_A, null);
    EsLineageData directEdge = edge(ROOT, TABLE_A, DependencyType.DIRECT);
    EsLineageData indirectEdge = edge(ROOT, TABLE_A, DependencyType.INDIRECT);

    assertTrue(LineageDependencyResolver.isDirectEdge(null));
    assertTrue(LineageDependencyResolver.isDirectEdge(unsetEdge));
    assertTrue(LineageDependencyResolver.isDirectEdge(directEdge));
    assertFalse(LineageDependencyResolver.isDirectEdge(indirectEdge));

    assertTrue(LineageDependencyResolver.matchesEdgeFilter(unsetEdge, DependencyType.DIRECT));
    assertFalse(LineageDependencyResolver.matchesEdgeFilter(unsetEdge, DependencyType.INDIRECT));
    assertTrue(LineageDependencyResolver.matchesEdgeFilter(indirectEdge, DependencyType.INDIRECT));
    assertTrue(LineageDependencyResolver.matchesEdgeFilter(indirectEdge, null));
  }

  @Test
  void diamondGraphWithOneDirectAndOneIndirectPathResolvesTargetAsDirect() {
    // ROOT --(DIRECT)--> A --(DIRECT)--> C
    // ROOT --(INDIRECT)--> B --(DIRECT)--> C
    SearchLineageResult result =
        resultWithDownstream(
            List.of(ROOT, TABLE_A, TABLE_B, TABLE_C),
            List.of(
                edge(ROOT, TABLE_A, DependencyType.DIRECT),
                edge(ROOT, TABLE_B, DependencyType.INDIRECT),
                edge(TABLE_A, TABLE_C, DependencyType.DIRECT),
                edge(TABLE_B, TABLE_C, DependencyType.DIRECT)));

    Map<String, Boolean> hasDirectPath =
        LineageDependencyResolver.computeTransitiveDirectPaths(
            result, ROOT, LineageDirection.DOWNSTREAM);

    assertTrue(hasDirectPath.get(ROOT));
    assertTrue(hasDirectPath.get(TABLE_A));
    assertFalse(hasDirectPath.get(TABLE_B));
    assertTrue(hasDirectPath.get(TABLE_C));

    LineageDependencyResolver.annotateNodeDependencyTypes(
        result, ROOT, LineageDirection.DOWNSTREAM);
    assertEquals(
        DependencyType.DIRECT,
        LineageDependencyResolver.getNodeDependencyType(result.getNodes().get(TABLE_C)));
    assertEquals(
        DependencyType.INDIRECT,
        LineageDependencyResolver.getNodeDependencyType(result.getNodes().get(TABLE_B)));
  }

  @Test
  void asymmetricDiamondUpgradesNodeAndDescendantsWhenLaterDirectPathExists() {
    // Depth 1: ROOT --(INDIRECT)--> C --(DIRECT)--> D (initially INDIRECT)
    // Depth 2: ROOT --(DIRECT)--> A --(DIRECT)--> C (upgrades C AND D to DIRECT)
    SearchLineageResult result =
        resultWithDownstream(
            List.of(ROOT, TABLE_A, TABLE_C, TABLE_D),
            List.of(
                edge(ROOT, TABLE_C, DependencyType.INDIRECT),
                edge(TABLE_C, TABLE_D, DependencyType.DIRECT),
                edge(ROOT, TABLE_A, DependencyType.DIRECT),
                edge(TABLE_A, TABLE_C, DependencyType.DIRECT)));

    Map<String, Boolean> hasDirectPath =
        LineageDependencyResolver.computeTransitiveDirectPaths(
            result, ROOT, LineageDirection.DOWNSTREAM);

    assertTrue(hasDirectPath.get(TABLE_A));
    assertTrue(hasDirectPath.get(TABLE_C));
    assertTrue(hasDirectPath.get(TABLE_D));
  }

  @Test
  void pureIndirectPathsRemainIndirectTransitively() {
    // ROOT --(DIRECT)--> A --(INDIRECT)--> B --(DIRECT)--> C
    // ROOT --(INDIRECT)--> D --(DIRECT)--> C
    SearchLineageResult result =
        resultWithDownstream(
            List.of(ROOT, TABLE_A, TABLE_B, TABLE_C, TABLE_D),
            List.of(
                edge(ROOT, TABLE_A, null),
                edge(TABLE_A, TABLE_B, DependencyType.INDIRECT),
                edge(TABLE_B, TABLE_C, DependencyType.DIRECT),
                edge(ROOT, TABLE_D, DependencyType.INDIRECT),
                edge(TABLE_D, TABLE_C, DependencyType.DIRECT)));

    Map<String, Boolean> hasDirectPath =
        LineageDependencyResolver.computeTransitiveDirectPaths(
            result, ROOT, LineageDirection.DOWNSTREAM);

    assertTrue(hasDirectPath.get(TABLE_A));
    assertFalse(hasDirectPath.get(TABLE_B));
    assertFalse(hasDirectPath.get(TABLE_C));
    assertFalse(hasDirectPath.get(TABLE_D));
  }

  @Test
  void upstreamTransitivePropagationResolvesDirectAndIndirectCorrectly() {
    // TABLE_A --(DIRECT)--> TABLE_B --(DIRECT)--> ROOT
    // TABLE_C --(INDIRECT)--> ROOT
    // TABLE_D --(DIRECT)--> TABLE_C
    SearchLineageResult result = new SearchLineageResult();
    Map<String, NodeInformation> nodes = new HashMap<>();
    for (String fqn : List.of(ROOT, TABLE_A, TABLE_B, TABLE_C, TABLE_D)) {
      nodes.put(fqn, new NodeInformation().withEntity(Map.of("fullyQualifiedName", fqn)));
    }
    result.setNodes(nodes);
    Map<String, EsLineageData> upstream = new HashMap<>();
    putEdge(upstream, edge(TABLE_A, TABLE_B, DependencyType.DIRECT));
    putEdge(upstream, edge(TABLE_B, ROOT, null));
    putEdge(upstream, edge(TABLE_C, ROOT, DependencyType.INDIRECT));
    putEdge(upstream, edge(TABLE_D, TABLE_C, DependencyType.DIRECT));
    result.setUpstreamEdges(upstream);

    Map<String, Boolean> hasDirectPath =
        LineageDependencyResolver.computeTransitiveDirectPaths(
            result, ROOT, LineageDirection.UPSTREAM);

    assertTrue(hasDirectPath.get(TABLE_B));
    assertTrue(hasDirectPath.get(TABLE_A));
    assertFalse(hasDirectPath.get(TABLE_C));
    assertFalse(hasDirectPath.get(TABLE_D));
  }

  @Test
  void filterByDependencyTypeReturnsExpectedSubgraphs() {
    SearchLineageResult original =
        resultWithDownstream(
            List.of(ROOT, TABLE_A, TABLE_B, TABLE_C),
            List.of(
                edge(ROOT, TABLE_A, DependencyType.DIRECT),
                edge(ROOT, TABLE_B, DependencyType.INDIRECT),
                edge(TABLE_B, TABLE_C, DependencyType.DIRECT)));

    SearchLineageResult unfiltered =
        LineageDependencyResolver.filterByDependencyType(
            original, ROOT, LineageDirection.DOWNSTREAM, null, false);
    assertEquals(4, unfiltered.getNodes().size());
    assertEquals(
        DependencyType.DIRECT,
        LineageDependencyResolver.getNodeDependencyType(unfiltered.getNodes().get(TABLE_A)));
    assertEquals(
        DependencyType.INDIRECT,
        LineageDependencyResolver.getNodeDependencyType(unfiltered.getNodes().get(TABLE_B)));
    assertEquals(
        DependencyType.INDIRECT,
        LineageDependencyResolver.getNodeDependencyType(unfiltered.getNodes().get(TABLE_C)));

    SearchLineageResult directOnly =
        LineageDependencyResolver.filterByDependencyType(
            original, ROOT, LineageDirection.DOWNSTREAM, DependencyType.DIRECT, false);
    assertEquals(2, directOnly.getNodes().size());
    assertTrue(directOnly.getNodes().containsKey(ROOT));
    assertTrue(directOnly.getNodes().containsKey(TABLE_A));
    assertEquals(1, directOnly.getDownstreamEdges().size());

    SearchLineageResult indirectOnly =
        LineageDependencyResolver.filterByDependencyType(
            original, ROOT, LineageDirection.DOWNSTREAM, DependencyType.INDIRECT, false);
    assertEquals(3, indirectOnly.getNodes().size());
    assertTrue(indirectOnly.getNodes().containsKey(ROOT));
    assertTrue(indirectOnly.getNodes().containsKey(TABLE_B));
    assertTrue(indirectOnly.getNodes().containsKey(TABLE_C));
    assertFalse(indirectOnly.getNodes().containsKey(TABLE_A));
  }

  @Test
  void filterEntitiesByDepthRetainsOnlyMatchingDependencyType() {
    Map<Integer, List<String>> byDepth = new HashMap<>();
    byDepth.put(1, List.of(TABLE_A, TABLE_B));
    byDepth.put(2, List.of(TABLE_C));
    Map<String, Boolean> hasDirectPath =
        Map.of(ROOT, true, TABLE_A, true, TABLE_B, false, TABLE_C, false);

    Map<Integer, List<String>> direct =
        LineageDependencyResolver.filterEntitiesByDepth(
            byDepth, hasDirectPath, DependencyType.DIRECT);
    assertEquals(Map.of(1, List.of(TABLE_A)), direct);

    Map<Integer, List<String>> indirect =
        LineageDependencyResolver.filterEntitiesByDepth(
            byDepth, hasDirectPath, DependencyType.INDIRECT);
    assertEquals(Map.of(1, List.of(TABLE_B), 2, List.of(TABLE_C)), indirect);
  }

  @Test
  void recordReachabilityUpgradesFalseToTrueAndDoesNotDowngrade() {
    Map<String, Boolean> map = new HashMap<>();

    assertTrue(LineageDependencyResolver.recordReachability(map, TABLE_A, false));
    assertFalse(map.get(TABLE_A));
    assertFalse(LineageDependencyResolver.recordReachability(map, TABLE_A, false));
    assertTrue(LineageDependencyResolver.recordReachability(map, TABLE_A, true));
    assertTrue(map.get(TABLE_A));
    assertFalse(LineageDependencyResolver.recordReachability(map, TABLE_A, false));
    assertTrue(map.get(TABLE_A));
  }

  private static SearchLineageResult resultWithDownstream(
      List<String> fqns, List<EsLineageData> edges) {
    SearchLineageResult result = new SearchLineageResult();
    Map<String, NodeInformation> nodes = new HashMap<>();
    for (String fqn : fqns) {
      nodes.put(fqn, new NodeInformation().withEntity(Map.of("fullyQualifiedName", fqn)));
    }
    result.setNodes(nodes);
    Map<String, EsLineageData> edgeMap = new HashMap<>();
    for (EsLineageData edge : edges) {
      putEdge(edgeMap, edge);
    }
    result.setDownstreamEdges(edgeMap);
    return result;
  }

  private static void putEdge(Map<String, EsLineageData> map, EsLineageData edge) {
    String key =
        edge.getFromEntity().getFullyQualifiedName()
            + "->"
            + edge.getToEntity().getFullyQualifiedName();
    map.put(key, edge);
  }

  private static EsLineageData edge(String from, String to, DependencyType type) {
    return new EsLineageData()
        .withFromEntity(new RelationshipRef().withFullyQualifiedName(from))
        .withToEntity(new RelationshipRef().withFullyQualifiedName(to))
        .withDependencyType(type);
  }
}
