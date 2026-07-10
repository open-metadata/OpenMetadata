package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.opensearch.core.SearchRequest;

class OpenSearchLineChartAggregatorTest {

  private static final String X_AXIS_FIELD = "service.name.keyword";
  private static final long END_TIME = 24L * 60 * 60 * 1000;

  private final OpenSearchLineChartAggregator aggregator = new OpenSearchLineChartAggregator();

  @BeforeEach
  void setUp() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    lenient().when(searchRepository.getClusterAlias()).thenReturn(null);
    Entity.setSearchRepository(searchRepository);
  }

  @Test
  void nullFunctionAndFormulaMetricThrows() {
    DataInsightCustomChart chart = incompleteMetricChart();

    assertThrows(IllegalArgumentException.class, () -> prepare(chart));
  }

  private SearchRequest prepare(DataInsightCustomChart chart) {
    return aggregator.prepareSearchRequest(
        chart, 0L, END_TIME, new ArrayList<>(), new HashMap<>(), true);
  }

  private static DataInsightCustomChart incompleteMetricChart() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withField("id.keyword")))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart()
        .withName("incomplete_metric_chart")
        .withChartDetails(lineChart);
  }
}
