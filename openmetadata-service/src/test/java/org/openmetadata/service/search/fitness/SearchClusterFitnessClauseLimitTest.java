package org.openmetadata.service.search.fitness;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchRepository;

class SearchClusterFitnessClauseLimitTest {

  @Test
  void warnsWhenOpenSearchRunsBelowTheDefaultLimit() throws Exception {
    FitnessSignal signal = check("opensearch", "3.4.0", 512).getFirst();
    assertEquals("search.max_clause_count", signal.getName());
    assertEquals(FitnessSeverity.WARN, signal.getSeverity());
    assertNotNull(signal.getRecommendation());
  }

  @Test
  void passesAtTheDefaultLimit() throws Exception {
    assertEquals(FitnessSeverity.PASS, check("opensearch", "3.4.0", 1024).getFirst().getSeverity());
  }

  @Test
  void checksElasticsearchSevenButNotEight() throws Exception {
    assertEquals(
        FitnessSeverity.WARN, check("elasticsearch", "7.17.9", 512).getFirst().getSeverity());
    assertTrue(check("elasticsearch", "9.3.0", 512).isEmpty());
  }

  private static List<FitnessSignal> check(String distribution, String version, int limit)
      throws Exception {
    SearchClusterFitnessReport report =
        SearchClusterFitnessReport.builder()
            .signals(new ArrayList<>())
            .inaccessibleMetrics(new ArrayList<>())
            .build();
    report.setSearchDistribution(distribution);
    report.setSearchVersion(version);
    JsonNode settings =
        JsonUtils.readTree(
            "{\"defaults\":{\"indices\":{\"query\":{\"bool\":{\"max_clause_count\":\""
                + limit
                + "\"}}}}}");
    Method method =
        SearchClusterFitnessAnalyzer.class.getDeclaredMethod(
            "checkMaxClauseCount", List.class, SearchClusterFitnessReport.class, JsonNode.class);
    method.setAccessible(true);
    method.invoke(
        new SearchClusterFitnessAnalyzer(mock(SearchRepository.class)),
        report.getSignals(),
        report,
        settings);
    return report.getSignals();
  }
}
