/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Unit tests for {@link LineageDomainFilter}. A node is "visible" when its domains are empty
 * (domainless) or include the user's domain ("D1"); domain "D2" is foreign.
 */
class LineageDomainFilterTest {

  private SubjectContext restricted;

  @BeforeEach
  void setUp() {
    restricted = mock(SubjectContext.class);
    when(restricted.isAdmin()).thenReturn(false);
    when(restricted.isBot()).thenReturn(false);
    when(restricted.hasDomainOnlyAccessRole()).thenReturn(true);
    when(restricted.hasDomains(anyList()))
        .thenAnswer(
            invocation -> {
              List<EntityReference> domains = invocation.getArgument(0);
              return domains.isEmpty()
                  || domains.stream().anyMatch(d -> "D1".equals(d.getFullyQualifiedName()));
            });
  }

  @Test
  @DisplayName("shouldApply: only for non-admin non-bot users holding DomainOnlyAccessRole")
  void testShouldApply() {
    assertFalse(LineageDomainFilter.shouldApply(null));
    assertTrue(LineageDomainFilter.shouldApply(restricted));

    SubjectContext admin = mock(SubjectContext.class);
    when(admin.isAdmin()).thenReturn(true);
    assertFalse(LineageDomainFilter.shouldApply(admin));

    SubjectContext bot = mock(SubjectContext.class);
    when(bot.isBot()).thenReturn(true);
    assertFalse(LineageDomainFilter.shouldApply(bot));

    SubjectContext noRole = mock(SubjectContext.class);
    when(noRole.hasDomainOnlyAccessRole()).thenReturn(false);
    assertFalse(LineageDomainFilter.shouldApply(noRole));
  }

  @Test
  @DisplayName("prune removes foreign nodes and severs traversal through them")
  void testPruneSeversTraversal() {
    // Chain T0(domainless) -> T1(D1) -> T2(D2) -> T3(D1), rooted at T1.
    SearchLineageResult result =
        lineage(
            List.of(node("T0"), node("T1", "D1"), node("T2", "D2"), node("T3", "D1")),
            List.of(edge("e0", "T0", "T1"), edge("e1", "T1", "T2"), edge("e2", "T2", "T3")));

    LineageDomainFilter.prune(result, restricted, "T1");

    assertTrue(result.getNodes().containsKey("T1"), "root retained");
    assertTrue(result.getNodes().containsKey("T0"), "domainless neighbor retained");
    assertFalse(result.getNodes().containsKey("T2"), "foreign-domain node removed");
    assertFalse(result.getNodes().containsKey("T3"), "node behind foreign node severed");
    assertEquals(1, result.getUpstreamEdges().size(), "only T0->T1 edge survives");
    assertTrue(result.getUpstreamEdges().containsKey("e0"));
  }

  @Test
  @DisplayName("prune is a no-op for admins / non-restricted users")
  void testPruneNoOpForAdmin() {
    SubjectContext admin = mock(SubjectContext.class);
    when(admin.isAdmin()).thenReturn(true);
    SearchLineageResult result =
        lineage(List.of(node("T1", "D1"), node("T2", "D2")), List.of(edge("e1", "T1", "T2")));

    LineageDomainFilter.prune(result, admin, "T1");

    assertEquals(2, result.getNodes().size(), "admin sees all nodes");
    assertEquals(1, result.getUpstreamEdges().size());
  }

  @Test
  @DisplayName("prune with null root keeps all visible nodes (platform lineage)")
  void testPruneVisibilityOnly() {
    SearchLineageResult result =
        lineage(
            List.of(node("A", "D1"), node("B", "D2"), node("C")),
            List.of(edge("e1", "A", "B"), edge("e2", "B", "C")));

    LineageDomainFilter.prune(result, restricted, null);

    assertTrue(result.getNodes().containsKey("A"), "own-domain node kept");
    assertTrue(result.getNodes().containsKey("C"), "domainless node kept");
    assertFalse(result.getNodes().containsKey("B"), "foreign node removed");
    assertTrue(result.getUpstreamEdges().isEmpty(), "edges touching foreign node removed");
  }

