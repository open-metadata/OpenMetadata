package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
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

  @Override
  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder,
      boolean live)
      throws IOException {
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    Map<String, Aggregation> aggregationsMap = new HashMap<>();
    int i = 0;
    long startTime = start;

    for (LineChartMetric metric : lineChart.getMetrics()) {
      String metricName = metric.getName() == null ? "metric_" + ++i : metric.getName();
      Map<String, Aggregation> metricAggregations = new HashMap<>();

      if (lineChart.getxAxisField() != null
          && !lineChart.getxAxisField().equals(DataInsightSystemChartRepository.TIMESTAMP_FIELD)) {
        String includeTerms = null;
        String excludeTerms = null;
        if (!CommonUtil.nullOrEmpty(lineChart.getIncludeXAxisFiled())) {
          includeTerms = lineChart.getIncludeXAxisFiled();
        }
        if (!CommonUtil.nullOrEmpty(lineChart.getExcludeXAxisField())) {
          excludeTerms = lineChart.getExcludeXAxisField();
        }

        final String finalIncludeTerms = includeTerms;
        final String finalExcludeTerms = excludeTerms;

        Aggregation termsAgg =
            Aggregation.of(
                a -> {
                  var tb = a.terms(t -> t.field(lineChart.getxAxisField()).size(1000));
                  if (finalIncludeTerms != null) {
                    tb =
                        a.terms(
                            t ->
                                t.field(lineChart.getxAxisField())
                                    .size(1000)
                                    .include(inc -> inc.regexp(finalIncludeTerms)));
                  }
                  if (finalExcludeTerms != null) {
                    tb =
                        a.terms(
                            t -> {
                              var builder = t.field(lineChart.getxAxisField()).size(1000);
                              if (finalIncludeTerms != null) {
                                builder = builder.include(inc -> inc.regexp(finalIncludeTerms));
                              }
                              return builder.exclude(exc -> exc.regexp(finalExcludeTerms));
                            });
                  }
                  return tb;
                });

        metricAggregations.put(metricName, termsAgg);
        startTime = end - MILLISECONDS_IN_DAY;

      } else {
        Aggregation dateHistogramAgg =
            Aggregation.of(
                a ->
                    a.dateHistogram(
                        dh ->
                            dh.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                                .calendarInterval(CalendarInterval.Day)));
        metricAggregations.put(metricName, dateHistogramAgg);
      }

      metricFormulaHolder.put(
          metricName,
          new MetricFormulaHolder(
              metric.getFormula(),
              ElasticSearchDynamicChartAggregatorInterface.getFormulaList(metric.getFormula())));

      Map<String, Aggregation> subAggregations = new HashMap<>();
      populateDateHistogram(
          metric.getFunction(),
          metric.getFormula(),
          metric.getField(),
          metric.getFilter(),
          subAggregations,
          metricName,
          formulas);

      Aggregation currentAgg = metricAggregations.get(metricName);
      if (!subAggregations.isEmpty()) {
        if (currentAgg.isTerms()) {
          // Rebuild terms aggregation with sub-aggregations
          final String fieldName = currentAgg.terms().field();
          final int size = currentAgg.terms().size() != null ? currentAgg.terms().size() : 1000;
          metricAggregations.put(
              metricName,
              Aggregation.of(
                  a -> a.terms(t -> t.field(fieldName).size(size)).aggregations(subAggregations)));
        } else if (currentAgg._kind().name().equals("DateHistogram")) {
          // Rebuild date histogram aggregation with sub-aggregations
          final String fieldName = currentAgg.dateHistogram().field();
          final CalendarInterval interval = currentAgg.dateHistogram().calendarInterval();
          metricAggregations.put(
              metricName,
              Aggregation.of(
                  a ->
                      a.dateHistogram(dh -> dh.field(fieldName).calendarInterval(interval))
                          .aggregations(subAggregations)));
        }
      }

      if (lineChart.getGroupBy() != null) {
        List<String> includeGroups = null;
        List<String> excludeGroups = null;
        if (!CommonUtil.nullOrEmpty(lineChart.getIncludeGroups())) {
          includeGroups = lineChart.getIncludeGroups();
        }
        if (!CommonUtil.nullOrEmpty(lineChart.getExcludeGroups())) {
          excludeGroups = lineChart.getExcludeGroups();
        }

        final List<String> finalIncludeGroups = includeGroups;
        final List<String> finalExcludeGroups = excludeGroups;
        final Map<String, Aggregation> finalMetricAggregations = new HashMap<>(metricAggregations);

        Aggregation groupByAgg =
            Aggregation.of(
                a -> {
                  var termsBuilder = a.terms(t -> t.field(lineChart.getGroupBy()).size(1000));
                  if (finalIncludeGroups != null || finalExcludeGroups != null) {
                    termsBuilder =
                        a.terms(
                            t -> {
                              var tb = t.field(lineChart.getGroupBy()).size(1000);
                              if (finalIncludeGroups != null) {
                                tb = tb.include(inc -> inc.terms(finalIncludeGroups));
                              }
                              if (finalExcludeGroups != null) {
                                tb = tb.exclude(exc -> exc.terms(finalExcludeGroups));
                              }
                              return tb;
                            });
                  }
                  return termsBuilder.aggregations(finalMetricAggregations);
                });

        aggregationsMap.put("term_" + i, groupByAgg);
      } else {
        aggregationsMap.putAll(metricAggregations);
      }
    }

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder().size(0);

    final long finalStartTime = startTime;
    if (!live) {
      Query rangeQuery =
          Query.of(
              q ->
                  q.range(
                      r ->
                          r.untyped(
                              u ->
                                  u.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                                      .gte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(finalStartTime)))
                                      .lte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(end))))));
      searchRequestBuilder.query(rangeQuery);
      searchRequestBuilder.index(DataInsightSystemChartRepository.getDataInsightsSearchIndex());
    } else {
      searchRequestBuilder.index(
          DataInsightSystemChartRepository.getLiveSearchIndex(lineChart.getSearchIndex()));
    }

    searchRequestBuilder.aggregations(aggregationsMap);
    return searchRequestBuilder.build();
  }

  private String getMetricName(LineChart lineChart, String name) {
    if (lineChart.getMetrics().size() == 1) {
      return null;
    }
    return name;
  }

  @Override
  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder) {
    Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolderInternal =
        metricFormulaHolder;
    DataInsightCustomChartResultList resultList = new DataInsightCustomChartResultList();
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    Map<String, Aggregate> aggregationMap =
        searchResponse.aggregations() != null ? searchResponse.aggregations() : new HashMap<>();

    if (lineChart.getGroupBy() != null) {
      List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();
      for (Map.Entry<String, Aggregate> entry : aggregationMap.entrySet()) {
        Aggregate agg = entry.getValue();
        if (agg.isSterms()) {
          for (StringTermsBucket bucket : agg.sterms().buckets().array()) {
            for (Map.Entry<String, Aggregate> subEntry : bucket.aggregations().entrySet()) {
              String subAggName = subEntry.getKey();
              String group;
              if (lineChart.getMetrics().size() > 1) {
                group = bucket.key().stringValue() + " - " + getMetricName(lineChart, subAggName);
              } else {
                group = bucket.key().stringValue();
              }

              Map<String, Aggregate> singleAggMap = new HashMap<>();
              singleAggMap.put(subAggName, subEntry.getValue());

              diChartResults.addAll(
                  processAggregations(
                      singleAggMap,
                      metricFormulaHolderInternal.get(subAggName).formula,
                      group,
                      metricFormulaHolderInternal.get(subAggName).holders,
                      getMetricName(lineChart, subAggName)));
            }
          }
        }
      }
      resultList.setResults(diChartResults);
      return resultList;
    }

    List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();
    int i = 0;
    for (Map.Entry<String, Aggregate> entry : aggregationMap.entrySet()) {
      String aggName = entry.getKey();
      MetricFormulaHolder formulaHolder =
          metricFormulaHolder.get(aggName) == null
              ? new MetricFormulaHolder()
              : metricFormulaHolderInternal.get(aggName);
      String group = null;
      if (lineChart.getMetrics().size() > 1) {
        group = getMetricName(lineChart, aggName);
      }

      Map<String, Aggregate> singleAggMap = new HashMap<>();
      singleAggMap.put(aggName, entry.getValue());

      List<DataInsightCustomChartResult> results =
          processAggregations(
              singleAggMap,
              formulaHolder.formula,
              group,
              formulaHolder.holders,
              getMetricName(lineChart, aggName));
      diChartResults.addAll(results);
      i++;
    }

    resultList.setResults(diChartResults);
    if (lineChart.getKpiDetails() != null) {
      resultList.setKpiDetails(lineChart.getKpiDetails());
    }
    return resultList;
  }
}
