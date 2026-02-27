package org.openmetadata.mcp.tools;

import static org.openmetadata.mcp.tools.SearchMetadataTool.cleanSearchResponseObject;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
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

@Slf4j
public class RootCauseAnalysisTool implements McpTool {

  private static final int MAX_DEPTH = 10;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> parameters) {
    String fqn = (String) parameters.get("fqn");
    String entityType = (String) parameters.getOrDefault("entityType", "table");
    int upstreamDepth =
        Math.min(Math.max(parseIntParam(parameters.get("upstreamDepth"), 3), 1), MAX_DEPTH);
    int downstreamDepth =
        Math.min(Math.max(parseIntParam(parameters.get("downstreamDepth"), 3), 1), MAX_DEPTH);
    String queryFilter = (String) parameters.get("queryFilter");
    boolean includeDeleted = parseBooleanParam(parameters.get("includeDeleted"), false);

    if (fqn == null || fqn.trim().isEmpty()) {
      throw new IllegalArgumentException("Parameter 'fqn' is required and cannot be empty");
    }

    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType));

    try {
      Map<String, Object> result = new HashMap<>();
      result.put("fqn", fqn);
      result.put("upstreamDepth", upstreamDepth);
      result.put("downstreamDepth", downstreamDepth);

      Response upstreamResponse =
          Entity.getSearchRepository()
              .searchDataQualityLineage(fqn.trim(), upstreamDepth, queryFilter, includeDeleted);

      Object upstreamEntity = upstreamResponse.getEntity();
      Map<String, Object> upstreamAnalysis = new HashMap<>();
      boolean hasFailures = false;
      int failureCount = 0;

      if (upstreamEntity instanceof Map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> upstreamLineageData = (Map<String, Object>) upstreamEntity;

        Set<?> upstreamEdgesList =
            upstreamLineageData.get("edges") instanceof Set<?> s ? s : Collections.emptySet();
        Set<?> upstreamNodesList =
            upstreamLineageData.get("nodes") instanceof Set<?> s ? s : Collections.emptySet();
        List<Map<String, Object>> upstreamNodes =
            upstreamNodesList.stream()
                .filter(node -> node instanceof Map)
                .map(node -> cleanSearchResponseObject((Map<String, Object>) node))
                .toList();

        failureCount = upstreamNodes.size();
        upstreamAnalysis.put("failingUpstreamNodesCount", failureCount);
        hasFailures = !upstreamNodes.isEmpty();
        if (!upstreamNodes.isEmpty()) {
          upstreamAnalysis.put("failingUpstreamNodes", upstreamNodes);
          upstreamNodes.forEach(
              node -> node.put("failingTestCases", addTestCaseResultForTestSuite(node)));
        }

        upstreamAnalysis.put("failingUpstreamEdgesCount", upstreamEdgesList.size());
        upstreamAnalysis.put("failingUpstreamEdges", upstreamEdgesList);
        upstreamAnalysis.put(
            "description", "Upstream entities that may be causing data quality failures");
      }
      result.put("upstreamAnalysis", upstreamAnalysis);

      Map<String, Object> downstreamAnalysis = new HashMap<>();
      if (hasFailures) {
        try {
          SearchLineageRequest downstreamRequest =
              new SearchLineageRequest()
                  .withFqn(fqn.trim())
                  .withDirection(LineageDirection.DOWNSTREAM)
                  .withUpstreamDepth(0)
                  .withDownstreamDepth(downstreamDepth)
                  .withQueryFilter(queryFilter)
                  .withIsConnectedVia(isConnectedVia(entityType))
                  .withIncludeDeleted(includeDeleted);

          SearchLineageResult downstreamResult =
              Entity.getSearchRepository().searchLineageWithDirection(downstreamRequest);

          downstreamAnalysis.put(
              "description", "Downstream entities that may be impacted by the identified failures");

          if (downstreamResult.getNodes() != null) {
            downstreamAnalysis.put(
                "downstreamImpactedNodesCount", downstreamResult.getNodes().size());
            downstreamAnalysis.put("downstreamNodes", downstreamResult.getNodes());
          }

          if (downstreamResult.getDownstreamEdges() != null) {
            downstreamAnalysis.put(
                "downstreamImpactedEdgesCount", downstreamResult.getDownstreamEdges().size());
            downstreamAnalysis.put("downstreamEdges", downstreamResult.getDownstreamEdges());
          }

          LOG.info(
              "Downstream impact analysis completed for entity: {} with {} downstream depth, found {} nodes and {} edges",
              fqn,
              downstreamDepth,
              downstreamResult.getNodes() != null ? downstreamResult.getNodes().size() : 0,
              downstreamResult.getDownstreamEdges() != null
                  ? downstreamResult.getDownstreamEdges().size()
                  : 0);

        } catch (Exception e) {
          LOG.warn("Failed to perform downstream impact analysis for entity: {}", fqn, e);
          downstreamAnalysis.put("error", "Failed to analyze downstream impact: " + e.getMessage());
        }
      } else {
        downstreamAnalysis.put(
            "reason",
            "No failures found in upstream analysis, downstream impact analysis not needed");
      }

      result.put("downstreamAnalysis", downstreamAnalysis);

      result.put("status", hasFailures ? "failed" : "success");
      result.put(
          "summary",
          String.format(
              "Analyzed upstream causes and downstream impacts for '%s'. Found %d upstream failure(s).",
              fqn, failureCount));

      LOG.info(
          "Comprehensive root cause analysis completed for entity: {} - Upstream failures: {}",
          fqn,
          hasFailures);

      return result;

    } catch (IOException e) {
      LOG.error("IOException during root cause analysis for entity: {}", fqn, e);
      throw new RuntimeException("Failed to perform root cause analysis: " + e.getMessage(), e);

    } catch (Exception e) {
      LOG.error("Unexpected error during root cause analysis for entity: {}", fqn, e);
      throw new RuntimeException(
          "Unexpected error during root cause analysis: " + e.getMessage(), e);
    }
  }

  private Map<String, Object> addTestCaseResultForTestSuite(Map<String, Object> node) {
    Map<String, Object> testCaseResult = new HashMap<>();
    Map<String, Object> testSuiteMap = JsonUtils.getMap(node.get("testSuite"));
    if (testSuiteMap == null || testSuiteMap.get("id") == null) {
      return testCaseResult;
    }
    String testSuiteId = (String) testSuiteMap.get("id");
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
    }
    return testCaseResult;
  }

  private static int parseIntParam(Object value, int defaultValue) {
    if (value == null) {
      return defaultValue;
    }
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value instanceof String string) {
      try {
        return Integer.parseInt(string);
      } catch (NumberFormatException e) {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  private static boolean parseBooleanParam(Object value, boolean defaultValue) {
    if (value == null) {
      return defaultValue;
    }
    if (value instanceof Boolean b) {
      return b;
    }
    if (value instanceof String s) {
      return "true".equalsIgnoreCase(s);
    }
    return defaultValue;
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
