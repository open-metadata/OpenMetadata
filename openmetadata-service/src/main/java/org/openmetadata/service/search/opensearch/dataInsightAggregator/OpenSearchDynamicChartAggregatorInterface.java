package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
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
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.DateHistogramBucket;
import os.org.opensearch.client.opensearch._types.aggregations.FilterAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

public interface OpenSearchDynamicChartAggregatorInterface {
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
      Map<String, Aggregation> aggregations,
      String aggregationName,
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
        String queryString = matcher.group(5);
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
                                                  qs -> qs.query(queryString).lenient(true))))
                                  .must(filter)));
        } else {
          queryBuilder = Query.of(q -> q.queryString(qs -> qs.query(queryString).lenient(true)));
        }
        Map<String, Aggregation> subAggMap = new HashMap<>();
        subAggMap.put(field + index, subAgg);
        aggregations.put(
            "filter" + index, Aggregation.of(a -> a.filter(queryBuilder).aggregations(subAggMap)));
        holder.setQuery(queryString);
      } else {
        if (filter != null) {
          Map<String, Aggregation> subAggMap = new HashMap<>();
          subAggMap.put(field + index, subAgg);
          aggregations.put(
              "filter" + index, Aggregation.of(a -> a.filter(filter).aggregations(subAggMap)));
        } else {
          aggregations.put(field + index, subAgg);
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
      Map<String, Aggregation> aggregations,
      String aggregationName,
      List<FormulaHolder> formulas) {
    if (formula != null) {
      if (filter != null && !filter.equals("{}")) {
        try {
          JsonNode rootNode = mapper.readTree(filter);
          JsonNode queryNode = rootNode.get("query");
          String base64Query = Base64.getEncoder().encodeToString(queryNode.toString().getBytes());
          Query queryFilter = Query.of(q -> q.wrapper(w -> w.query(base64Query)));

          getDateHistogramByFormula(formula, queryFilter, aggregations, aggregationName, formulas);
        } catch (Exception e) {
          Log.error("Error while parsing query string so using fallback: {}", e.getMessage(), e);
          getDateHistogramByFormula(formula, null, aggregations, aggregationName, formulas);
        }
      } else {
        getDateHistogramByFormula(formula, null, aggregations, aggregationName, formulas);
      }
      return;
    }

    // process non formula date histogram
    Aggregation subAgg = getSubAggregationsByFunction(function, field, 0);
    if (filter != null && !filter.equals("{}")) {
      try {
        JsonNode rootNode = mapper.readTree(filter);
        JsonNode queryNode = rootNode.get("query");
        String base64Query = Base64.getEncoder().encodeToString(queryNode.toString().getBytes());
        Query queryFilter = Query.of(q -> q.wrapper(w -> w.query(base64Query)));

        Map<String, Aggregation> subAggMap = new HashMap<>();
        subAggMap.put(field + "0", subAgg);
        aggregations.put(
            "filter", Aggregation.of(a -> a.filter(queryFilter).aggregations(subAggMap)));
      } catch (Exception e) {
        Log.error("Error while parsing query string so using fallback: {}", e.getMessage(), e);
        aggregations.put(field + "0", subAgg);
      }
    } else {
      aggregations.put(field + "0", subAgg);
    }
  }

  SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder,
      boolean live)
      throws IOException;

  DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse<JsonData> searchResponse,
      List<FormulaHolder> formulas,
      Map metricFormulaHolder);

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

  /**
   * Extracts the numeric index from aggregation key names.
   * Keys follow patterns like "filter0", "filter1", "id.keyword0", "id.keyword1",
   * etc.
   * The index is always the trailing digits in the key name.
   */
  private static int extractAggregationIndex(String key) {
    // Extract trailing digits from the key
    int i = key.length() - 1;
    while (i >= 0 && Character.isDigit(key.charAt(i))) {
      i--;
    }
    if (i < key.length() - 1) {
      return Integer.parseInt(key.substring(i + 1));
    }
    return Integer.MAX_VALUE; // Keys without numeric suffix go last
  }

  /**
   * Returns a sorted list of aggregation entries by their numeric index.
   * This ensures consistent ordering regardless of the underlying map
   * implementation.
   */
  private static List<Map.Entry<String, Aggregate>> getSortedAggregationEntries(
      Map<String, Aggregate> aggregations) {
    List<Map.Entry<String, Aggregate>> entries = new ArrayList<>(aggregations.entrySet());
    entries.sort(Comparator.comparingInt(e -> extractAggregationIndex(e.getKey())));
    return entries;
  }

  private List<List<DataInsightCustomChartResult>> processAggregationsInternal(
      Map<String, Aggregate> aggregations, String group, String metric) {
    List<List<DataInsightCustomChartResult>> results = new ArrayList<>();
    for (Map.Entry<String, Aggregate> entry : aggregations.entrySet()) {
      Aggregate agg = entry.getValue();
      if (agg.isSterms()) {
        for (StringTermsBucket bucket : agg.sterms().buckets().array()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          // Sort entries by their numeric index to ensure correct formula substitution
          // order
          for (Map.Entry<String, Aggregate> subEntry :
              getSortedAggregationEntries(bucket.aggregations())) {
            addByAggregationType(
                subEntry.getValue(), subResults, bucket.key(), group, false, metric);
          }
          results.add(subResults);
        }
      } else if (agg.isDateHistogram()) {
        for (DateHistogramBucket bucket : agg.dateHistogram().buckets().array()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          // Sort entries by their numeric index to ensure correct formula substitution
          // order
          for (Map.Entry<String, Aggregate> subEntry :
              getSortedAggregationEntries(bucket.aggregations())) {
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
      Aggregate subAggr,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    if (subAggr.isValueCount()) {
      addProcessedSubResult(
          subAggr.valueCount().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isCardinality()) {
      addProcessedSubResult(
          (double) subAggr.cardinality().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isSum()) {
      addProcessedSubResult(subAggr.sum().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isAvg()) {
      addProcessedSubResult(subAggr.avg().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isMin()) {
      addProcessedSubResult(subAggr.min().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isMax()) {
      addProcessedSubResult(subAggr.max().value(), diChartResults, key, group, isTimeStamp, metric);
    } else if (subAggr.isFilter()) {
      addProcessedSubResult(subAggr.filter(), diChartResults, key, group, isTimeStamp, metric);
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
      double value,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
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
