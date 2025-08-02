package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import os.org.opensearch.action.search.SearchRequest;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.RangeQueryBuilder;
import os.org.opensearch.search.aggregations.Aggregation;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import os.org.opensearch.search.builder.SearchSourceBuilder;

public class OpenSearchSummaryCardAggregator implements OpenSearchDynamicChartAggregatorInterface {
  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricHolder,
      boolean live)
      throws IOException {

    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram("1")
            .field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
            .calendarInterval(DateHistogramInterval.DAY);
    populateDateHistogram(
        summaryCard.getMetrics().get(0).getFunction(),
        summaryCard.getMetrics().get(0).getFormula(),
        summaryCard.getMetrics().get(0).getField(),
        summaryCard.getMetrics().get(0).getFilter(),
        dateHistogramAggregationBuilder,
        formulas);

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.aggregation(dateHistogramAggregationBuilder);
    searchSourceBuilder.size(0);

    os.org.opensearch.action.search.SearchRequest searchRequest;
    if (!live) {
      QueryBuilder queryFilter = new RangeQueryBuilder("@timestamp").gte(start).lte(end);
      searchSourceBuilder.query(queryFilter);
      searchRequest =
          new os.org.opensearch.action.search.SearchRequest(
              DataInsightSystemChartRepository.getDataInsightsSearchIndex());
    } else {
      searchRequest =
          new os.org.opensearch.action.search.SearchRequest(
              DataInsightSystemChartRepository.getLiveSearchIndex(null));
    }
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse searchResponse,
      List<FormulaHolder> formulas,
      Map metricHolder) {
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    List<Aggregation> aggregationList =
        Optional.ofNullable(searchResponse.getAggregations())
            .orElse(new Aggregations(new ArrayList<>()))
            .asList();
    List<DataInsightCustomChartResult> results =
        processAggregations(
            aggregationList, summaryCard.getMetrics().get(0).getFormula(), null, formulas, null);

    List<DataInsightCustomChartResult> finalResults = new ArrayList<>();
    for (int i = results.size() - 1; i >= 0; i--) {
      if (results.get(i).getCount() != null) {
        finalResults.add(results.get(i));
        resultList.setResults(finalResults);
        return resultList;
      }
    }

    resultList.setResults(results);
    return resultList;
  }
}
