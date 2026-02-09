package org.openmetadata.mcp.tools;

import static org.openmetadata.mcp.tools.SearchMetadataTool.cleanSearchResponseObject;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class RootCauseAnalysisTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> parameters) {
    String fqn = (String) parameters.get("fqn");
    String entityType = (String) parameters.getOrDefault("entityType", "table");
    Integer upstreamDepth = (Integer) parameters.getOrDefault("upstreamDepth", 3);
    Integer downstreamDepth = (Integer) parameters.getOrDefault("downstreamDepth", 3);
    String queryFilter = (String) parameters.get("queryFilter");
    Boolean includeDeleted = (Boolean) parameters.getOrDefault("includeDeleted", false);

    if (fqn == null || fqn.trim().isEmpty()) {
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Parameter 'fqn' is required and cannot be empty");
      return errorResponse;
    }

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

      if (upstreamEntity instanceof Map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> upstreamLineageData = (Map<String, Object>) upstreamEntity;

        Set<?> upstreamEdgesList = (Set<?>) upstreamLineageData.get("edges");
        Set<?> upstreamNodesList = (Set<?>) upstreamLineageData.get("nodes");
        List<Map<String, Object>> upstreamNodes =
            upstreamNodesList.stream()
                .map(node -> cleanSearchResponseObject((Map<String, Object>) node))
                .toList();

        upstreamAnalysis.put("failingUpstreamNodesCount", upstreamNodes.size());
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

      result.put(
          "summary",
          String.format(
              "Analyzed upstream causes and downstream impacts for '%s'. Found %s upstream failures.",
              fqn, hasFailures ? "" : "no"));

      LOG.info(
          "Comprehensive root cause analysis completed for entity: {} - Upstream failures: {}",
          fqn,
          hasFailures);

      return result;

    } catch (IOException e) {
      LOG.error("IOException during root cause analysis for entity: {}", fqn, e);
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Failed to perform root cause analysis");
      errorResponse.put("message", e.getMessage());
      errorResponse.put("fqn", fqn);
      return errorResponse;

    } catch (Exception e) {
      LOG.error("Unexpected error during root cause analysis for entity: {}", fqn, e);
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Unexpected error during root cause analysis");
      errorResponse.put("message", e.getMessage());
      errorResponse.put("fqn", fqn);
      return errorResponse;
    }
  }

  private Map<String, Object> addTestCaseResultForTestSuite(Map<String, Object> node) {
    Map<String, Object> testCaseResult = new HashMap<>();
    String testSuiteId = (String) JsonUtils.getMap(node.get("testSuite")).get("id");
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
