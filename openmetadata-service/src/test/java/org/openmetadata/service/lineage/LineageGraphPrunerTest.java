package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class LineageGraphPrunerTest {

  private static final UUID ROOT = UUID.randomUUID();
  private static final UUID A = UUID.randomUUID();
  private static final UUID B = UUID.randomUUID();
  private static final UUID C = UUID.randomUUID();

  @Test
  void keepsEverythingWhenAllNodesAreVisible() {
    EntityLineage lineage = chain();

    int hidden = LineageGraphPruner.retainReachable(lineage, Set.of(ROOT, A, B, C));

    assertEquals(0, hidden);
    assertEquals(Set.of(A, B, C), nodeIds(lineage));
    assertEquals(3, lineage.getUpstreamEdges().size());
  }

  @Test
  void dropsAHiddenNodeAndTheEdgeThatTouchedIt() {
    EntityLineage lineage = chain();

    int hidden = LineageGraphPruner.retainReachable(lineage, Set.of(ROOT, A, B));

    assertEquals(1, hidden, "C was not visible");
    assertEquals(Set.of(A, B), nodeIds(lineage));
    assertTrue(
        lineage.getUpstreamEdges().stream().noneMatch(e -> C.equals(e.getFromEntity())),
        "an edge pointing at a removed node would dangle");
  }

  /**
   * The reason visibility alone is not enough. C is visible but only reachable through A, which is
   * not. Keeping it would present C as lineage of the root when the only path between them runs
   * through an asset the caller cannot see.
   */
  @Test
  void dropsNodesReachableOnlyThroughAHiddenNode() {
    EntityLineage lineage = chain();

    int hidden = LineageGraphPruner.retainReachable(lineage, Set.of(ROOT, B, C));

    assertEquals(3, hidden, "A is hidden, so B and C are cut off with it");
    assertEquals(Set.of(), nodeIds(lineage));
    assertTrue(lineage.getUpstreamEdges().isEmpty());
  }

  @Test
  void dropsTheWholeGraphWhenTheRootItselfIsNotVisible() {
    EntityLineage lineage = chain();

    int hidden = LineageGraphPruner.retainReachable(lineage, Set.of(A, B, C));

    assertEquals(3, hidden);
    assertEquals(Set.of(), nodeIds(lineage));
  }

  @Test
  void keepsASiblingBranchWhenAnotherBranchIsHidden() {
    // root <- A, root <- B: independent branches, so hiding A must not affect B.
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(ref(ROOT))
            .withNodes(new ArrayList<>(List.of(ref(A), ref(B))))
            .withUpstreamEdges(new ArrayList<>(List.of(edge(A, ROOT), edge(B, ROOT))))
            .withDownstreamEdges(new ArrayList<>());

    int hidden = LineageGraphPruner.retainReachable(lineage, Set.of(ROOT, B));

    assertEquals(1, hidden);
    assertEquals(Set.of(B), nodeIds(lineage));
    assertEquals(1, lineage.getUpstreamEdges().size());
  }

  /** root <- A <- B <- C, all upstream. */
  private static EntityLineage chain() {
    return new EntityLineage()
        .withEntity(ref(ROOT))
        .withNodes(new ArrayList<>(List.of(ref(A), ref(B), ref(C))))
        .withUpstreamEdges(new ArrayList<>(List.of(edge(A, ROOT), edge(B, A), edge(C, B))))
        .withDownstreamEdges(new ArrayList<>());
  }

  private static EntityReference ref(UUID id) {
    return new EntityReference()
        .withId(id)
        .withType(Entity.TABLE)
        .withFullyQualifiedName("svc.db.sch." + id);
  }

  private static Edge edge(UUID from, UUID to) {
    return new Edge().withFromEntity(from).withToEntity(to);
  }

  private static Set<UUID> nodeIds(EntityLineage lineage) {
    return lineage.getNodes().stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
