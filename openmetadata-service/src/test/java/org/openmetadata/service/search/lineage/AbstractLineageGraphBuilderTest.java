package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.search.QueryFilterParser;

class AbstractLineageGraphBuilderTest {

  private TestableLineageGraphBuilder builder;

  private static final String ROOT_FQN = "svc.db.schema.root_table";

  @BeforeEach
  void setUp() {
    builder = new TestableLineageGraphBuilder();
  }

  // --- applyEntityCountPagination tests ---

  @Test
  void applyEntityCountPaginationReturnsNullForNullResult() {
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(10);

    SearchLineageResult result = builder.applyEntityCountPagination(null, request);

    assertNull(result);
  }

  @Test
  void applyEntityCountPaginationReturnsResultWithNullNodes() {
    SearchLineageResult input = new SearchLineageResult();
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(10);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertNull(result.getNodes());
  }

  @Test
  void applyEntityCountPaginationFiltersNodesByDepthLessThanOrEqual() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("svc.db.schema.depth1", nodeAtDepth(1));
    nodes.put("svc.db.schema.depth2", nodeAtDepth(2));
    nodes.put("svc.db.schema.depth3", nodeAtDepth(3));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50).withNodeDepth(2);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    assertTrue(result.getNodes().containsKey("svc.db.schema.depth1"));
    assertTrue(result.getNodes().containsKey("svc.db.schema.depth2"));
    assertFalse(result.getNodes().containsKey("svc.db.schema.depth3"));
  }

  @Test
  void applyEntityCountPaginationUsesAbsoluteValueForNegativeDepth() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("svc.db.schema.upstream1", nodeAtDepth(-1));
    nodes.put("svc.db.schema.upstream2", nodeAtDepth(-2));
    nodes.put("svc.db.schema.upstream3", nodeAtDepth(-3));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest()
            .withFqn(ROOT_FQN)
            .withFrom(0)
            .withSize(50)
            .withNodeDepth(-2);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    assertTrue(result.getNodes().containsKey("svc.db.schema.upstream1"));
    assertTrue(result.getNodes().containsKey("svc.db.schema.upstream2"));
    assertFalse(result.getNodes().containsKey("svc.db.schema.upstream3"));
  }

  @Test
  void applyEntityCountPaginationAlwaysIncludesRootInDepthFilter() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("svc.db.schema.depth2", nodeAtDepth(2));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50).withNodeDepth(1);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    assertFalse(result.getNodes().containsKey("svc.db.schema.depth2"));
  }

  @Test
  void applyEntityCountPaginationPaginatesWithFromAndSize() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("a_depth1", nodeAtDepth(1));
    nodes.put("b_depth1", nodeAtDepth(1));
    nodes.put("c_depth2", nodeAtDepth(2));
    nodes.put("d_depth2", nodeAtDepth(2));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(2);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    int nonRootNodes = result.getNodes().size() - 1;
    assertEquals(2, nonRootNodes);
  }

  @Test
  void applyEntityCountPaginationReturnsOnlyRootWhenFromExceedsSize() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("svc.db.schema.depth1", nodeAtDepth(1));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(100).withSize(10);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertEquals(1, result.getNodes().size());
    assertTrue(result.getNodes().containsKey(ROOT_FQN));
  }

  @Test
  void applyEntityCountPaginationDefaultsFromAndSizeWhenNull() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    for (int i = 0; i < 60; i++) {
      nodes.put("node_" + i, nodeAtDepth(1));
    }

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request = new EntityCountLineageRequest().withFqn(ROOT_FQN);
    request.setFrom(null);
    request.setSize(null);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    int nonRootNodes = result.getNodes().size() - 1;
    assertEquals(50, nonRootNodes);
  }

  @Test
  void applyEntityCountPaginationSortsByDepthThenName() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("z_depth1", nodeAtDepth(1));
    nodes.put("a_depth2", nodeAtDepth(2));
    nodes.put("a_depth1", nodeAtDepth(1));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(2);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    assertTrue(result.getNodes().containsKey("a_depth1"));
    assertTrue(result.getNodes().containsKey("z_depth1"));
    assertFalse(result.getNodes().containsKey("a_depth2"));
  }

  @Test
  void applyEntityCountPaginationFiltersEdgesToMatchNodes() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("included_node", nodeAtDepth(1));
    nodes.put("excluded_node", nodeAtDepth(2));

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("edge1", edge(ROOT_FQN, "included_node"));
    upstreamEdges.put("edge2", edge("included_node", "excluded_node"));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("edge3", edge(ROOT_FQN, "included_node"));
    downstreamEdges.put("edge4", edge("included_node", "excluded_node"));

    SearchLineageResult input = new SearchLineageResult();
    input.setNodes(nodes);
    input.setUpstreamEdges(upstreamEdges);
    input.setDownstreamEdges(downstreamEdges);

    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(1);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertNotNull(result.getUpstreamEdges());
    assertTrue(result.getUpstreamEdges().containsKey("edge1"));
    assertFalse(result.getUpstreamEdges().containsKey("edge2"));

    assertNotNull(result.getDownstreamEdges());
    assertTrue(result.getDownstreamEdges().containsKey("edge3"));
    assertFalse(result.getDownstreamEdges().containsKey("edge4"));
  }

  @Test
  void applyEntityCountPaginationHandlesNodeWithNullDepth() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put(
        "null_depth_node",
        new NodeInformation().withEntity(Map.of("fullyQualifiedName", "null_depth_node")));

    SearchLineageResult input = resultWithNodes(nodes);
    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50).withNodeDepth(1);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getNodes().containsKey(ROOT_FQN));
    assertTrue(result.getNodes().containsKey("null_depth_node"));
  }

  @Test
  void applyEntityCountPaginationDepthFilterWithEdges() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("depth1", nodeAtDepth(1));
    nodes.put("depth2", nodeAtDepth(2));

    Map<String, EsLineageData> upstream = new HashMap<>();
    upstream.put("e1", edge(ROOT_FQN, "depth1"));
    upstream.put("e2", edge("depth1", "depth2"));

    SearchLineageResult input = new SearchLineageResult();
    input.setNodes(nodes);
    input.setUpstreamEdges(upstream);
    input.setDownstreamEdges(new HashMap<>());

    EntityCountLineageRequest request =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50).withNodeDepth(1);

    SearchLineageResult result = builder.applyEntityCountPagination(input, request);

    assertTrue(result.getUpstreamEdges().containsKey("e1"));
    assertFalse(result.getUpstreamEdges().containsKey("e2"));
  }

  // --- matchesNodeFilter tests ---

  @Test
  void matchesNodeFilterReturnsFalseForNullNode() {
    assertFalse(builder.matchesNodeFilter(null, "{\"term\": {\"tags.tagFQN.keyword\": \"PII\"}}"));
  }

  @Test
  void matchesNodeFilterReturnsFalseForNullEntity() {
    NodeInformation node = new NodeInformation();
    assertFalse(builder.matchesNodeFilter(node, "{\"term\": {\"tags.tagFQN.keyword\": \"PII\"}}"));
  }

  @Test
  void matchesNodeFilterReturnsFalseForEmptyQueryFilter() {
    NodeInformation node =
        new NodeInformation()
            .withEntity(Map.of("name", "test", "tags", List.of(Map.of("tagFQN", "PII"))));
    assertFalse(builder.matchesNodeFilter(node, ""));
    assertFalse(builder.matchesNodeFilter(node, (String) null));
  }

  @Test
  void matchesNodeFilterMatchesTermQuery() {
    NodeInformation node =
        new NodeInformation()
            .withEntity(
                Map.of("tags", List.of(Map.of("tagFQN", "PII.Sensitive")), "name", "customers"));

    assertTrue(
        builder.matchesNodeFilter(
            node, "{\"term\": {\"tags.tagFQN.keyword\": \"PII.Sensitive\"}}"));
    assertFalse(
        builder.matchesNodeFilter(node, "{\"term\": {\"tags.tagFQN.keyword\": \"NonExistent\"}}"));
  }

  @Test
  void matchesNodeFilterMatchesQueryString() {
    NodeInformation node =
        new NodeInformation()
            .withEntity(Map.of("description", "Monthly sales report for finance team"));

    assertTrue(builder.matchesNodeFilter(node, "description:sales"));
    assertFalse(builder.matchesNodeFilter(node, "description:marketing"));
  }

  // --- Helper methods ---

  private NodeInformation nodeAtDepth(int depth) {
    return new NodeInformation()
        .withEntity(Map.of("fullyQualifiedName", "entity_" + depth))
        .withNodeDepth(depth);
  }

  private SearchLineageResult resultWithNodes(Map<String, NodeInformation> nodes) {
    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(new HashMap<>());
    return result;
  }

  private EsLineageData edge(String fromFqn, String toFqn) {
    EsLineageData edgeData = new EsLineageData();
    edgeData.setFromEntity(
        new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(fromFqn));
    edgeData.setToEntity(
        new RelationshipRef().withId(UUID.randomUUID()).withFullyQualifiedName(toFqn));
    return edgeData;
  }

  // ── applyInMemoryFiltersWithPathPreservationForEntityCount ──

  @Test
  void inMemoryFilter_nullResult_returnsNull() {
    EntityCountLineageRequest req =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50);
    assertNull(builder.applyInMemoryFiltersWithPathPreservationForEntityCount(null, req));
  }

  @Test
  void inMemoryFilter_nullRequest_returnsResult() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, new NodeInformation().withNodeDepth(0));
    SearchLineageResult result = resultWithNodes(nodes);
    assertNotNull(builder.applyInMemoryFiltersWithPathPreservationForEntityCount(result, null));
  }

  @Test
  void inMemoryFilter_emptyQueryFilter_returnsUnfiltered() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, new NodeInformation().withNodeDepth(0));
    nodes.put("svc.db.schema.t1", new NodeInformation().withNodeDepth(1));
    SearchLineageResult result = resultWithNodes(nodes);
    EntityCountLineageRequest req =
        new EntityCountLineageRequest().withFqn(ROOT_FQN).withFrom(0).withSize(50);
    SearchLineageResult out =
        builder.applyInMemoryFiltersWithPathPreservationForEntityCount(result, req);
    assertEquals(2, out.getNodes().size());
  }

  @Test
  void inMemoryFilter_withFilter_keepsOnlyMatchingNodesAndRoot() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeWithEntity(ROOT_FQN, Map.of("fullyQualifiedName", ROOT_FQN)));
    nodes.put(
        "svc.db.schema.t1",
        nodeWithEntity(
            "svc.db.schema.t1",
            Map.of(
                "fullyQualifiedName", "svc.db.schema.t1", "tier", Map.of("tagFQN", "Tier.Tier5"))));
    nodes.put(
        "svc.db.schema.t2",
        nodeWithEntity("svc.db.schema.t2", Map.of("fullyQualifiedName", "svc.db.schema.t2")));

    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(nodes);
    result.setUpstreamEdges(new HashMap<>());
    result.setDownstreamEdges(new HashMap<>());

    EntityCountLineageRequest req =
        new EntityCountLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter(
                "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier5\"}}]}}}")
            .withFrom(0)
            .withSize(50);

    SearchLineageResult out =
        builder.applyInMemoryFiltersWithPathPreservationForEntityCount(result, req);

    assertTrue(out.getNodes().containsKey(ROOT_FQN));
    assertTrue(out.getNodes().containsKey("svc.db.schema.t1"));
    assertFalse(out.getNodes().containsKey("svc.db.schema.t2"));
  }

  @Test
  void inMemoryFilter_withUpstreamEdgesAndMatchingFilter_preservesPathAndFiltersNodes() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(
        ROOT_FQN,
        new NodeInformation().withEntity(Map.of("fullyQualifiedName", ROOT_FQN)).withNodeDepth(0));
    nodes.put(
        "svc.db.schema.mid",
        new NodeInformation()
            .withEntity(Map.of("fullyQualifiedName", "svc.db.schema.mid"))
            .withNodeDepth(-1));
    nodes.put(
        "svc.db.schema.leaf",
        new NodeInformation()
            .withEntity(
                Map.of(
                    "fullyQualifiedName",
                    "svc.db.schema.leaf",
                    "tier",
                    Map.of("tagFQN", "Tier.Tier1")))
            .withNodeDepth(-2));
    nodes.put(
        "svc.db.schema.unrelated",
        new NodeInformation()
            .withEntity(Map.of("fullyQualifiedName", "svc.db.schema.unrelated"))
            .withNodeDepth(1));

    Map<String, EsLineageData> upstreamEdges = new HashMap<>();
    upstreamEdges.put("e1", edge("svc.db.schema.mid", ROOT_FQN));
    upstreamEdges.put("e2", edge("svc.db.schema.leaf", "svc.db.schema.mid"));

    SearchLineageResult input = new SearchLineageResult();
    input.setNodes(nodes);
    input.setUpstreamEdges(upstreamEdges);
    input.setDownstreamEdges(new HashMap<>());

    EntityCountLineageRequest req =
        new EntityCountLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter(
                "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}]}}}")
            .withFrom(0)
            .withSize(50);

    SearchLineageResult out =
        builder.applyInMemoryFiltersWithPathPreservationForEntityCount(input, req);

    assertTrue(out.getNodes().containsKey(ROOT_FQN));
    assertTrue(out.getNodes().containsKey("svc.db.schema.leaf"));
    assertFalse(out.getNodes().containsKey("svc.db.schema.unrelated"));
    // Intermediate node NOT kept in table view (only matching + root)
    assertFalse(out.getNodes().containsKey("svc.db.schema.mid"));
  }

  @Test
  void inMemoryFilter_multipleNodesSomeMatch_keepsOnlyMatchingAndRoot() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(
        ROOT_FQN,
        new NodeInformation().withEntity(Map.of("fullyQualifiedName", ROOT_FQN)).withNodeDepth(0));
    nodes.put(
        "svc.db.schema.match1",
        new NodeInformation()
            .withEntity(
                Map.of(
                    "fullyQualifiedName",
                    "svc.db.schema.match1",
                    "tier",
                    Map.of("tagFQN", "Tier.Tier2")))
            .withNodeDepth(1));
    nodes.put(
        "svc.db.schema.match2",
        new NodeInformation()
            .withEntity(
                Map.of(
                    "fullyQualifiedName",
                    "svc.db.schema.match2",
                    "tier",
                    Map.of("tagFQN", "Tier.Tier2")))
            .withNodeDepth(2));
    nodes.put(
        "svc.db.schema.nomatch",
        new NodeInformation()
            .withEntity(Map.of("fullyQualifiedName", "svc.db.schema.nomatch"))
            .withNodeDepth(1));

    SearchLineageResult input = new SearchLineageResult();
    input.setNodes(nodes);
    input.setUpstreamEdges(new HashMap<>());
    input.setDownstreamEdges(new HashMap<>());

    EntityCountLineageRequest req =
        new EntityCountLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter(
                "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier2\"}}]}}}")
            .withFrom(0)
            .withSize(50);

    SearchLineageResult out =
        builder.applyInMemoryFiltersWithPathPreservationForEntityCount(input, req);

    assertTrue(out.getNodes().containsKey(ROOT_FQN));
    assertTrue(out.getNodes().containsKey("svc.db.schema.match1"));
    assertTrue(out.getNodes().containsKey("svc.db.schema.match2"));
    assertFalse(out.getNodes().containsKey("svc.db.schema.nomatch"));
  }

  @Test
  void inMemoryFilter_matchAtDepth2ButNotDepth1_intermediateNotKept() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(
        ROOT_FQN,
        new NodeInformation().withEntity(Map.of("fullyQualifiedName", ROOT_FQN)).withNodeDepth(0));
    nodes.put(
        "svc.db.schema.depth1",
        new NodeInformation()
            .withEntity(Map.of("fullyQualifiedName", "svc.db.schema.depth1"))
            .withNodeDepth(1));
    nodes.put(
        "svc.db.schema.depth2_match",
        new NodeInformation()
            .withEntity(
                Map.of(
                    "fullyQualifiedName",
                    "svc.db.schema.depth2_match",
                    "tier",
                    Map.of("tagFQN", "Tier.Tier3")))
            .withNodeDepth(2));

    Map<String, EsLineageData> downstreamEdges = new HashMap<>();
    downstreamEdges.put("e1", edge(ROOT_FQN, "svc.db.schema.depth1"));
    downstreamEdges.put("e2", edge("svc.db.schema.depth1", "svc.db.schema.depth2_match"));

    SearchLineageResult input = new SearchLineageResult();
    input.setNodes(nodes);
    input.setUpstreamEdges(new HashMap<>());
    input.setDownstreamEdges(downstreamEdges);

    EntityCountLineageRequest req =
        new EntityCountLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter(
                "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier3\"}}]}}}")
            .withFrom(0)
            .withSize(50);

    SearchLineageResult out =
        builder.applyInMemoryFiltersWithPathPreservationForEntityCount(input, req);

    assertTrue(out.getNodes().containsKey(ROOT_FQN));
    assertTrue(out.getNodes().containsKey("svc.db.schema.depth2_match"));
    // Table view strips intermediate nodes that don't match the filter
    assertFalse(out.getNodes().containsKey("svc.db.schema.depth1"));
  }

  @Test
  void matchesNodeFilterWithParsedFilterAvoidsDuplicateParsing() {
    NodeInformation node =
        new NodeInformation()
            .withEntity(
                Map.of("tags", List.of(Map.of("tagFQN", "PII.Sensitive")), "name", "customers"));

    Map<String, java.util.List<String>> parsedFilter =
        QueryFilterParser.parseFilter("{\"term\": {\"tags.tagFQN.keyword\": \"PII.Sensitive\"}}");

    // Pre-parsed filter overload should give the same result as string overload
    assertTrue(builder.matchesNodeFilter(node, parsedFilter));

    Map<String, java.util.List<String>> nonMatchingFilter =
        QueryFilterParser.parseFilter("{\"term\": {\"tags.tagFQN.keyword\": \"NonExistent\"}}");
    assertFalse(builder.matchesNodeFilter(node, nonMatchingFilter));
  }

  @Test
  void matchesNodeFilterWithParsedFilterHandlesNullAndEmpty() {
    NodeInformation node = new NodeInformation().withEntity(Map.of("name", "test"));

    assertFalse(builder.matchesNodeFilter(node, (Map<String, java.util.List<String>>) null));
    assertFalse(builder.matchesNodeFilter(node, new HashMap<String, java.util.List<String>>()));
    assertFalse(builder.matchesNodeFilter(null, QueryFilterParser.parseFilter("name:test")));
  }

  // --- paginateList tests ---

  @Test
  void paginateListReturnsEmptyForNullList() {
    assertEquals(new ArrayList<>(), builder.paginateList(null, 0, 10));
  }

  @Test
  void paginateListReturnsEmptyForEmptyList() {
    assertEquals(new ArrayList<>(), builder.paginateList(new ArrayList<>(), 0, 10));
  }

  @Test
  void paginateListReturnsEmptyWhenFromExceedsList() {
    assertEquals(new ArrayList<>(), builder.paginateList(List.of("a", "b"), 5, 10));
  }

  @Test
  void paginateListReturnsCorrectSublist() {
    List<String> result = builder.paginateList(List.of("a", "b", "c", "d", "e"), 1, 2);
    assertEquals(List.of("b", "c"), result);
  }

  @Test
  void paginateListClampsToEndOfList() {
    List<String> result = builder.paginateList(List.of("a", "b", "c"), 1, 100);
    assertEquals(List.of("b", "c"), result);
  }

  @Test
  void paginateListFromZeroSizeEqualsListSize() {
    List<String> result = builder.paginateList(List.of("a", "b", "c"), 0, 3);
    assertEquals(List.of("a", "b", "c"), result);
  }

  // --- calculateCurrentDepth tests ---

  @Test
  void calculateCurrentDepthReturnsZeroForNullDirection() {
    SearchLineageRequest request = new SearchLineageRequest().withUpstreamDepth(5);
    assertEquals(0, builder.calculateCurrentDepth(request, 3));
  }

  @Test
  void calculateCurrentDepthComputesUpstreamDepth() {
    SearchLineageRequest request =
        new SearchLineageRequest().withDirection(LineageDirection.UPSTREAM).withUpstreamDepth(5);
    // currentDepth = configuredMaxDepth - remainingDepth = 5 - 3 = 2
    assertEquals(2, builder.calculateCurrentDepth(request, 3));
  }

  @Test
  void calculateCurrentDepthComputesDownstreamDepth() {
    SearchLineageRequest request =
        new SearchLineageRequest()
            .withDirection(LineageDirection.DOWNSTREAM)
            .withDownstreamDepth(5);
    // currentDepth = (downstreamDepth + 1) - remainingDepth = 6 - 3 = 3
    assertEquals(3, builder.calculateCurrentDepth(request, 3));
  }

  // --- validateLayerParameters tests ---

  @Test
  void validateLayerParametersAcceptsValidParams() {
    SearchLineageRequest request = new SearchLineageRequest().withLayerFrom(0).withLayerSize(10);
    builder.validateLayerParameters(request);
  }

  @Test
  void validateLayerParametersThrowsForNegativeLayerFrom() {
    SearchLineageRequest request = new SearchLineageRequest().withLayerFrom(-1).withLayerSize(10);
    assertThrows(IllegalArgumentException.class, () -> builder.validateLayerParameters(request));
  }

  @Test
  void validateLayerParametersThrowsForNegativeLayerSize() {
    SearchLineageRequest request = new SearchLineageRequest().withLayerFrom(0).withLayerSize(-1);
    assertThrows(IllegalArgumentException.class, () -> builder.validateLayerParameters(request));
  }

  // --- applyInMemoryFiltersWithPathPreservation (SearchLineageRequest variant) ---

  @Test
  void applyInMemoryFiltersWithPathPreservationReturnsNullForNullResult() {
    SearchLineageRequest request =
        new SearchLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter("{\"term\":{\"tags.tagFQN\":\"PII\"}}");
    assertNull(builder.applyInMemoryFiltersWithPathPreservation(null, request));
  }

  @Test
  void applyInMemoryFiltersWithPathPreservationReturnsUnfilteredForEmptyFilter() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put("svc.db.schema.other", nodeAtDepth(1));
    SearchLineageResult result = resultWithNodes(nodes);

    SearchLineageRequest request = new SearchLineageRequest().withFqn(ROOT_FQN);
    SearchLineageResult out = builder.applyInMemoryFiltersWithPathPreservation(result, request);
    assertEquals(2, out.getNodes().size());
  }

  @Test
  void applyInMemoryFiltersWithPathPreservationKeepsMatchingNodesAndPaths() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT_FQN, nodeAtDepth(0));
    nodes.put(
        "svc.db.schema.mid",
        new NodeInformation()
            .withEntity(Map.of("tags", List.of(Map.of("tagFQN", "Internal"))))
            .withNodeDepth(1));
    nodes.put(
        "svc.db.schema.leaf",
        new NodeInformation()
            .withEntity(Map.of("tags", List.of(Map.of("tagFQN", "PII.Sensitive"))))
            .withNodeDepth(2));

    SearchLineageResult result = resultWithNodes(nodes);
    // Add downstream edges: root -> mid -> leaf
    Map<String, EsLineageData> downEdges = new HashMap<>();
    downEdges.put("e1", edge(ROOT_FQN, "svc.db.schema.mid"));
    downEdges.put("e2", edge("svc.db.schema.mid", "svc.db.schema.leaf"));
    result.setDownstreamEdges(downEdges);

    SearchLineageRequest request =
        new SearchLineageRequest()
            .withFqn(ROOT_FQN)
            .withQueryFilter("{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}");
    SearchLineageResult out = builder.applyInMemoryFiltersWithPathPreservation(result, request);

    // Root + leaf (match) + mid (intermediate path)
    assertTrue(out.getNodes().containsKey(ROOT_FQN));
    assertTrue(out.getNodes().containsKey("svc.db.schema.leaf"));
    assertTrue(out.getNodes().containsKey("svc.db.schema.mid"));
  }

  @Test
  void hasNodeLevelFiltersClassifiesStructuralAndNodeFilters() {
    assertFalse(builder.hasNodeLevelFilters("{\"term\":{\"deleted\":false}}"));
    assertFalse(builder.hasNodeLevelFilters("{\"term\":{\"id.keyword\":\"123\"}}"));
    assertTrue(
        builder.hasNodeLevelFilters("{\"term\":{\"tags.tagFQN.keyword\":\"PII.Sensitive\"}}"));
    assertTrue(builder.hasNodeLevelFilters("{\"wildcard\":{\"name\":{\"value\":\"*sales*\"}}}"));
    assertTrue(builder.hasNodeLevelFilters("{\"term\":{\"ownerName\":\"harsha\"}}"));
    assertTrue(builder.hasNodeLevelFilters("{\"term\":{\"domains.name.keyword\":\"Finance\"}}"));
  }

  @Test
  void getTraversalDepthPrefersSelectedDepthWhenProvided() {
    assertEquals(3, builder.getTraversalDepth(3, 10000));
    assertEquals(4, builder.getTraversalDepth(-4, 10000));
    assertEquals(6, builder.getTraversalDepth(null, 6));
    assertEquals(2, builder.getTraversalDepth(2, null));
  }

  @Test
  void sortEntityFqnsByDepthThenNameOrdersDepthFirstThenAlphabetically() {
    Map<String, Integer> depthByFqn =
        Map.of("svc.db.schema.b", 2, "svc.db.schema.a", 1, "svc.db.schema.c", 1);

    List<String> sorted =
        builder.sortEntityFqnsByDepthThenName(
            List.of("svc.db.schema.b", "svc.db.schema.c", "svc.db.schema.a"), depthByFqn);

    assertEquals(List.of("svc.db.schema.a", "svc.db.schema.c", "svc.db.schema.b"), sorted);
  }

  @Test
  void sortEntitiesByDepthThenNameOrdersGenericPayloadDeterministically() {
    record DepthCarrier(String fqn, int depth) {}

    List<DepthCarrier> sorted =
        builder.sortEntitiesByDepthThenName(
            List.of(
                new DepthCarrier("svc.db.schema.c", 2),
                new DepthCarrier("svc.db.schema.b", 1),
                new DepthCarrier("svc.db.schema.a", 1)),
            DepthCarrier::depth,
            DepthCarrier::fqn);

    assertEquals(
        List.of("svc.db.schema.a", "svc.db.schema.b", "svc.db.schema.c"),
        sorted.stream().map(DepthCarrier::fqn).toList());
  }

  private NodeInformation nodeWithEntity(String fqn, Map<String, Object> entity) {
    return new NodeInformation().withEntity(entity).withNodeDepth(1);
  }

  private static class TestableLineageGraphBuilder extends AbstractLineageGraphBuilder {

    TestableLineageGraphBuilder() {
      super();
    }

    @Override
    public int estimateGraphSize(LineageQueryContext context) {
      return 0;
    }

    @Override
    public SearchLineageResult executeInMemory(LineageQueryContext context, int batchSize)
        throws IOException {
      return new SearchLineageResult();
    }

    @Override
    public SearchLineageResult executeWithScroll(LineageQueryContext context, int batchSize)
        throws IOException {
      return new SearchLineageResult();
    }

    public List<String> sortEntityFqnsByDepthThenName(
        List<String> entityFqns, Map<String, Integer> depthByFqn) {
      return super.sortEntityFqnsByDepthThenName(entityFqns, depthByFqn);
    }

    public <T> List<T> sortEntitiesByDepthThenName(
        List<T> entities,
        java.util.function.ToIntFunction<T> depthExtractor,
        java.util.function.Function<T, String> fqnExtractor) {
      return super.sortEntitiesByDepthThenName(entities, depthExtractor, fqnExtractor);
    }
  }
}
