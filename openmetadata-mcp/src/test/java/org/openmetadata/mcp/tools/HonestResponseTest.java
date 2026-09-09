package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cases where a response used to state something it could not know.
 *
 * <p>Each of these was a live defect: a count in the wrong unit, a completeness flag that nothing
 * backed, a client error blamed on the backend, an exclusion that never reached the engine. They
 * share a failure mode rather than a call site - the payload was confident and wrong, which is worse
 * than an error for a caller that cannot check.
 */
class HonestResponseTest {

  // --- excludeEntityTypes reaching the engine -------------------------------------------------

  @Test
  void anExclusionWithNoCallerFilterStillBecomesAQuery() throws IOException {
    String filter = SearchMetadataTool.excludeOnlyFilter(Set.of("tableColumn"));

    assertTrue(filter != null, "without this the exclusion never reached the engine at all");
    JsonNode mustNot = JsonUtils.readTree(filter).path("query").path("bool").path("must_not");
    assertEquals(1, mustNot.size(), "the exclusion is a real must_not clause, not a post-filter");
    assertEquals(
        "tableColumn",
        mustNot.get(0).path("term").path("entityType").asText(),
        "post-filtering an already-fetched page returned an empty page for a query with hundreds of "
            + "matches, which reads as 'no such assets exist'");
  }

  @Test
  void nothingToExcludeLeavesTheRequestUnchanged() {
    assertNull(
        SearchMetadataTool.excludeOnlyFilter(Set.of()),
        "an empty exclusion must not attach a filter that narrows an ordinary search");
  }

  // --- semantic_search totalFound counted in entities -----------------------------------------

  @Test
  void totalFoundCountsEntitiesAndSaysWhenItIsOnlyALowerBound() {
    Map<String, Object> page = new HashMap<>();
    page.put("returnedCount", 8);
    page.put(McpResponseTrim.HAS_MORE_KEY, Boolean.TRUE);

    SemanticSearchTool.addParentTotal(page, 10);

    assertEquals(
        18,
        page.get("totalFound"),
        "results are collapsed to one row per parent, so totalFound must count parents too - "
            + "reporting the backend's chunk count made 8 tables read as 96");
    assertEquals(Boolean.TRUE, page.get("totalFoundIsLowerBound"), "more pages exist, so say so");
  }

  @Test
  void aFinishedPageReportsAnExactTotalWithNoCaveat() {
    Map<String, Object> page = new HashMap<>();
    page.put("returnedCount", 3);

    SemanticSearchTool.addParentTotal(page, 0);

    assertEquals(3, page.get("totalFound"), "paging has stopped, so the count is exact");
    assertNull(page.get("totalFoundIsLowerBound"), "an exact total must not be hedged");
  }

  // --- RCA completeness ------------------------------------------------------------------------

  @Test
  void aShortFailingTestListIsReportedComplete() {
    Map<String, Object> tests = new HashMap<>();

    RootCauseAnalysisTool.annotateCompleteness(tests, 3);

    assertEquals(3, tests.get("failingTestCount"));
    assertEquals(Boolean.TRUE, tests.get("complete"), "three of three is genuinely the whole set");
    assertNull(tests.get("completeNote"));
  }

  @Test
  void aFullBucketIsNotClaimedComplete() {
    Map<String, Object> tests = new HashMap<>();

    RootCauseAnalysisTool.annotateCompleteness(tests, 100);

    assertEquals(
        Boolean.FALSE,
        tests.get("complete"),
        "the lookup passes no limit, so the terms aggregation caps at 100 buckets and a full page "
            + "cannot be distinguished from a truncated one - 'complete: true' was hardcoded");
    assertTrue(
        tests.get("completeNote").toString().contains("originEntityFQN"),
        "the caveat carries the way to get the full set, not just the fact that it is capped");
  }

  // --- failure classification ------------------------------------------------------------------

  @Test
  void aStatusTheBackendReportedBeatsTheKeywordGuess() {
    Exception parseFailure =
        new IOException(
            "method [POST], host [http://localhost:9200], URI [/table_search_index/_search],"
                + " status line [HTTP/1.1 400 Bad Request] {\"error\":{\"root_cause\":"
                + "[{\"type\":\"parsing_exception\",\"reason\":\"[bool] malformed query\"}]}}");

    int status = DefaultToolContext.resolveStatusCode(parseFailure);

    assertEquals(
        400,
        status,
        "no name or keyword rule matches a search client's ResponseException, so this fell through "
            + "to 500 - and a 500 makes summarizeFailure tell the model its arguments were fine "
            + "and not to retry, for a query it wrote and could have fixed");
    assertFalse(DefaultToolContext.isServerFault(status), "a 400 is the caller's to correct");
  }

  @Test
  void aReportedServerErrorIsStillAServerFault() {
    Exception shardFailure =
        new IOException(
            "status line [HTTP/1.1 503 Service Unavailable] {\"error\":{\"type\":"
                + "\"index_not_found_exception\"}}");

    int status = DefaultToolContext.resolveStatusCode(shardFailure);

    assertEquals(
        503,
        status,
        "the body says index_not_found, which the keyword table read as a 404 - the reported status "
            + "is the one that is actually true");
    assertTrue(DefaultToolContext.isServerFault(status));
  }