  @Test
  @DisplayName("prune returns empty graph when the root itself is foreign")
  void testPruneForeignRoot() {
    SearchLineageResult result =
        lineage(List.of(node("F", "D2"), node("G", "D1")), List.of(edge("e1", "F", "G")));

    LineageDomainFilter.prune(result, restricted, "F");

    assertTrue(result.getNodes().isEmpty(), "foreign root yields nothing reachable");
    assertTrue(result.getUpstreamEdges().isEmpty());
  }

  @Test
  @DisplayName("pruneDataQualityLineage drops foreign nodes and edges touching them")
  void testPruneDataQualityLineage() {
    Set<Map<String, Object>> nodes =
        new HashSet<>(List.of(dqNode("A", "D1"), dqNode("B", "D2"), dqNode("C")));
    Set<EsLineageData> edges =
        new HashSet<>(List.of(edge("e1", "A", "B").getValue(), edge("e2", "B", "C").getValue()));

    LineageDomainFilter.pruneDataQualityLineage(nodes, edges, restricted);

    Set<String> fqns = new HashSet<>();
    nodes.forEach(n -> fqns.add(n.get("fullyQualifiedName").toString()));
    assertTrue(fqns.contains("A"), "own-domain node kept");
    assertTrue(fqns.contains("C"), "domainless node kept");
    assertFalse(fqns.contains("B"), "foreign-domain node removed");
    assertTrue(edges.isEmpty(), "edges touching the foreign node removed");
  }

  @Test
  @DisplayName("pruneDataQualityLineage is a no-op for admins")
  void testPruneDataQualityLineageNoOpForAdmin() {
    SubjectContext admin = mock(SubjectContext.class);
    when(admin.isAdmin()).thenReturn(true);
    Set<Map<String, Object>> nodes = new HashSet<>(List.of(dqNode("A", "D1"), dqNode("B", "D2")));
    Set<EsLineageData> edges = new HashSet<>(List.of(edge("e1", "A", "B").getValue()));

    LineageDomainFilter.pruneDataQualityLineage(nodes, edges, admin);

    assertEquals(2, nodes.size(), "admin sees all nodes");
    assertEquals(1, edges.size());
  }

  private static Map<String, Object> dqNode(String fqn, String... domainFqns) {
    Map<String, Object> entity = new HashMap<>(node(fqn, domainFqns).getValue().getEntity());
    entity.put("fullyQualifiedName", fqn);
    return entity;
  }

  private static SearchLineageResult lineage(
      List<Map.Entry<String, NodeInformation>> nodes,
      List<Map.Entry<String, EsLineageData>> edges) {
    Map<String, NodeInformation> nodeMap = new HashMap<>();
    nodes.forEach(entry -> nodeMap.put(entry.getKey(), entry.getValue()));
    Map<String, EsLineageData> edgeMap = new HashMap<>();
    edges.forEach(entry -> edgeMap.put(entry.getKey(), entry.getValue()));
    return new SearchLineageResult()
        .withNodes(nodeMap)
        .withUpstreamEdges(edgeMap)
        .withDownstreamEdges(new HashMap<>());
  }

  private static Map.Entry<String, NodeInformation> node(String fqn, String... domainFqns) {
    Map<String, Object> entity = new HashMap<>();
    if (domainFqns.length > 0) {
      List<Map<String, Object>> domains =
          java.util.Arrays.stream(domainFqns)
              .map(
                  d ->
                      (Map<String, Object>)
                          new HashMap<String, Object>(Map.of("fullyQualifiedName", d)))
              .toList();
      entity.put("domains", domains);
    }
    return Map.entry(fqn, new NodeInformation().withEntity(entity));
  }

  private static Map.Entry<String, EsLineageData> edge(String docId, String from, String to) {
    return Map.entry(
        docId,
        new EsLineageData()
            .withDocId(docId)
            .withFromEntity(new RelationshipRef().withFullyQualifiedName(from))
            .withToEntity(new RelationshipRef().withFullyQualifiedName(to)));
  }
}
