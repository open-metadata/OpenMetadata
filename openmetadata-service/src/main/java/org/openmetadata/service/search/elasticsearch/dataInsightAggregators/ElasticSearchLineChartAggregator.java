package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.RangeQueryBuilder;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.util.JsonUtils;

public class ElasticSearchLineChartAggregator
    implements ElasticSearchDynamicChartAggregatorInterface {
  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart, long start, long end, List<FormulaHolder> formulas)
      throws IOException {
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram("1")
            .field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
            .calendarInterval(DateHistogramInterval.DAY);
    populateDateHistogram(
        lineChart.getFunction(),
        lineChart.getFormula(),
        lineChart.getField(),
        lineChart.getFilter(),
        dateHistogramAggregationBuilder,
        formulas);

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();

    Timestamp endTimeStamp = new Timestamp(end + MILLISECONDS_IN_DAY);
    Timestamp startTimeStamp = new Timestamp(start);

    QueryBuilder queryFilter =
        new RangeQueryBuilder("@timestamp")
            .gte(startTimeStamp.toLocalDateTime().toString() + "Z")
            .lte(endTimeStamp.toLocalDateTime().toString() + "Z");

    if (lineChart.getGroupBy() != null) {
      TermsAggregationBuilder termsAggregationBuilder =
          AggregationBuilders.terms("0").field(lineChart.getGroupBy());
      termsAggregationBuilder.subAggregation(dateHistogramAggregationBuilder);
      searchSourceBuilder.size(0);
      searchSourceBuilder.aggregation(termsAggregationBuilder);
    } else {
      searchSourceBuilder.aggregation(dateHistogramAggregationBuilder);
    }
    searchSourceBuilder.query(queryFilter);
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
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    if (lineChart.getGroupBy() != null) {
      List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();
      for (Aggregation arg : searchResponse.getAggregations().asList()) {
        ParsedTerms parsedTerms = (ParsedTerms) arg;
        for (Terms.Bucket bucket : parsedTerms.getBuckets()) {
          diChartResults.addAll(
              processAggregations(
                  bucket.getAggregations().asList(),
                  lineChart.getFormula(),
                  bucket.getKeyAsString(),
                  formulas));
        }
      }
      resultList.setResults(diChartResults);
      return resultList;
    }
    List<DataInsightCustomChartResult> results =
        processAggregations(
            searchResponse.getAggregations().asList(), lineChart.getFormula(), null, formulas);
    resultList.setResults(results);
    if (lineChart.getKpiDetails() != null) {
      resultList.setKpiDetails(lineChart.getKpiDetails());
    }
    return resultList;
  }
}