  @Test
  void anExceptionWithNoReportedStatusStillUsesTheKeywordTable() {
    assertEquals(
        400,
        DefaultToolContext.resolveStatusCode(new IllegalArgumentException("bad 'size' parameter")),
        "the status extractor is an addition, not a replacement");
  }

  @Test
  void aQueryFilterThatFailsToParseIsTheCallersProblem() {
    Exception malformed =
        new IOException("JSON parsing failed with message [Failed to process JSON ]");

    int status = DefaultToolContext.resolveStatusCode(malformed);

    assertEquals(
        400,
        status,
        "a queryFilter is parsed before the request is sent, so this failure carries no reported "
            + "status and defaulted to 500 - telling the model its malformed DSL was a backend "
            + "outage not worth retrying, when it wrote the DSL and could fix it");
    assertFalse(DefaultToolContext.isServerFault(status));
  }

  // --- never-run semantics --------------------------------------------------------------------

  @Test
  void aQueuedTestDoesNotCountAsExecuted() {
    Map<String, Object> summary =
        Map.of("total", 13, "success", 0, "failed", 0, "aborted", 0, "queued", 13);

    Map<?, ?> annotated = (Map<?, ?>) GetEntityTool.withNeverRun(summary);

    assertEquals(
        13,
        annotated.get("neverRun"),
        "a queued test has produced no verdict, so counting it as executed would let a suite that "
            + "is merely waiting to run report neverRun: 0 - the exact 'zero failures reads as "
            + "healthy' trap this exists to close");
    assertTrue(
        annotated.get(McpResponseTrim.MESSAGE_KEY).toString().contains("unverified"),
        "the caveat must still fire for an all-queued suite");
  }

  @Test
  void executedTestsSuppressTheNeverRunCaveat() {
    Map<String, Object> summary =
        Map.of("total", 4, "success", 3, "failed", 1, "aborted", 0, "queued", 0);

    Map<?, ?> annotated = (Map<?, ?>) GetEntityTool.withNeverRun(summary);

    assertEquals(0, annotated.get("neverRun"));
    assertNull(annotated.get(McpResponseTrim.MESSAGE_KEY), "nothing to caveat when all tests ran");
  }

  // --- lineage reach without a per-neighbour probe ----------------------------------------------

  @Test
  void reachIsDecidedByWhereEdgesAttachNotByProbingEachNeighbour() {
    UUID root = UUID.randomUUID();
    UUID parent = UUID.randomUUID();
    UUID grandparent = UUID.randomUUID();
    Map<UUID, EntityReference> index = new HashMap<>();
    index.put(parent, ref(parent, "svc.db.schema.parent"));
    index.put(grandparent, ref(grandparent, "svc.db.schema.grandparent"));
    List<Edge> upstream = List.of(edge(parent, root), edge(grandparent, parent));

    Map<String, Object> summary = new LinkedHashMap<>();
    GetEntityTool.addDirection(summary, root, index, upstream, true);

    assertEquals(
        List.of("svc.db.schema.parent"),
        summary.get("upstream"),
        "only the edge touching the root is an immediate neighbour");
    assertEquals(
        Boolean.TRUE,
        summary.get("hasMoreUpstream"),
        "the second-hop edge is the whole signal - the probe it replaced looked each neighbour up "
            + "under the ROOT's entity type, so a neighbour of any other type threw and the entire "
            + "lineage block degraded to 'unavailable'");
  }

  @Test
  void aTerminatingChainReportsNoMore() {
    UUID root = UUID.randomUUID();
    UUID parent = UUID.randomUUID();
    Map<UUID, EntityReference> index = new HashMap<>();
    index.put(parent, ref(parent, "svc.db.schema.parent"));

    Map<String, Object> summary = new LinkedHashMap<>();
    GetEntityTool.addDirection(summary, root, index, List.of(edge(parent, root)), true);

    assertEquals(Boolean.FALSE, summary.get("hasMoreUpstream"), "one hop and the graph ends");
  }

  @Test
  void anEmptyDirectionIsStillReported() {
    Map<String, Object> summary = new LinkedHashMap<>();

    GetEntityTool.addDirection(
        summary, UUID.randomUUID(), new HashMap<>(), new ArrayList<>(), false);

    assertEquals(List.of(), summary.get("downstream"));
    assertEquals(
        Boolean.FALSE,
        summary.get("hasMoreDownstream"),
        "an absent flag would leave the caller guessing whether the direction was checked");
  }

  private static EntityReference ref(UUID id, String fqn) {
    return new EntityReference().withId(id).withFullyQualifiedName(fqn);
  }

  private static Edge edge(UUID from, UUID to) {
    return new Edge().withFromEntity(from).withToEntity(to);
  }
}
