package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.HydrateLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.lineage.NodeInformation;

class LineageHydratorTest {
  private final LineageHydrator hydrator = new LineageHydrator(null);

  @ParameterizedTest
  @MethodSource("invalidHydrationRequests")
  void rejectsRequestsWithoutResolvableIdentities(HydrateLineageRequest request) {
    assertThrows(IllegalArgumentException.class, () -> hydrator.hydrate(null, null, request));
  }

  @Test
  void retainsAbsentAndEmptyGraphs() {
    assertNull(hydrator.pruneUnauthorizedLineage(null, null, Include.NON_DELETED, false));
    SearchLineageResult empty = new SearchLineageResult().withNodes(new LinkedHashMap<>());
    assertSame(empty, hydrator.pruneUnauthorizedLineage(null, empty, Include.NON_DELETED, false));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void keepsSyntheticCountsOnlyWhenTheirAggregationWasAuthorized(boolean preserveCounts) {
    Map<String, NodeInformation> nodes = new LinkedHashMap<>();
    nodes.put("booleanCount", node(Map.of("lineageSceneSyntheticCount", true)));
    nodes.put("stringCount", node(Map.of("lineageSceneSyntheticCount", "TrUe")));
    nodes.put("notCount", node(Map.of("lineageSceneSyntheticCount", false)));
    nodes.put("missingEntity", new NodeInformation());
    nodes.put("nullNode", null);
    nodes.put(
        "badId",
        node(
            Map.of(
                "entityType",
                "",
                "type",
                "table",
                "fullyQualifiedName",
                "table",
                "id",
                "invalid")));
    nodes.put("missingType", node(Map.of("fullyQualifiedName", "table", "id", UUID.randomUUID())));
    Map<String, EsLineageData> edges = new LinkedHashMap<>();
    edges.put("missingEndpoints", new EsLineageData());
    edges.put("nullEdge", null);
    SearchLineageResult graph =
        new SearchLineageResult()
            .withNodes(nodes)
            .withUpstreamEdges(new LinkedHashMap<>(edges))
            .withDownstreamEdges(new LinkedHashMap<>(edges));

    SearchLineageResult result =
        hydrator.pruneUnauthorizedLineage(null, graph, Include.NON_DELETED, preserveCounts);

    assertEquals(
        preserveCounts ? Set.of("booleanCount", "stringCount") : Set.of(),
        result.getNodes().keySet());
    assertTrue(result.getUpstreamEdges().isEmpty());
    assertTrue(result.getDownstreamEdges().isEmpty());
  }

  private static NodeInformation node(Map<String, Object> entity) {
    return new NodeInformation().withEntity(entity);
  }

  private static Stream<HydrateLineageRequest> invalidHydrationRequests() {
    return Stream.of(
        null,
        new HydrateLineageRequest(),
        new HydrateLineageRequest().withEntities(List.of()),
        new HydrateLineageRequest().withEntities(Collections.singletonList(null)),
        new HydrateLineageRequest().withEntities(List.of(new EntityReference().withType("table"))),
        new HydrateLineageRequest()
            .withEntities(List.of(new EntityReference().withId(UUID.randomUUID()))),
        new HydrateLineageRequest()
            .withEntities(List.of(new EntityReference().withType(" ").withId(UUID.randomUUID()))));
  }
}
