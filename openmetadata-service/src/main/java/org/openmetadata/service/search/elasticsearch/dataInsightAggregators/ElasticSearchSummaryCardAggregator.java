package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.RangeQueryBuilder;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.util.JsonUtils;

public class ElasticSearchSummaryCardAggregator
    implements ElasticSearchDynamicChartAggregatorInterface {

  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart, long start, long end, List<FormulaHolder> formulas)
      throws IOException {

    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram("1")
            .field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
            .calendarInterval(DateHistogramInterval.DAY);
    populateDateHistogram(
        summaryCard.getFunction(),
        summaryCard.getFormula(),
        summaryCard.getField(),
        summaryCard.getFilter(),
        dateHistogramAggregationBuilder,
        formulas);

    Timestamp endTimeStamp = new Timestamp(end + MILLISECONDS_IN_DAY);
    Timestamp startTimeStamp = new Timestamp(end - MILLISECONDS_IN_DAY);

    QueryBuilder queryFilter =
        new RangeQueryBuilder("@timestamp")
            .gte(startTimeStamp.toLocalDateTime().toString() + "Z")
            .lte(endTimeStamp.toLocalDateTime().toString() + "Z");

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.aggregation(dateHistogramAggregationBuilder);
    searchSourceBuilder.query(queryFilter);
    searchSourceBuilder.size(0);
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            DataInsightSystemChartRepository.DI_SEARCH_INDEX);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse searchResponse,
      List<FormulaHolder> formulas) {
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    SummaryCard summaryCard = JsonUtils.convertValue(diChart.getChartDetails(), SummaryCard.class);
    List<Aggregation> aggregationList =
        Optional.ofNullable(searchResponse.getAggregations())
            .orElse(new Aggregations(new ArrayList<>()))
            .asList();
    List<DataInsightCustomChartResult> results =
        processAggregations(aggregationList, summaryCard.getFormula(), null, formulas);

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
