package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.CalendarInterval;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

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

    Map<String, Aggregation> subAggregations = new HashMap<>();
    populateDateHistogram(
        summaryCard.getMetrics().getFirst().getFunction(),
        summaryCard.getMetrics().getFirst().getFormula(),
        summaryCard.getMetrics().getFirst().getField(),
        summaryCard.getMetrics().getFirst().getFilter(),
        subAggregations,
        "1",
        formulas);

    Aggregation dateHistogramAgg =
        Aggregation.of(
            a ->
                a.dateHistogram(
                        dh ->
                            dh.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                                .calendarInterval(CalendarInterval.Day))
                    .aggregations(subAggregations));

    Map<String, Aggregation> aggregationsMap = new HashMap<>();
    aggregationsMap.put("1", dateHistogramAgg);

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder().size(0);

    if (!live) {
      Query rangeQuery =
          Query.of(
              q ->
                  q.range(
                      r ->
                          r.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                              .gte(JsonData.of(start))
                              .lte(JsonData.of(end))));
      searchRequestBuilder.query(rangeQuery);
      searchRequestBuilder.index(DataInsightSystemChartRepository.getDataInsightsSearchIndex());
    } else {
      searchRequestBuilder.index(DataInsightSystemChartRepository.getLiveSearchIndex(null));
    }

    searchRequestBuilder.aggregations(aggregationsMap);
    return searchRequestBuilder.build();
  }

  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricHolder) {
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    Map<String, Aggregate> aggregationMap =
        searchResponse.aggregations() != null ? searchResponse.aggregations() : new HashMap<>();

    String formula = summaryCard.getMetrics().getFirst().getFormula();
    // If formulas list is empty and formula is not null, populate it
    if ((formulas == null || formulas.isEmpty()) && formula != null) {
      formulas = OpenSearchDynamicChartAggregatorInterface.getFormulaList(formula);
    }

    List<DataInsightCustomChartResult> results =
        processAggregations(aggregationMap, formula, null, formulas, null);

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
