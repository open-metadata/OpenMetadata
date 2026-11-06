package org.openmetadata.service.search.opensearch.dataInsightAggregator;

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
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.CalendarInterval;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch._types.aggregations.TermsAggregation;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.util.ObjectBuilder;

public class OpenSearchLineChartAggregator implements OpenSearchDynamicChartAggregatorInterface {
  public static class MetricFormulaHolder {
    String formula;
    List<FormulaHolder> holders;

    MetricFormulaHolder() {}

    public MetricFormulaHolder(String formula, List<FormulaHolder> holders) {
      this.holders = holders;
      this.formula = formula;
    }
  }

  /**
   * Configures the categorical axis.
   *
   * <p>A terms axis picks its top N by raw document count, which is neither the population a metric
   * filters to nor the number the chart plots. {@code orderKeys} name the filter wrappers that
   * {@code populateDateHistogram} actually built, so the axis instead ranks each category by how
   * many documents it contributed to the metric.
   *
   * <p>Ranking on the wrapper's document count rather than the metric's own value is what makes
   * this safe for every function: an empty {@code min} reads as larger than any real minimum and an
   * empty {@code sum} is zero, so ordering by either would float the empty categories to the top. A
   * document count is never negative, and is zero exactly when the category matched nothing, which
   * keeps those categories in the response but last, where they cannot displace one that has data.
   */
  private static ObjectBuilder<TermsAggregation> termsAxis(
      TermsAggregation.Builder builder,
      String field,
      String include,
      String exclude,
      List<String> orderKeys) {
    TermsAggregation.Builder axis = builder.field(field).size(100);
    if (include != null) {
      axis = axis.include(inc -> inc.regexp(include));
    }
    if (exclude != null) {
      axis = axis.exclude(exc -> exc.regexp(exclude));
    }
    if (!orderKeys.isEmpty()) {
      axis = axis.order(orderKeys.stream().map(key -> Map.of(key, SortOrder.Desc)).toList());
    }
    return axis;
  }

  /** Attaches sub-aggregations only when there are any, so an empty map is never serialized. */
  private static ObjectBuilder<Aggregation> withSubAggregations(
      Aggregation.Builder.ContainerBuilder container, Map<String, Aggregation> subAggregations) {
    return subAggregations.isEmpty() ? container : container.aggregations(subAggregations);
  }

  @Override
  public SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder,
      boolean live) {
    LineChart lineChart = JsonUtils.convertValue(diChart.getChartDetails(), LineChart.class);
    Map<String, Aggregation> aggregationsMap = new HashMap<>();
    int i = 0;
    int groupByAggIndex = 0;
    long startTime = start;

    for (LineChartMetric metric : lineChart.getMetrics()) {
      String metricName = metric.getName() == null ? "metric_" + ++i : metric.getName();
      Map<String, Aggregation> metricAggregations = new HashMap<>();

      final String finalIncludeTerms =
          CommonUtil.nullOrEmpty(lineChart.getIncludeXAxisFiled())
              ? null
              : lineChart.getIncludeXAxisFiled();
      final String finalExcludeTerms =
          CommonUtil.nullOrEmpty(lineChart.getExcludeXAxisField())
              ? null
              : lineChart.getExcludeXAxisField();

      metricFormulaHolder.put(
          metricName,
          new MetricFormulaHolder(
              metric.getFormula(),
              OpenSearchDynamicChartAggregatorInterface.getFormulaList(metric.getFormula())));

      final Map<String, Aggregation> subAggregations = new HashMap<>();
      final List<String> orderKeys =
          populateDateHistogram(
              metric.getFunction(),
              metric.getFormula(),
              metric.getField(),
              metric.getFilter(),
              subAggregations,
              metricName,
              formulas);

      if (lineChart.getxAxisField() != null
          && !lineChart.getxAxisField().equals(DataInsightSystemChartRepository.TIMESTAMP_FIELD)) {
        metricAggregations.put(
            metricName,
            Aggregation.of(
                a ->
                    withSubAggregations(
                        a.terms(
                            t ->
                                termsAxis(
                                    t,
                                    lineChart.getxAxisField(),
                                    finalIncludeTerms,
                                    finalExcludeTerms,
                                    orderKeys)),
                        subAggregations)));
        startTime = end - MILLISECONDS_IN_DAY;
      } else {
        metricAggregations.put(
            metricName,
            Aggregation.of(
                a ->
                    withSubAggregations(
                        a.dateHistogram(
                            dh ->
                                dh.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                                    .calendarInterval(CalendarInterval.Day)),
                        subAggregations)));
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
                  var termsBuilder = a.terms(t -> t.field(lineChart.getGroupBy()).size(100));
                  if (finalIncludeGroups != null || finalExcludeGroups != null) {
                    termsBuilder =
                        a.terms(
                            t -> {
                              var tb = t.field(lineChart.getGroupBy()).size(100);
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

        aggregationsMap.put("term_" + groupByAggIndex++, groupByAgg);
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
                          r.field(DataInsightSystemChartRepository.TIMESTAMP_FIELD)
                              .gte(JsonData.of(finalStartTime))
                              .lte(JsonData.of(end))));

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

  public DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder) {
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
                group = bucket.key() + " - " + getMetricName(lineChart, subAggName);
              } else {
                group = bucket.key();
              }

              Map<String, Aggregate> singleAggMap = new HashMap<>();
              singleAggMap.put(subAggName, subEntry.getValue());

              diChartResults.addAll(
                  processAggregations(
                      singleAggMap,
                      ((Map<String, MetricFormulaHolder>) metricFormulaHolder)
                          .get(subAggName)
                          .formula,
                      group,
                      ((Map<String, MetricFormulaHolder>) metricFormulaHolder)
                          .get(subAggName)
                          .holders,
                      getMetricName(lineChart, subAggName)));
            }
          }
        }
      }
      resultList.setResults(diChartResults);
      return resultList;
    }

    List<DataInsightCustomChartResult> diChartResults = new ArrayList<>();
    for (Map.Entry<String, Aggregate> entry : aggregationMap.entrySet()) {
      String aggName = entry.getKey();
      MetricFormulaHolder formulaHolder =
          metricFormulaHolder.get(aggName) == null
              ? new MetricFormulaHolder()
              : ((Map<String, MetricFormulaHolder>) metricFormulaHolder).get(aggName);
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
    }

    resultList.setResults(diChartResults);
    if (lineChart.getKpiDetails() != null) {
      resultList.setKpiDetails(lineChart.getKpiDetails());
    }
    return resultList;
  }
}
