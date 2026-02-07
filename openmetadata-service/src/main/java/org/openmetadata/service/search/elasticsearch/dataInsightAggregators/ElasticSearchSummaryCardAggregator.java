package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
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

public class ElasticSearchSummaryCardAggregator
    implements ElasticSearchDynamicChartAggregatorInterface {

  private static final String AGG_NAME = "1";

  @Override
  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricFormulaMap,
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
        AGG_NAME,
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
    aggregationsMap.put(AGG_NAME, dateHistogramAgg);

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder().size(0);

    if (!live) {
      Query rangeQuery =
          Query.of(
              q ->
                  q.range(
                      r ->
                          r.untyped(
                              u ->
                                  u.field("@timestamp")
                                      .gte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(start)))
                                      .lte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(end))))));
      searchRequestBuilder.query(rangeQuery);
      searchRequestBuilder.index(DataInsightSystemChartRepository.getDataInsightsSearchIndex());
    } else {
      searchRequestBuilder.index(DataInsightSystemChartRepository.getLiveSearchIndex(null));
    }

    searchRequestBuilder.aggregations(aggregationsMap);
    return searchRequestBuilder.build();
  }

  @Override
  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricFormulaMap) {
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    Map<String, Aggregate> aggregationMap =
        searchResponse.aggregations() != null ? searchResponse.aggregations() : new HashMap<>();

    String formula = summaryCard.getMetrics().getFirst().getFormula();
    // If formulas list is empty and formula is not null, populate it
    if ((formulas == null || formulas.isEmpty()) && formula != null) {
      formulas = ElasticSearchDynamicChartAggregatorInterface.getFormulaList(formula);
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
