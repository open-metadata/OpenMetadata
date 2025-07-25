package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.RangeQueryBuilder;
import es.org.elasticsearch.search.aggregations.AbstractAggregationBuilder;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.aggregations.bucket.terms.IncludeExclude;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;

public class ElasticSearchLineChartAggregator
    implements ElasticSearchDynamicChartAggregatorInterface {

  public static class MetricFormulaHolder {
    String formula;
    List<FormulaHolder> holders;

    MetricFormulaHolder() {}

    public MetricFormulaHolder(String formula, List<FormulaHolder> holders) {
      this.holders = holders;
      this.formula = formula;
    }
  }

  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder,
      boolean live)
      throws IOException {
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    AbstractAggregationBuilder aggregationBuilder;
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    int i = 0;
    for (LineChartMetric metric : lineChart.getMetrics()) {
      String metricName = metric.getName() == null ? "metric_" + ++i : metric.getName();
      if (lineChart.getxAxisField() != null
          && !lineChart.getxAxisField().equals(DataInsightSystemChartRepository.TIMESTAMP_FIELD)) {
        IncludeExclude includeExclude = null;
        if (!CommonUtil.nullOrEmpty(lineChart.getIncludeXAxisFiled())
            || !CommonUtil.nullOrEmpty(lineChart.getExcludeXAxisField())) {
          includeExclude =
              new IncludeExclude(
                  lineChart.getIncludeXAxisFiled(), lineChart.getExcludeXAxisField());
        }
        aggregationBuilder =
            AggregationBuilders.terms(metricName)
                .field(lineChart.getxAxisField())
                .includeExclude(includeExclude)
                .size(1000);

        // in case of horizontal axis only process data of 24 hr prior to end time
        start = end - MILLISECONDS_IN_DAY;

      } else {
        aggregationBuilder =
            AggregationBuilders.dateHistogram(metricName)
                .field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                .calendarInterval(DateHistogramInterval.DAY);
      }

      metricFormulaHolder.put(
          metricName,
          new MetricFormulaHolder(
              metric.getFormula(),
              ElasticSearchDynamicChartAggregatorInterface.getFormulaList(metric.getFormula())));

      populateDateHistogram(
          metric.getFunction(),
          metric.getFormula(),
          metric.getField(),
          metric.getFilter(),
          aggregationBuilder,
          formulas);

      if (lineChart.getGroupBy() != null) {
        String[] includeArr = null;
        String[] excludeArr = null;
        if (!CommonUtil.nullOrEmpty(lineChart.getIncludeGroups())) {
          includeArr = lineChart.getIncludeGroups().toArray(new String[0]);
        }
        if (!CommonUtil.nullOrEmpty(lineChart.getExcludeGroups())) {
          excludeArr = lineChart.getExcludeGroups().toArray(new String[0]);
        }
        TermsAggregationBuilder termsAggregationBuilder =
            AggregationBuilders.terms("term_" + i).field(lineChart.getGroupBy()).size(1000);
        termsAggregationBuilder.subAggregation(aggregationBuilder);
        if (includeArr != null || excludeArr != null) {
          IncludeExclude includeExclude = new IncludeExclude(includeArr, excludeArr);
          termsAggregationBuilder.includeExclude(includeExclude);
        }
        searchSourceBuilder.size(0);
        searchSourceBuilder.aggregation(termsAggregationBuilder);
      } else {
        searchSourceBuilder.aggregation(aggregationBuilder);
      }
    }
    es.org.elasticsearch.action.search.SearchRequest searchRequest;
    if (!live) {
      QueryBuilder queryFilter =
          new RangeQueryBuilder(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
              .gte(start)
              .lte(end);
      searchSourceBuilder.query(queryFilter);
      searchRequest =
          new es.org.elasticsearch.action.search.SearchRequest(
              DataInsightSystemChartRepository.getDataInsightsSearchIndex());
    } else {
      searchRequest =
          new es.org.elasticsearch.action.search.SearchRequest(
              DataInsightSystemChartRepository.getLiveSearchIndex());
    }
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private String getMetricName(LineChart lineChart, String name) {
    if (lineChart.getMetrics().size() == 1) {
      return null;
    }
    return name;
  }

  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse searchResponse,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder) {
    Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolderInternal =
        metricFormulaHolder;
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    List<Aggregation> aggregationList =
        Optional.ofNullable(searchResponse.getAggregations())
            .orElse(new Aggregations(new ArrayList<>()))
            .asList();
    if (lineChart.getGroupBy() != null) {
      List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();
      for (Aggregation arg : aggregationList) {
        ParsedTerms parsedTerms = (ParsedTerms) arg;
        for (Terms.Bucket bucket : parsedTerms.getBuckets()) {
          for (Aggregation subArg : bucket.getAggregations()) {
            String group;
            if (lineChart.getMetrics().size() > 1) {
              group = bucket.getKeyAsString() + " - " + getMetricName(lineChart, subArg.getName());
            } else {
              group = bucket.getKeyAsString();
            }
            diChartResults.addAll(
                processAggregations(
                    List.of(subArg),
                    metricFormulaHolderInternal.get(subArg.getName()).formula,
                    group,
                    metricFormulaHolderInternal.get(subArg.getName()).holders,
                    getMetricName(lineChart, subArg.getName())));
          }
        }
      }
      resultList.setResults(diChartResults);
      return resultList;
    }
    List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();

    for (int i = 0; i < lineChart.getMetrics().size(); i++) {
      MetricFormulaHolder formulaHolder =
          metricFormulaHolder.get(aggregationList.get(i).getName()) == null
              ? new MetricFormulaHolder()
              : metricFormulaHolderInternal.get(aggregationList.get(i).getName());
      String group = null;
      if (lineChart.getMetrics().size() > 1) {
        group = getMetricName(lineChart, aggregationList.get(i).getName());
      }
      List<DataInsightCustomChartResult> results =
          processAggregations(
              List.of(aggregationList.get(i)),
              formulaHolder.formula,
              group,
              formulaHolder.holders,
              getMetricName(lineChart, aggregationList.get(i).getName()));
      diChartResults.addAll(results);
    }
    resultList.setResults(diChartResults);
    if (lineChart.getKpiDetails() != null) {
      resultList.setKpiDetails(lineChart.getKpiDetails());
    }
    return resultList;
  }
}
