package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.search.aggregations.AbstractAggregationBuilder;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.filter.ParsedFilter;
import es.org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import es.org.elasticsearch.search.aggregations.bucket.histogram.ParsedDateHistogram;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.metrics.ParsedCardinality;
import es.org.elasticsearch.search.aggregations.metrics.ParsedSingleValueNumericMetricsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.ParsedValueCount;
import es.org.elasticsearch.search.aggregations.support.ValuesSourceAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.IOException;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.dataInsight.custom.Function;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.search.elasticsearch.EsUtils;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.springframework.expression.Expression;

public interface ElasticSearchDynamicChartAggregatorInterface {

  long MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

  private static ValuesSourceAggregationBuilder getSubAggregationsByFunction(
      Function function, String field, int index) {
    return switch (function) {
      case COUNT -> AggregationBuilders.count(field + index).field(field);
      case SUM -> AggregationBuilders.sum(field + index).field(field);
      case AVG -> AggregationBuilders.avg(field + index).field(field);
      case MIN -> AggregationBuilders.min(field + index).field(field);
      case MAX -> AggregationBuilders.max(field + index).field(field);
      case UNIQUE -> AggregationBuilders.cardinality(field + index).field(field);
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
      QueryBuilder filter,
      AbstractAggregationBuilder aggregationBuilder,
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
      ValuesSourceAggregationBuilder subAgg =
          getSubAggregationsByFunction(
              Function.valueOf(matcher.group(1).toUpperCase()), field, index);
      if (matcher.group(5) != null) {
        QueryBuilder queryBuilder;
        if (filter != null) {
          queryBuilder =
              QueryBuilders.boolQuery()
                  .must(QueryBuilders.queryStringQuery(matcher.group(5)))
                  .must(filter);
        } else {
          queryBuilder = QueryBuilders.queryStringQuery(matcher.group(5));
        }
        aggregationBuilder.subAggregation(
            AggregationBuilders.filter("filer" + index, queryBuilder).subAggregation(subAgg));
        holder.setQuery(matcher.group(5));
      } else {
        if (filter != null) {
          aggregationBuilder.subAggregation(
              AggregationBuilders.filter("filer" + index, filter).subAggregation(subAgg));
        } else {
          aggregationBuilder.subAggregation(subAgg);
        }
      }
      formulas.add(holder);
      index++;
    }
  }

  private List<DataInsightCustomChartResult> processMultiAggregations(
      List<Aggregation> aggregations,
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
        if (!value.isNaN() && !value.isInfinite()) {
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
    }
    return finalList;
  }

  default void populateDateHistogram(
      Function function,
      String formula,
      String field,
      String filter,
      AbstractAggregationBuilder aggregationBuilder,
      List<FormulaHolder> formulas)
      throws IOException {
    if (formula != null) {

      if (filter != null && !filter.equals("{}")) {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, filter);
        QueryBuilder queryFilter = SearchSourceBuilder.fromXContent(filterParser).query();
        getDateHistogramByFormula(formula, queryFilter, aggregationBuilder, formulas);
      } else {
        getDateHistogramByFormula(formula, null, aggregationBuilder, formulas);
      }
      return;
    }

