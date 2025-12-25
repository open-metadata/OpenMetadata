package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CardinalityAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.DateHistogramBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.FilterAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.SingleMetricAggregateBase;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.ValueCountAggregate;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.jena.atlas.logging.Log;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.Function;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.springframework.expression.Expression;

public interface ElasticSearchDynamicChartAggregatorInterface {

  long MILLISECONDS_IN_DAY = 24L * 60 * 60 * 1000;
  ObjectMapper mapper = new ObjectMapper();

  private static Aggregation getSubAggregationsByFunction(
      Function function, String field, int index) {
    return switch (function) {
      case COUNT -> Aggregation.of(a -> a.valueCount(v -> v.field(field)));
      case SUM -> Aggregation.of(a -> a.sum(s -> s.field(field)));
      case AVG -> Aggregation.of(a -> a.avg(avg -> avg.field(field)));
      case MIN -> Aggregation.of(a -> a.min(m -> m.field(field)));
      case MAX -> Aggregation.of(a -> a.max(m -> m.field(field)));
      case UNIQUE -> Aggregation.of(a -> a.cardinality(c -> c.field(field)));
    };
  }

  static List<FormulaHolder> getFormulaList(String formula) {
    List<FormulaHolder> formulas = new ArrayList<>();
    if (formula == null) {
      return formulas;
    }
    Pattern pattern = Pattern.compile(DataInsightSystemChartRepository.FORMULA_FUNC_REGEX);
    Matcher matcher = pattern.matcher(formula);
    while (matcher.find()) {
      FormulaHolder holder = new FormulaHolder();
      holder.setFormula(matcher.group());
      holder.setFunction(Function.valueOf(matcher.group(1).toUpperCase()));
      if (matcher.group(5) != null) {
        holder.setQuery(matcher.group(5));
      }
      formulas.add(holder);
    }
    return formulas;
  }

  static void getDateHistogramByFormula(
      String formula,
      Query filter,
      Map<String, Aggregation> aggregationsMap,
      String parentAggName,
      List<FormulaHolder> formulas) {
    Pattern pattern = Pattern.compile(DataInsightSystemChartRepository.FORMULA_FUNC_REGEX);
    Matcher matcher = pattern.matcher(formula);
    int index = 0;
    while (matcher.find()) {
      FormulaHolder holder = new FormulaHolder();
      holder.setFormula(matcher.group());
      holder.setFunction(Function.valueOf(matcher.group(1).toUpperCase()));
      String field;
      if (matcher.group(3) != null) {
        field = matcher.group(3);
      } else {
        field = "id.keyword";
      }
      Aggregation subAgg =
          getSubAggregationsByFunction(
              Function.valueOf(matcher.group(1).toUpperCase()), field, index);

      if (matcher.group(5) != null) {
        Query queryBuilder;
        if (filter != null) {
          queryBuilder =
              Query.of(
                  q ->
                      q.bool(
                          b ->
                              b.must(
                                      Query.of(
                                          mq ->
                                              mq.queryString(
                                                  qs -> qs.query(matcher.group(5)).lenient(true))))
                                  .must(filter)));
        } else {
          queryBuilder =
              Query.of(q -> q.queryString(qs -> qs.query(matcher.group(5)).lenient(true)));
        }

        Map<String, Aggregation> subAggMap = new HashMap<>();
        subAggMap.put(field + index, subAgg);
        aggregationsMap.put(
            "filter" + index, Aggregation.of(a -> a.filter(queryBuilder).aggregations(subAggMap)));
        holder.setQuery(matcher.group(5));
      } else {
        if (filter != null) {
          Map<String, Aggregation> subAggMap = new HashMap<>();
          subAggMap.put(field + index, subAgg);
          aggregationsMap.put(
              "filter" + index, Aggregation.of(a -> a.filter(filter).aggregations(subAggMap)));
        } else {
          aggregationsMap.put(field + index, subAgg);
        }
      }
      formulas.add(holder);
      index++;
    }
  }

