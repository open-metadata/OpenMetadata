package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.schema.utils.JsonUtils;

class LineageEdgePagerTest {

  private static final String ROOT = "db.public.orders";
  private static final int CAP = 100_000;

  private static CompactLineageEdge downstream(String from, String to, String sql) {
    return new CompactLineageEdge()
        .withFromFQN(from)
        .withToFQN(to)
        .withRelationshipType("sql")
        .withSqlQuery(sql)
        .withColumnsLineage(null)
        .withTempLineageTables(null);
  }

  private static CompactLineage graph(
      List<CompactLineageEdge> upstream, List<CompactLineageEdge> downstream) {
    return new CompactLineage()
        .withRoot(ROOT)
        .withRootType("table")
        .withUpstream(upstream)
        .withDownstream(downstream)
        .withOversizedEdges(null);
  }

  private static List<CompactLineageEdge> consumers(int count, int sqlChars) {
    return IntStream.range(0, count)
        .mapToObj(i -> downstream(ROOT, "db.mart.consumer_" + i, "x".repeat(sqlChars)))
        .toList();
  }

  private static List<String> toFqns(CompactLineage page) {
    return Stream.concat(page.getUpstream().stream(), page.getDownstream().stream())
        .map(CompactLineageEdge::getToFQN)
        .toList();
  }

  @Test
  void aGraphThatFitsComesBackWholeAndSaysSo() {
    CompactLineage page =
        LineageEdgePager.page(graph(List.of(), consumers(3, 10)), 0, Integer.MAX_VALUE, CAP);

    assertEquals(3, page.getReturnedEdges());
    assertEquals(3, page.getTotalEdges());
    assertEquals(Boolean.FALSE, page.getHasMore());
    assertEquals(Boolean.FALSE, page.getEdgesTruncated());
    assertNull(page.getNextFrom());
  }

  /** A page boundary is only meaningful if the graph orders the same way on every call. */
  @Test
  void ordersNearestHopFirstThenByFqn() {
    List<CompactLineageEdge> scrambled =
        List.of(
            downstream("db.mart.b_stage", "db.mart.c_report", null),
            downstream(ROOT, "db.mart.b_stage", null),
            downstream(ROOT, "db.mart.a_audit", null));

    CompactLineage page =
        LineageEdgePager.page(graph(List.of(), scrambled), 0, Integer.MAX_VALUE, CAP);

    assertEquals(List.of("db.mart.a_audit", "db.mart.b_stage", "db.mart.c_report"), toFqns(page));
  }

  /** REST callers size pages by edge count; the char cap only guards the transport. */
  @Test
  void anEdgeLimitCutsThePageAndPointsAtTheRest() {
    CompactLineage page = LineageEdgePager.page(graph(List.of(), consumers(5, 10)), 0, 2, CAP);

    assertEquals(2, page.getReturnedEdges());
    assertEquals(Boolean.TRUE, page.getHasMore());
    assertEquals(2, page.getNextFrom());
    assertEquals(5, page.getDownstreamTotal());
  }

  @Test
  void followingNextFromReturnsEveryEdgeExactlyOnceWithinTheCap() {
    CompactLineage slim = graph(List.of(), consumers(40, 9_000));
    List<String> seen = new ArrayList<>();
    Integer from = 0;
    int pages = 0;
    while (from != null && pages < 20) {
      CompactLineage page = LineageEdgePager.page(slim, from, Integer.MAX_VALUE, CAP);
      assertTrue(JsonUtils.pojoToJson(page).length() < CAP, "every page stays under the cap");
      seen.addAll(toFqns(page));
      from = page.getNextFrom();
      pages++;
    }

    assertTrue(pages > 1);
    assertEquals(40, seen.size());
    assertEquals(40, new HashSet<>(seen).size());
  }

  /**
   * An edge larger than any response would be returned alone by forward progress, and a transport
   * cap would then replace the page with a stub that strands every later edge.
   */
  @Test
  void anEdgeNoResponseCanHoldIsSkippedNamedAndCounted() {
    List<CompactLineageEdge> edges =
        List.of(
            downstream(ROOT, "db.mart.a_small", "SELECT 1"),
            downstream(ROOT, "db.mart.b_huge", "x".repeat(CAP + 10_000)));

    CompactLineage first =
        LineageEdgePager.page(graph(List.of(), edges), 0, Integer.MAX_VALUE, CAP);
    CompactLineage second =
        LineageEdgePager.page(graph(List.of(), edges), first.getNextFrom(), Integer.MAX_VALUE, CAP);

    assertEquals(List.of("db.mart.a_small"), toFqns(first));
    assertEquals(List.of(), toFqns(second));
    assertEquals(1, second.getOversizedEdgeCount());
    assertEquals("db.mart.b_huge", second.getOversizedEdges().getFirst().getToFQN());
    assertEquals(
        Boolean.TRUE, second.getEdgesTruncated(), "a skipped edge leaves the graph incomplete");
    assertNull(second.getNextFrom(), "nothing is left to page to");
  }

  @Test
  void anOffsetPastTheEndReturnsNoEdges() {
    CompactLineage page =
        LineageEdgePager.page(graph(List.of(), consumers(3, 10)), 500, Integer.MAX_VALUE, CAP);

    assertEquals(0, page.getReturnedEdges());
    assertEquals(3, page.getTotalEdges());
    assertEquals(Boolean.FALSE, page.getHasMore());
  }
}