    // process non formula date histogram
    ValuesSourceAggregationBuilder subAgg = getSubAggregationsByFunction(function, field, 0);
    if (filter != null && !filter.equals("{}")) {
      XContentParser filterParser =
          XContentType.JSON
              .xContent()
              .createParser(EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, filter);
      QueryBuilder queryFilter = SearchSourceBuilder.fromXContent(filterParser).query();
      aggregationBuilder.subAggregation(
          AggregationBuilders.filter("filer", queryFilter).subAggregation(subAgg));
    } else {
      aggregationBuilder.subAggregation(subAgg);
    }
  }

  SearchRequest prepareSearchRequest(
      @NotNull DataInsightCustomChart diChart,
      long start,
      long end,
      List<FormulaHolder> formulas,
      Map metricHolder)
      throws IOException;

  DataInsightCustomChartResultList processSearchResponse(
      @NotNull DataInsightCustomChart diChart,
      SearchResponse searchResponse,
      List<FormulaHolder> formulas,
      Map metricHolder);

  default List<DataInsightCustomChartResult> processAggregations(
      List<Aggregation> aggregations,
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
      List<Aggregation> aggregations, String group, String metric) {
    List<List<DataInsightCustomChartResult>> rawResultList =
        processAggregationsInternal(aggregations, group, metric);
    List<DataInsightCustomChartResult> finalResult = new ArrayList<>();
    for (List<DataInsightCustomChartResult> diResultList : rawResultList) {
      finalResult.addAll(diResultList);
    }
    return finalResult;
  }

  private List<List<DataInsightCustomChartResult>> processAggregationsInternal(
      List<Aggregation> aggregations, String group, String metric) {
    List<List<DataInsightCustomChartResult>> results = new ArrayList<>();
    for (Aggregation arg : aggregations) {
      if (arg instanceof ParsedTerms) {
        ParsedTerms parsedTerms = (ParsedTerms) arg;
        for (Terms.Bucket bucket : parsedTerms.getBuckets()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          for (Aggregation subAggr : bucket.getAggregations().asList()) {
            addByAggregationType(
                subAggr, subResults, String.valueOf(bucket.getKey()), group, false, metric);
          }
          results.add(subResults);
        }
      } else {
        ParsedDateHistogram parsedDateHistogram = (ParsedDateHistogram) arg;
        for (Histogram.Bucket bucket : parsedDateHistogram.getBuckets()) {
          List<DataInsightCustomChartResult> subResults = new ArrayList<>();
          for (Aggregation subAggr : bucket.getAggregations().asList()) {
            addByAggregationType(
                subAggr,
                subResults,
                String.valueOf(((ZonedDateTime) bucket.getKey()).toInstant().toEpochMilli()),
                group,
                true,
                metric);
          }
          results.add(subResults);
        }
      }
    }
    return results;
  }

  private void addByAggregationType(
      Aggregation subAggr,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    if (subAggr instanceof ParsedValueCount)
      addProcessedSubResult(
          (ParsedValueCount) subAggr, diChartResults, key, group, isTimeStamp, metric);
    else if (subAggr instanceof ParsedCardinality)
      addProcessedSubResult(
          (ParsedCardinality) subAggr, diChartResults, key, group, isTimeStamp, metric);
    else if (subAggr instanceof ParsedSingleValueNumericMetricsAggregation)
      addProcessedSubResult(
          (ParsedSingleValueNumericMetricsAggregation) subAggr,
          diChartResults,
          key,
          group,
          isTimeStamp,
          metric);
    else if (subAggr instanceof ParsedFilter)
      addProcessedSubResult(
          (ParsedFilter) subAggr, diChartResults, key, group, isTimeStamp, metric);
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
      ParsedValueCount aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    Double value = Double.valueOf((double) aggregation.getValue());
    if (!Double.isInfinite(value) && !Double.isNaN(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      ParsedCardinality aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    Double value = Double.valueOf((double) aggregation.getValue());
    if (!Double.isInfinite(value) && !Double.isNaN(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      ParsedSingleValueNumericMetricsAggregation aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    Double value = aggregation.value();
    if (!Double.isInfinite(value) && !Double.isNaN(value)) {
      DataInsightCustomChartResult diChartResult =
          getDIChartResult(value, key, group, isTimeStamp, metric);
      diChartResults.add(diChartResult);
    }
  }

  private void addProcessedSubResult(
      ParsedFilter aggregation,
      List<DataInsightCustomChartResult> diChartResults,
      String key,
      String group,
      boolean isTimeStamp,
      String metric) {
    for (Aggregation agg : aggregation.getAggregations().asList()) {
      addByAggregationType(agg, diChartResults, key, group, isTimeStamp, metric);
    }
  }
}