  private List<DataInsightCustomChartResult> processMultiAggregations(
      Map<String, Aggregate> aggregations,
      String formula,
      String group,
      List<FormulaHolder> holder,
      String metric) {
    List<DataInsightCustomChartResult> finalList = new ArrayList<>();

    List<List<DataInsightCustomChartResult>> results =
        processAggregationsInternal(aggregations, group, metric);
    for (List<DataInsightCustomChartResult> result : results) {
      String formulaCopy = formula;
      if (holder.size() != result.size()) {
        continue;
      }
      boolean evaluate = true;
      Double day = null;
      String term = null;
      for (int i = 0; i < holder.size(); i++) {
        if (result.get(i).getCount() == null) {
          evaluate = false;
          break;
        }
        day = result.get(i).getDay();
        term = result.get(i).getTerm();
        formulaCopy =
            formulaCopy.replace(holder.get(i).getFormula(), result.get(i).getCount().toString());
      }
      if (evaluate
          && formulaCopy.matches(DataInsightSystemChartRepository.NUMERIC_VALIDATION_REGEX)
          && (day != null || term != null)) {
        Expression expression = CompiledRule.parseExpression(formulaCopy);
        Double value = (Double) expression.getValue();
        // Convert NaN and Infinite values to 0.0
        if (value == null || value.isNaN() || value.isInfinite()) {
          value = 0.0;
        }
        if (day != null) {
          finalList.add(
              new DataInsightCustomChartResult()
                  .withCount(value)
                  .withGroup(group)
                  .withDay(day)
                  .withMetric(metric));
        } else {
          finalList.add(
              new DataInsightCustomChartResult()
                  .withCount(value)
                  .withGroup(group)
                  .withTerm(term)
                  .withMetric(metric));
        }
      }
    }
    return finalList;
  }

  default void populateDateHistogram(
      Function function,
      String formula,
      String field,
      String filter,
      Map<String, Aggregation> aggregationsMap,
      String parentAggName,
      List<FormulaHolder> formulas) {
    if (formula != null) {
      if (filter != null && !filter.equals("{}")) {
        try {
          JsonNode rootNode = mapper.readTree(filter);
          JsonNode queryNode = rootNode.get("query");

          Query queryFilter = Query.of(q -> q.withJson(new StringReader(queryNode.toString())));
          getDateHistogramByFormula(formula, queryFilter, aggregationsMap, parentAggName, formulas);
        } catch (Exception e) {
          Log.error("Error while parsing query string so using fallback: {}", e.getMessage(), e);
          getDateHistogramByFormula(formula, null, aggregationsMap, parentAggName, formulas);
        }
      } else {
        getDateHistogramByFormula(formula, null, aggregationsMap, parentAggName, formulas);
      }
      return;
    }

    Aggregation subAgg = getSubAggregationsByFunction(function, field, 0);
    if (filter != null && !filter.equals("{}")) {
      try {
        JsonNode rootNode = mapper.readTree(filter);
        JsonNode queryNode = rootNode.get("query");

        Query queryFilter = Query.of(q -> q.withJson(new StringReader(queryNode.toString())));
        Map<String, Aggregation> subAggMap = new HashMap<>();
        subAggMap.put(field + "0", subAgg);
        aggregationsMap.put(
            "filter", Aggregation.of(a -> a.filter(queryFilter).aggregations(subAggMap)));
      } catch (Exception e) {
        Log.error("Error while parsing query string so using fallback: {}", e.getMessage(), e);
        aggregationsMap.put(field + "0", subAgg);
      }
    } else {
      aggregationsMap.put(field + "0", subAgg);
    }
  }

  SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricHolder,
      boolean live)
      throws IOException;

  DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricHolder);

  default List<DataInsightCustomChartResult> processAggregations(
      Map<String, Aggregate> aggregations,
      String formula,
      String group,
      List<FormulaHolder> holder,
      String metric) {
    if (formula != null) {
      return processMultiAggregations(aggregations, formula, group, holder, metric);
    }
    return processSingleAggregations(aggregations, group, metric);
  }

  private List<DataInsightCustomChartResult> processSingleAggregations(
      Map<String, Aggregate> aggregations, String group, String metric) {
    List<List<DataInsightCustomChartResult>> rawResultList =
        processAggregationsInternal(aggregations, group, metric);
    List<DataInsightCustomChartResult> finalResult = new ArrayList<>();
    for (List<DataInsightCustomChartResult> diResultList : rawResultList) {
      finalResult.addAll(diResultList);
    }
    return finalResult;
  }

  private List<List<DataInsightCustomChartResult>> processAggregationsInternal(
      Map<String, Aggregate> aggregations, String group, String metric) {
    List<List<DataInsightCustomChartResult>> results = new ArrayList<>();
    for (Map.Entry<String, Aggregate> entry : aggregations.entrySet()) {
      Aggregate agg = entry.getValue();
      if (agg.isSterms()) {
        for (StringTermsBucket bucket : agg.sterms().buckets().array()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          for (Map.Entry<String, Aggregate> subEntry : bucket.aggregations().entrySet()) {
            addByAggregationType(
                subEntry.getValue(), subResults, bucket.key().stringValue(), group, false, metric);
          }
          results.add(subResults);
        }
      } else if (agg.isDateHistogram()) {
        for (DateHistogramBucket bucket : agg.dateHistogram().buckets().array()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          for (Map.Entry<String, Aggregate> subEntry : bucket.aggregations().entrySet()) {
            addByAggregationType(
                subEntry.getValue(), subResults, String.valueOf(bucket.key()), group, true, metric);
          }
          results.add(subResults);
        }
      }
    }
    return results;
  }

  private void addByAggregationType(
      Aggregate agg,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    if (agg.isValueCount()) {
      addProcessedSubResult(agg.valueCount(), diChartResults, key, group, isTimeStamp, metric);
    } else if (agg.isCardinality()) {
      addProcessedSubResult(agg.cardinality(), diChartResults, key, group, isTimeStamp, metric);
    } else if (agg.isSum() || agg.isAvg() || agg.isMin() || agg.isMax()) {
      SingleMetricAggregateBase metricAgg = null;
      if (agg.isSum()) metricAgg = agg.sum();
      else if (agg.isAvg()) metricAgg = agg.avg();
      else if (agg.isMin()) metricAgg = agg.min();
      else if (agg.isMax()) metricAgg = agg.max();

      if (metricAgg != null) {
        addProcessedSubResult(metricAgg, diChartResults, key, group, isTimeStamp, metric);
      }
    } else if (agg.isFilter()) {
      addProcessedSubResult(agg.filter(), diChartResults, key, group, isTimeStamp, metric);
    }
  }

  private DataInsightCustomChartResult getDIChartResult(
      Double value, String key, String group, boolean isTimestamp, String metric) {
    if (isTimestamp)
      return new DataInsightCustomChartResult()
          .withCount(value)
          .withDay(Double.valueOf(key))
          .withGroup(group)
          .withMetric(metric);
    return new DataInsightCustomChartResult()
        .withCount(value)
        .withGroup(group)
        .withTerm(key)
        .withMetric(metric);
  }

  private void addProcessedSubResult(
      ValueCountAggregate aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    double value = aggregation.value();
    if (!Double.isInfinite(value) && !Double.isNaN(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      CardinalityAggregate aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    double value = (double) aggregation.value();
    if (!Double.isInfinite(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      SingleMetricAggregateBase aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    double value = aggregation.value();
    if (!Double.isInfinite(value) && !Double.isNaN(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      FilterAggregate aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    for (Map.Entry<String, Aggregate> entry : aggregation.aggregations().entrySet()) {
      addByAggregationType(entry.getValue(), diChartResults, key, group, isTimeStamp, metric);
    }
  }
}
