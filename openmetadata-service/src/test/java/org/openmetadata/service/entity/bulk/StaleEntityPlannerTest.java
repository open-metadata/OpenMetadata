package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;
import org.openmetadata.service.util.FullyQualifiedName;

class StaleEntityPlannerTest {
  @Test
  void removesSeenRowsUsingCanonicalHashes() {
    final var rows = List.of(row("service.schema.\"table.name\""), row("service.schema.other"));
    final var stale = StaleEntityPlanner.plan(rows, List.of("service.\"schema\".\"table.name\""));
    assertEquals(
        List.of("service.schema.other"),
        stale.stream().map(StaleEntityPlanner.Candidate::fqn).toList());
    assertEquals(rows.getLast().id, stale.getFirst().id());
    assertEquals(2, StaleEntityPlanner.plan(rows, List.of("SERVICE.schema.\"TABLE.NAME\"")).size());
  }

  @Test
  void sortsParentsBeforeDescendantsWithoutTreatingQuotedDotsAsLevels() {
    final var rows =
        List.of(
            row("service.parent.child"),
            row("service.\"parent.with.dots\""),
            row("service.parent"),
            row("service.second.child"));
    final var stale = StaleEntityPlanner.plan(rows, List.of("service.seen"));
    assertEquals(
        List.of(rows.get(1).fqn, rows.get(2).fqn, rows.getFirst().fqn, rows.getLast().fqn),
        stale.stream().map(StaleEntityPlanner.Candidate::fqn).toList());
    stale.forEach(
        candidate -> assertEquals(FullyQualifiedName.buildHash(candidate.fqn()), candidate.hash()));
    assertEquals(
        List.of(2, 2, 3, 3), stale.stream().map(StaleEntityPlanner.Candidate::depth).toList());
  }

  @Test
  void ignoresMalformedSeenNamesAndToleratesAbsentLists() {
    final var rows = List.of(row("service.table"));
    assertEquals(1, StaleEntityPlanner.plan(rows, Arrays.asList(null, "", "<bad>")).size());
    assertEquals(1, StaleEntityPlanner.plan(rows, null).size());
    assertTrue(StaleEntityPlanner.plan(List.of(), List.of("<bad>")).isEmpty());
  }

  @Test
  void onlySuccessfulAncestorHashesCoverDescendants() {
    final var candidates =
        StaleEntityPlanner.plan(
            List.of(row("service.parent.child"), row("service.sibling")), List.of());
    final var child = candidates.getLast();
    assertTrue(
        StaleEntityPlanner.isCovered(
            child.hash(), Set.of(FullyQualifiedName.buildHash("service.parent"))));
    assertTrue(
        StaleEntityPlanner.isCovered(
            child.hash(), Set.of(FullyQualifiedName.buildHash("service"))));
    assertFalse(
        StaleEntityPlanner.isCovered(
            child.hash(), Set.of(FullyQualifiedName.buildHash("service.other"))));
    assertFalse(StaleEntityPlanner.isCovered(child.hash(), Set.of(child.hash())));
    assertFalse(StaleEntityPlanner.isCovered(child.hash(), Set.of()));
  }

  private EntityIdFqnPair row(String fqn) {
    return new EntityIdFqnPair(UUID.randomUUID(), fqn);
  }
}
