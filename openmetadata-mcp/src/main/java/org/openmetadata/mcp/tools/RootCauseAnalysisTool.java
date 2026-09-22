package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.mcp.tools.SearchMetadataTool.cleanSearchResponseObject;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.google.common.annotations.VisibleForTesting;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class RootCauseAnalysisTool implements McpTool {

  private static final int DEFAULT_DEPTH = 3;

  /**
   * The bucket ceiling {@code EntityTimeSeriesRepository.buildAggregationNodes} applies when the
   * caller passes no limit. Mirrored here so a full page can be reported as possibly-truncated
   * rather than asserted complete.
   */
  private static final int RESULT_BUCKET_CAP = 100;

  private static final int MAX_DEPTH = 10;
  // Slimming budgets come from McpResponseTrim so RCA's lineage-derived payload stays within
  // LLM/MCP context limits. The backend (searchDataQualityLineage / searchLineageWithDirection)
  // is shared with the UI LineageResource and is never touched — we only transform the
  // in-memory result before returning it to the MCP client.
  private static final String RELATIONSHIP_SQL = "sql";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> parameters) {
    String fqn = (String) parameters.get("fqn");
    String entityType = (String) parameters.getOrDefault("entityType", "table");
    int upstreamDepth = clampDepth(McpParams.getInt(parameters, "upstreamDepth", DEFAULT_DEPTH));
    int downstreamDepth =
        clampDepth(McpParams.getInt(parameters, "downstreamDepth", DEFAULT_DEPTH));
    String queryFilter = (String) parameters.get("queryFilter");
    boolean includeDeleted = McpParams.getBoolean(parameters, "includeDeleted", false);
    boolean includeColumns = McpParams.getBoolean(parameters, "includeColumnLineage", false);

    if (fqn == null || fqn.trim().isEmpty()) {
      throw new IllegalArgumentException("Parameter 'fqn' is required and cannot be empty");
    }

    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType));

    RcaRequest request =
        new RcaRequest(
            fqn.trim(),
            entityType,
            upstreamDepth,
            downstreamDepth,
            queryFilter,
            includeDeleted,
            includeColumns,
            getSubjectContext(securityContext));
    try {
      return analyze(request);
    } catch (IOException e) {
      LOG.error("IOException during root cause analysis for entity: {}", fqn, e);
      throw new RuntimeException(
          "Failed to perform root cause analysis: " + McpResponseTrim.safeMessage(e), e);
    } catch (Exception e) {
      LOG.error("Unexpected error during root cause analysis for entity: {}", fqn, e);
      throw new RuntimeException(
          "Unexpected error during root cause analysis: " + McpResponseTrim.safeMessage(e), e);
    }
  }

  /** Bundles the parsed and validated tool arguments for a single root cause analysis run. */
  /**
   * {@code subject} is the caller's identity, carried so every lineage read below applies their
   * domain restrictions ({@code LineageDomainFilter}). The overloads that omit it prune nothing, so
   * a domain-restricted caller would see producers and impacted assets they cannot access.
   */
  private record RcaRequest(
      String fqn,
      String entityType,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean includeDeleted,
      boolean includeColumns,
      SubjectContext subject) {}

  private Map<String, Object> analyze(RcaRequest request) throws IOException {
    Map<String, Object> result = new HashMap<>();
    result.put("fqn", request.fqn());
    result.put("upstreamDepth", request.upstreamDepth());
    result.put("downstreamDepth", request.downstreamDepth());

    Response upstreamResponse =
        Entity.getSearchRepository()
            .searchDataQualityLineage(
                request.fqn(),
                request.upstreamDepth(),
                request.queryFilter(),
                request.includeDeleted(),
                request.subject());
    Map<String, Object> upstreamAnalysis =
        buildUpstreamAnalysis(upstreamResponse.getEntity(), request);
    result.put("upstreamAnalysis", upstreamAnalysis);

    int failureCount =
        ((Number) upstreamAnalysis.getOrDefault("failingUpstreamNodesCount", 0)).intValue();
    boolean rootFails = Boolean.TRUE.equals(upstreamAnalysis.get(ROOT_HAS_FAILING_TESTS));
    boolean hasFailures = failureCount > 0 || rootFails;
    result.put(
        "downstreamAnalysis",
        hasFailures ? buildDownstreamAnalysis(request) : noFailuresDownstream());
    result.put("status", hasFailures ? "failed" : "success");
    result.put("summary", summarize(request.fqn(), failureCount, rootFails));
    return enforceSizeBudget(result);
  }

  /**
   * Distinguishes "the failures start here" from "the failures are inherited from upstream".
   *
   * <p>The DQ lineage walk includes the analysed entity among its own nodes when that entity has
   * failing tests, so counting nodes reported an upstream failure that did not exist.
   */
  @VisibleForTesting
  static String summarize(String fqn, int upstreamFailures, boolean rootFails) {
    final String origin;
    if (upstreamFailures > 0) {
      origin =
          String.format(
              "Found %d failing upstream entity(ies) — the likely root cause is upstream.",
              upstreamFailures);
    } else if (rootFails) {
      origin =
          "No upstream entity has failing tests, so the failures originate on this asset itself.";
    } else {
      origin = "No failing tests found on this asset or upstream of it.";
    }
    return String.format(
        "Analyzed upstream causes and downstream impacts for '%s'. %s", fqn, origin);
  }

  private Map<String, Object> buildUpstreamAnalysis(Object upstreamEntity, RcaRequest request) {
    Map<String, Object> upstreamAnalysis = new HashMap<>();
    if (!(upstreamEntity instanceof Map)) {
      return upstreamAnalysis;
    }
    Map<String, Object> upstreamLineageData = castMap(upstreamEntity);
    Set<?> rawEdges = asSet(upstreamLineageData.get("edges"));
    List<Map<String, Object>> allNodes = slimUpstreamNodes(asSet(upstreamLineageData.get("nodes")));
    List<Map<String, Object>> nodes = new ArrayList<>();
    Map<String, Object> rootNode = null;
    for (Map<String, Object> node : allNodes) {
      if (request.fqn().equals(node.get("fullyQualifiedName"))) {
        rootNode = node;
      } else {
        nodes.add(node);
      }
    }
    boolean rootFails = rootNode != null;

    upstreamAnalysis.put(ROOT_HAS_FAILING_TESTS, rootFails);
    // Knowing that the root is failing without knowing which tests failed costs another search.
    // The same helper already resolves this for upstream nodes; the root was just excluded.
    if (rootFails) {
      Map<String, Object> rootTests = addTestCaseResultForTestSuite(rootNode);
      // A list with no total reads as possibly-trimmed, especially next to this tool's own notice
      // that node and edge details are cut for context. Say whether it is the full set.
      Object results = rootTests.get("testCaseResults");
      if (results instanceof List<?> list) {
        annotateCompleteness(rootTests, list.size());
      }
      upstreamAnalysis.put("rootFailingTests", rootTests);
    }
    upstreamAnalysis.put("failingUpstreamNodesCount", nodes.size());
    if (!nodes.isEmpty()) {
      nodes.forEach(node -> node.put("failingTestCases", addTestCaseResultForTestSuite(node)));
      upstreamAnalysis.put("failingUpstreamNodes", nodes);
    }
    upstreamAnalysis.put("failingUpstreamEdgesCount", rawEdges.size());
    upstreamAnalysis.put("failingUpstreamEdges", slimEdges(rawEdges, request.includeColumns()));
    upstreamAnalysis.put(
        "description", "Upstream entities that may be causing data quality failures");
    if (nodes.isEmpty()) {
      addUpstreamProducers(upstreamAnalysis, request);
    }
    return upstreamAnalysis;
  }

  /**
   * When nothing upstream is failing, the DQ walk returns no upstream edges at all - so a caller
   * asking "what could be causing this?" learns nothing about what feeds the asset. The producers
   * are cheap to resolve in-process, so attach them here instead of costing another call.
   */
  private static void addUpstreamProducers(
      Map<String, Object> upstreamAnalysis, RcaRequest request) {
    try {
      EntityLineage lineage =
          Entity.getLineageRepository()
              .getByName(
                  request.entityType(),
                  request.fqn(),
                  request.upstreamDepth(),
                  0,
                  request.subject());
      List<Map<String, Object>> producers = new ArrayList<>();
      if (lineage != null && !nullOrEmpty(lineage.getNodes())) {
        lineage.getNodes().forEach(node -> producers.add(producerOf(node)));
      }
      upstreamAnalysis.put("upstreamProducers", producers);
      upstreamAnalysis.put(
          "upstreamProducersNote",
          "No upstream entity has failing tests. These are the assets that feed this one, so the"
              + " cause is more likely to be local (a load, a transformation) than inherited.");
    } catch (Exception e) {
      // Producers are context, not the answer: a lineage lookup failure must not fail the analysis.
      LOG.warn("Could not resolve upstream producers for {}: {}", request.fqn(), e.getMessage());
    }
  }

  private static Map<String, Object> producerOf(EntityReference node) {
    Map<String, Object> producer = new LinkedHashMap<>();
    producer.put("fullyQualifiedName", node.getFullyQualifiedName());
    producer.put("type", node.getType());
    return producer;
  }

  private Map<String, Object> buildDownstreamAnalysis(RcaRequest request) {
    Map<String, Object> downstreamAnalysis = new HashMap<>();
    downstreamAnalysis.put(
        "description", "Downstream entities that may be impacted by the identified failures");
    try {
      SearchLineageRequest downstreamRequest =
          new SearchLineageRequest()
              .withFqn(request.fqn())
              .withDirection(LineageDirection.DOWNSTREAM)
              .withUpstreamDepth(0)
              .withDownstreamDepth(request.downstreamDepth())
              .withQueryFilter(request.queryFilter())
              .withIsConnectedVia(isConnectedVia(request.entityType()))
              .withIncludeDeleted(request.includeDeleted());
      SearchLineageResult downstreamResult =
          Entity.getSearchRepository()
              .searchLineageWithDirection(downstreamRequest, request.subject());
      addDownstreamNodes(downstreamAnalysis, downstreamResult);
      addDownstreamEdges(downstreamAnalysis, downstreamResult, request.includeColumns());
    } catch (Exception e) {
      LOG.warn("Failed to perform downstream impact analysis for entity: {}", request.fqn(), e);
      downstreamAnalysis.put(
          "error", "Failed to analyze downstream impact: " + McpResponseTrim.safeMessage(e));
    }
    return downstreamAnalysis;
  }

  private static void addDownstreamNodes(
      Map<String, Object> downstreamAnalysis, SearchLineageResult result) {
    if (result.getNodes() != null) {
      // The traversal includes the analysed asset itself at nodeDepth 0, so counting it would
      // overstate the blast radius by one on every call.
      downstreamAnalysis.put(
          "downstreamImpactedNodesCount", Math.max(0, result.getNodes().size() - 1));
      downstreamAnalysis.put("downstreamNodes", slimDownstreamNodes(result.getNodes()));
    }
  }

  private static void addDownstreamEdges(
      Map<String, Object> downstreamAnalysis, SearchLineageResult result, boolean includeColumns) {
    if (result.getDownstreamEdges() != null) {
      downstreamAnalysis.put("downstreamImpactedEdgesCount", result.getDownstreamEdges().size());
      downstreamAnalysis.put(
          "downstreamEdges", slimEdgeMap(result.getDownstreamEdges(), includeColumns));
    }
  }

  private static Map<String, Object> noFailuresDownstream() {
    Map<String, Object> downstreamAnalysis = new HashMap<>();
    downstreamAnalysis.put(
        "reason", "No failures found in upstream analysis, downstream impact analysis not needed");
    return downstreamAnalysis;
  }

  private static List<Map<String, Object>> slimUpstreamNodes(Set<?> rawNodes) {
    List<Map<String, Object>> nodes = new ArrayList<>();
    for (Object node : rawNodes) {
      if (node instanceof Map) {
        nodes.add(slimNodeEntity(castMap(node)));
      }
    }
    return nodes;
  }

  @VisibleForTesting
  static Map<String, Object> slimDownstreamNodes(Map<String, ?> rawNodes) {
    Map<String, Object> slim = new LinkedHashMap<>();
    rawNodes.forEach((id, nodeInfo) -> slim.put(id, slimNodeInformation(nodeInfo)));
    return slim;
  }

  private static Map<String, Object> slimNodeInformation(Object nodeInfo) {
    Map<String, Object> info = JsonUtils.getMap(nodeInfo);
    Map<String, Object> slim = new LinkedHashMap<>();
    if (info != null) {
      Object entity = info.get("entity");
      if (entity instanceof Map) {
        slim.put("entity", withoutBulkFields(slimNodeEntity(castMap(entity))));
      }
      putIfPresent(slim, "nodeDepth", info.get("nodeDepth"));
    }
    return slim;
  }

  /**
   * Strips the per-node bulk that impact analysis never reads.
   *
   * <p>A single downstream node can carry its column names twice over - once as {@code columnNames},
   * again inside {@code aiContext} - which dominated the response. A downstream node answers "what
   * else breaks", so it needs identity only: FQN, name, type, owners, tier.
   */
  private static Map<String, Object> withoutBulkFields(Map<String, Object> entity) {
    NODE_BULK_FIELDS.forEach(entity::remove);
    return entity;
  }

  /**
   * Cleans an entity document the same way upstream nodes are cleaned ({@link
   * SearchMetadataTool#cleanSearchResponseObject} drops {@code columns}, {@code schemaDefinition},
   * {@code queries} and other verbose keys). The description is left in full; overall size is bounded
   * by fitting fewer edges in {@link #enforceSizeBudget}, not by cutting field content.
   */
  @VisibleForTesting
  static Map<String, Object> slimNodeEntity(Map<String, Object> node) {
    return cleanSearchResponseObject(node);
  }

  @VisibleForTesting
  static List<Map<String, Object>> slimEdges(Collection<?> rawEdges, boolean includeColumns) {
    List<Map<String, Object>> edges = new ArrayList<>();
    for (Object edge : rawEdges) {
      edges.add(slimEdge(JsonUtils.getMap(edge), includeColumns));
    }
    return edges;
  }

  @VisibleForTesting
  static Map<String, Object> slimEdgeMap(Map<String, ?> rawEdges, boolean includeColumns) {
    Map<String, Object> slim = new LinkedHashMap<>();
    rawEdges.forEach((id, edge) -> slim.put(id, slimEdge(JsonUtils.getMap(edge), includeColumns)));
    return slim;
  }

  /**
   * Reduces a raw {@code EsLineageData} edge to the fields useful for reasoning. Drops {@code
   * docId}/{@code docUniqueId}/{@code fqnHash}, audit fields and the raw {@code pipeline} blob
   * (folded into {@code relationshipType}); keeps {@code sqlQuery} in full, since the transformation
   * SQL is the point of the edge; and includes column-level lineage only when explicitly requested.
   */
  @VisibleForTesting
  static Map<String, Object> slimEdge(Map<String, Object> edge, boolean includeColumns) {
    Map<String, Object> slim = new LinkedHashMap<>();
    if (edge != null) {
      putIfPresent(slim, "fromEntity", slimRef(edge.get("fromEntity")));
      putIfPresent(slim, "toEntity", slimRef(edge.get("toEntity")));
      slim.put("relationshipType", relationshipType(edge.get("pipeline")));
      putIfPresent(slim, "source", edge.get("source"));
      putIfPresent(slim, "assetEdges", edge.get("assetEdges"));
      putIfPresent(slim, "tempLineageTables", edge.get("tempLineageTables"));
      applyDescription(slim, edge.get("description"));
      applySqlQuery(slim, edge.get("sqlQuery"));
      // For deduplicated SQL the backend empties sqlQuery and stores a pointer into the parent
      // doc's lineageSqlQueries map; carry the pointer so shared SQL isn't silently lost.
      putIfPresent(slim, "sqlQueryKey", edge.get("sqlQueryKey"));
      if (includeColumns) {
        putIfPresent(slim, "columns", edge.get("columns"));
      }
    }
    return slim;
  }

  private static Map<String, Object> slimRef(Object ref) {
    Map<String, Object> result = null;
    if (ref instanceof Map) {
      Map<String, Object> refMap = castMap(ref);
      result = new LinkedHashMap<>();
      putIfPresent(result, "id", refMap.get("id"));
      putIfPresent(result, "fullyQualifiedName", refMap.get("fullyQualifiedName"));
      putIfPresent(result, "type", refMap.get("type"));
    }
    return result;
  }

  private static String relationshipType(Object pipeline) {
    String result = RELATIONSHIP_SQL;
    if (pipeline instanceof Map) {
      Map<String, Object> pipelineMap = castMap(pipeline);
      Object type = pipelineMap.get("type");
      Object name = pipelineMap.get("name");
      if (type != null && name != null) {
        result = type + ":" + name;
      }
    }
    return result;
  }

  private static void applyDescription(Map<String, Object> slim, Object description) {
    if (description instanceof String text && !text.isEmpty()) {
      slim.put("description", text);
    }
  }

  private static void applySqlQuery(Map<String, Object> slim, Object sqlQuery) {
    if (sqlQuery instanceof String sql && !sql.isEmpty()) {
      slim.put("sqlQuery", sql);
    }
  }

  private static final Set<String> NODE_BULK_FIELDS =
      Set.of("aiContext", "columnNames", "columns", "schemaDefinition", "sampleData", "profile");

  private static final String UPSTREAM_ANALYSIS = "upstreamAnalysis";
  private static final String ROOT_HAS_FAILING_TESTS = "rootHasFailingTests";
  private static final String DOWNSTREAM_ANALYSIS = "downstreamAnalysis";
  private static final String UPSTREAM_EDGES = "failingUpstreamEdges";
  private static final String DOWNSTREAM_EDGES = "downstreamEdges";

  /**
   * Keeps RCA under the dispatch cap by returning fewer <em>edges</em> (the SQL-bearing, heaviest
   * part) in each direction, never by cutting an edge's SQL or dropping the whole analysis to a bare
   * hint. Nodes, counts and summary are preserved, and a per-direction "...Returned" marker records
   * how many edges were withheld. Only when the non-edge content alone already exceeds the budget
   * does it fall back to the minimal identity hint.
   */
  @VisibleForTesting
  static Map<String, Object> enforceSizeBudget(Map<String, Object> result) {
    Map<String, Object> output = result;
    if (McpResponseTrim.serializedLength(result) > McpResponseTrim.MAX_RESPONSE_CHARS) {
      output = fitAnalysisToBudget(result);
    }
    return output;
  }

  private static Map<String, Object> fitAnalysisToBudget(Map<String, Object> result) {
    Map<String, Object> upstream = mapAt(result, UPSTREAM_ANALYSIS);
    Map<String, Object> downstream = mapAt(result, DOWNSTREAM_ANALYSIS);
    long available =
        ResponseBudget.defaultBudgetChars() - edgeFreeOverhead(result, upstream, downstream);
    Map<String, Object> output;
    if (available <= 0) {
      output = oversizedHint(result);
    } else {
      fitEdgeLists(upstream, downstream, available);
      result.put("truncated", Boolean.TRUE);
      output = result;
    }
    return output;
  }

  /**
   * Splits the budget across the two directions and, mirroring {@link GetLineageTool}, reclaims the
   * other direction's unused budget so an asymmetric analysis (RCA commonly has only upstream
   * failing edges) can use the whole budget instead of being capped at half.
   */
  private static void fitEdgeLists(
      Map<String, Object> upstream, Map<String, Object> downstream, long available) {
    List<?> upEdges = edgeValues(upstream, UPSTREAM_EDGES);
    List<?> downEdges = edgeValues(downstream, DOWNSTREAM_EDGES);
    long half = available / 2;
    ResponseBudget.Fit up = ResponseBudget.fitWithin(upEdges, half);
    ResponseBudget.Fit down = ResponseBudget.fitWithin(downEdges, available - up.usedChars());
    boolean downstreamLeftRoom = down.usedChars() < half && up.count() < upEdges.size();
    if (downstreamLeftRoom) {
      up = ResponseBudget.fitWithin(upEdges, available - down.usedChars());
    }
    trimEdges(upstream, UPSTREAM_EDGES, up.count());
    trimEdges(downstream, DOWNSTREAM_EDGES, down.count());
  }

  /** Serialized size of the result with both edge collections detached, i.e. the non-edge cost. */
  private static long edgeFreeOverhead(
      Map<String, Object> result, Map<String, Object> upstream, Map<String, Object> downstream) {
    Object up = detachEdges(upstream, UPSTREAM_EDGES);
    Object down = detachEdges(downstream, DOWNSTREAM_EDGES);
    long overhead = McpResponseTrim.serializedLength(result);
    reattachEdges(upstream, UPSTREAM_EDGES, up);
    reattachEdges(downstream, DOWNSTREAM_EDGES, down);
    return overhead;
  }

  private static Map<String, Object> mapAt(Map<String, Object> map, String key) {
    return map.get(key) instanceof Map ? castMap(map.get(key)) : null;
  }

  /**
   * Edges are a {@code List} on the upstream side ({@link #slimEdges}) but a {@code Map} keyed by
   * entity id on the downstream side ({@link #slimEdgeMap}). Both shapes are reduced to a list of
   * edge values so {@link ResponseBudget} can measure and count them uniformly.
   */
  private static List<?> edgeValues(Map<String, Object> analysis, String key) {
    Object edges = analysis == null ? null : analysis.get(key);
    List<?> values = List.of();
    if (edges instanceof List<?> list) {
      values = list;
    } else if (edges instanceof Map<?, ?> map) {
      values = new ArrayList<>(map.values());
    }
    return values;
  }

  private static Object detachEdges(Map<String, Object> analysis, String key) {
    Object edges = null;
    if (analysis != null
        && (analysis.get(key) instanceof List || analysis.get(key) instanceof Map)) {
      edges = analysis.remove(key);
    }
    return edges;
  }

  private static void reattachEdges(Map<String, Object> analysis, String key, Object edges) {
    if (edges != null) {
      analysis.put(key, edges);
    }
  }

  private static void trimEdges(Map<String, Object> analysis, String key, int count) {
    if (analysis != null) {
      Object edges = analysis.get(key);
      if (edges instanceof List<?> list && count < list.size()) {
        analysis.put(key, new ArrayList<>(list.subList(0, count)));
        analysis.put(key + "Returned", count);
      } else if (edges instanceof Map<?, ?> map && count < map.size()) {
        analysis.put(key, firstEntries(map, count));
        analysis.put(key + "Returned", count);
      }
    }
  }

  private static Map<String, Object> firstEntries(Map<?, ?> map, int count) {
    Map<String, Object> kept = new LinkedHashMap<>();
    int index = 0;
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      if (index >= count) {
        break;
      }
      kept.put(String.valueOf(entry.getKey()), entry.getValue());
      index++;
    }
    return kept;
  }

  private static Map<String, Object> oversizedHint(Map<String, Object> result) {
    Map<String, Object> hint = new LinkedHashMap<>();
    putIfPresent(hint, "fqn", result.get("fqn"));
    putIfPresent(hint, "upstreamDepth", result.get("upstreamDepth"));
    putIfPresent(hint, "downstreamDepth", result.get("downstreamDepth"));
    putIfPresent(hint, "status", result.get("status"));
    putIfPresent(hint, "summary", result.get("summary"));
    hint.put("truncated", Boolean.TRUE);
    hint.put(
        "message",
        "Root cause analysis result exceeds the size budget. Reduce upstreamDepth/downstreamDepth, "
            + "or leave includeColumnLineage off, to get a smaller response.");
    return hint;
  }

  /**
   * Failing tests for one node's suite, and - when it could not answer - why.
   *
   * <p>An empty map used to mean three different things: no suite attached, the backend threw, or no
   * failing tests. Next to a {@code status: "failed"} verdict those are opposite meanings.
   */
  private Map<String, Object> addTestCaseResultForTestSuite(Map<String, Object> node) {
    Map<String, Object> testCaseResult = new HashMap<>();
    Map<String, Object> testSuiteMap = JsonUtils.getMap(node.get("testSuite"));
    String testSuiteId = testSuiteMap == null ? null : (String) testSuiteMap.get("id");
    if (testSuiteId == null) {
      testCaseResult.put(
          "note", "No test suite is attached to this asset, so no test results could be read.");
    } else {
      readFailingTests(testSuiteId, testCaseResult);
    }
    return testCaseResult;
  }

  private void readFailingTests(String testSuiteId, Map<String, Object> testCaseResult) {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("testCaseStatus", "Failed");
    searchListFilter.addQueryParam("testSuiteId", testSuiteId);
    TestCaseResultRepository testResultTimeSeriesRepository =
        (TestCaseResultRepository) Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT);
    try {
      ResultList<TestCaseResult> testCaseResults =
          testResultTimeSeriesRepository.listLatestFromSearch(
              testResultTimeSeriesRepository.getFields("testCaseStatus,result,testResultValue"),
              searchListFilter,
              "testCaseFQN.keyword",
              null,
              null,
              null,
              null,
              null);
      if (testCaseResults.getData() != null && !testCaseResults.getData().isEmpty()) {
        testCaseResult.put("testCaseResults", testCaseResults.getData());
        testCaseResult.put("testSuiteId", testSuiteId);
      } else {
        LOG.info("No failed test case results found for test suite: {}", testSuiteId);
      }
    } catch (IOException e) {
      LOG.error("Failed to fetch test case results for test suite: {}", testSuiteId, e);
      testCaseResult.put(
          "unavailable",
          "The test-result backend could not be reached, so which tests are failing here is"
              + " unknown. This is not the same as none failing.");
    }
  }

  /**
   * States how many tests are failing and whether that is all of them.
   *
   * <p>{@code complete} was hardcoded true, which the lookup cannot back: it passes no limit, so
   * {@code EntityTimeSeriesRepository} caps the aggregation at {@link #RESULT_BUCKET_CAP} buckets
   * and a bigger suite is silently truncated. Landing exactly on the cap is the one case where
   * completeness is unknowable, so say so.
   */
  @VisibleForTesting
  static void annotateCompleteness(Map<String, Object> tests, int failingCount) {
    boolean atCap = failingCount >= RESULT_BUCKET_CAP;
    tests.put("failingTestCount", failingCount);
    tests.put("complete", !atCap);
    if (atCap) {
      tests.put(
          "completeNote",
          String.format(
              "The test-result lookup returns at most %d tests, and that many came back, so more may"
                  + " be failing. Use search_metadata with entityType='testCase' and a filter on"
                  + " originEntityFQN for the full set.",
              RESULT_BUCKET_CAP));
    }
  }

  private static int clampDepth(int depth) {
    return Math.min(Math.max(depth, 1), MAX_DEPTH);
  }

  private static Set<?> asSet(Object value) {
    return value instanceof Set<?> set ? set : Collections.emptySet();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Object value) {
    return (Map<String, Object>) value;
  }

  private static void putIfPresent(Map<String, Object> map, String key, Object value) {
    if (value != null) {
      map.put(key, value);
    }
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "RootCauseAnalysisTool does not require limit validation.");
  }
}
